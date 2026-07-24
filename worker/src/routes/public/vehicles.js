import { success, notFound, serverError } from "../../utils/response.js";
import { mapDbToVehicle, getVehicleByIdOrStock } from "../admin/vehicles.js";
import { getStorageBucket } from "../../utils/storage.js";

/**
 * GET /api/v1/public/vehicles - Public Vehicle Inventory Listing
 */
export async function listPublicVehicles(request, env) {
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim();
    const category = (url.searchParams.get("category") || url.searchParams.get("bodyType") || "all").toLowerCase();
    const make = (url.searchParams.get("make") || "all").toLowerCase();
    const status = url.searchParams.get("status");
    const featured = url.searchParams.get("featured");
    const sort = url.searchParams.get("sort") || "order-asc";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

    // Fetch settings for sold vehicles and featured limit defaults
    const settings = await env.DB.prepare(`SELECT show_sold_vehicles, featured_vehicles_limit FROM settings WHERE id = 1`).first();
    const showSoldVehicles = Boolean(settings?.show_sold_vehicles);
    const featuredLimit = Math.min(9, Math.max(1, settings?.featured_vehicles_limit || 6));

    let limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10)));
    if ((featured === "true" || featured === "1") && !url.searchParams.has("limit")) {
      limit = featuredLimit;
    }

    let sqlWhere = [`is_published = 1 AND archived_at IS NULL AND LOWER(status) != 'draft'`];
    let params = [];

    if (!showSoldVehicles && (!status || status.toLowerCase() !== "sold")) {
      sqlWhere.push(`LOWER(status) != 'sold'`);
    }

    if (search) {
      sqlWhere.push(`(
        LOWER(stock_number) LIKE ? OR
        LOWER(make) LIKE ? OR
        LOWER(model) LIKE ? OR
        LOWER(grade) LIKE ? OR
        LOWER(color) LIKE ? OR
        LOWER(transmission) LIKE ? OR
        LOWER(fuel_type) LIKE ? OR
        LOWER(short_description) LIKE ? OR
        CAST(year AS TEXT) LIKE ?
      )`);
      const term = `%${search.toLowerCase()}%`;
      params.push(term, term, term, term, term, term, term, term, term);
    }

    if (category && category !== "all") {
      if (category === "sedan") {
        sqlWhere.push(`LOWER(body_type) = 'sedan'`);
      } else if (category === "suv") {
        sqlWhere.push(`(LOWER(body_type) = 'suv' OR LOWER(body_type) = 'crossover')`);
      } else {
        sqlWhere.push(`LOWER(body_type) = LOWER(?)`);
        params.push(category);
      }
    }

    if (make && make !== "all") {
      sqlWhere.push(`LOWER(make) = LOWER(?)`);
      params.push(make);
    }

    if (status) {
      sqlWhere.push(`LOWER(status) = LOWER(?)`);
      params.push(status);
    }

    if (featured === "true" || featured === "1") {
      sqlWhere.push(`is_featured = 1`);
    }

    const whereClause = `WHERE ${sqlWhere.join(" AND ")}`;

    let orderBy = "ORDER BY display_order ASC, created_at DESC";
    if (featured === "true" || featured === "1") {
      orderBy = "ORDER BY CASE WHEN featured_position > 0 THEN featured_position ELSE 999 END ASC, display_order ASC, created_at DESC";
    } else if (sort === "price-asc") orderBy = "ORDER BY price ASC";
    else if (sort === "price-desc") orderBy = "ORDER BY price DESC";
    else if (sort === "year-desc") orderBy = "ORDER BY year DESC";
    else if (sort === "date-desc") orderBy = "ORDER BY created_at DESC";

    const countRes = await env.DB.prepare(`SELECT COUNT(*) as total FROM vehicles ${whereClause}`).bind(...params).first();
    const totalItems = countRes?.total || 0;

    const offset = (page - 1) * limit;
    const query = `SELECT * FROM vehicles ${whereClause} ${orderBy} LIMIT ? OFFSET ?`;
    const rowsRes = await env.DB.prepare(query).bind(...params, limit, offset).all();
    const rows = rowsRes?.results || [];

    const vehicles = [];
    for (const row of rows) {
      const imgRes = await env.DB.prepare(`SELECT * FROM vehicle_images WHERE vehicle_id = ? ORDER BY display_order ASC, id ASC`).bind(row.id).all();
      vehicles.push(mapDbToVehicle(row, imgRes?.results || []));
    }

    return success({
      items: vehicles,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit) || 1
      }
    });
  } catch (error) {
    console.error("List public vehicles error:", error);
    return serverError("Failed to fetch vehicles.");
  }
}

/**
 * GET /api/v1/public/vehicles/:identifier - Get single published vehicle by ID, stock number, or slug
 */
export async function getPublicVehicle(request, env, ctx, params) {
  try {
    const vehicle = await getVehicleByIdOrStock(env.DB, params.identifier);
    if (!vehicle || !vehicle.published || vehicle.archivedAt) {
      return notFound("Vehicle not found.");
    }
    return success(vehicle);
  } catch (error) {
    console.error("Get public vehicle error:", error);
    return serverError("Failed to fetch vehicle details.");
  }
}

/**
 * GET /api/v1/public/settings - Get public settings (no auth required)
 */
export async function getPublicSettings(request, env) {
  try {
    const settings = await env.DB.prepare(`SELECT company_name, company_slug, phone, whatsapp, email, address, facebook, youtube, default_currency, seo_title_suffix, seo_default_keywords, seo_default_description, showroom_address, showroom_phone, show_showroom, corporate_address, corporate_phone, show_corporate, contact_name, contact_phone, show_primary_contact, show_whatsapp, show_email, company_logo_url, favicon_url, stock_banner_url, featured_vehicles_limit, show_sold_vehicles FROM settings WHERE id = 1`).first();
    return success(settings);
  } catch (error) {
    console.error("Get public settings error:", error);
    return serverError("Failed to fetch website settings.");
  }
}

/**
 * GET /api/v1/public/files/* & GET /api/v1/public/images/* - Get generic file or asset from R2 storage
 */
export async function getPublicFile(request, env, ctx, params) {
  try {
    const url = new URL(request.url);
    let key = params?.key;
    if (!key) {
      key = url.pathname.replace(/^\/api\/v1\/public\/(files|images)\//, "");
    }
    if (!key) return notFound("File key is required.");

    // Clean leading slashes
    key = key.replace(/^\/+/, "");

    const bucket = getStorageBucket(env);
    if (!bucket) {
      return notFound("Storage service not configured.");
    }

    const object = await bucket.get(key);
    if (!object) {
      return notFound("File not found.");
    }

    const headers = new Headers();
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    const ext = key.split(".").pop().toLowerCase();
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };

    const contentType = object.httpMetadata?.contentType || mimeTypes[ext] || "application/octet-stream";
    headers.set("Content-Type", contentType);

    if (ext === "pdf") {
      const filename = key.split("/").pop() || "document.pdf";
      headers.set("Content-Disposition", `inline; filename="${filename}"`);
    }

    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Get public file error:", error);
    return notFound("File not found.");
  }
}

export const getPublicImage = getPublicFile;

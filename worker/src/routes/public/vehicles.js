import { success, notFound, serverError } from "../../utils/response.js";
import { mapDbToVehicle } from "../../services/vehicle-mapper.js";
import { VehicleRepository } from "../../repositories/vehicle-repository.js";
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
    const includeSold = url.searchParams.get("includeSold") === "true";
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

    let sqlWhere = [`is_published = 1 AND archived_at IS NULL`];
    let params = [];

    // Include sold vehicles ONLY if global website setting allows it AND client requested them (or filtered by status=sold)
    if (!showSoldVehicles) {
      sqlWhere.push(`LOWER(status) != 'sold'`);
    } else if (!includeSold && (!status || status.toLowerCase() !== "sold")) {
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

    const totalItems = await VehicleRepository.countVehicles(env.DB, whereClause, params);

    const offset = (page - 1) * limit;
    const rows = await VehicleRepository.findVehicles(env.DB, whereClause, orderBy, params, limit, offset);

    const vehicles = [];
    for (const row of rows) {
      const images = await VehicleRepository.findVehicleImages(env.DB, row.id);
      vehicles.push(mapDbToVehicle(row, images));
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
    const vehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, params.identifier);
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

/**
 * GET /api/v1/public/vehicles/:identifier/auction-sheet - Stream/serve auction sheet for a published vehicle
 */
export async function getPublicVehicleAuctionSheet(request, env, ctx, params) {
  try {
    const vehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, params.identifier);
    if (!vehicle || !vehicle.published || vehicle.archivedAt) {
      return notFound("Vehicle not found.");
    }

    if (!vehicle.auctionSheetAvailable || !vehicle.auctionSheetUrl) {
      return notFound("Auction sheet not available for this vehicle.");
    }

    let key = vehicle.auctionSheetUrl.trim();
    if (key.startsWith("http://") || key.startsWith("https://")) {
      if (key.includes("/uploads/")) {
        key = key.substring(key.indexOf("uploads/"));
      } else if (key.includes("/api/v1/public/files/")) {
        key = key.substring(key.indexOf("/api/v1/public/files/") + "/api/v1/public/files/".length);
      }
    }
    if (key.startsWith("/api/v1/public/files/")) {
      key = key.replace(/^\/api\/v1\/public\/files\//, "");
    }
    key = key.replace(/^\/+/, "");

    const bucket = getStorageBucket(env);
    if (!bucket) {
      return notFound("Storage service not configured.");
    }

    const object = await bucket.get(key);
    if (!object) {
      return notFound("Auction sheet file not found.");
    }

    const headers = new Headers();
    headers.set("Cache-Control", "public, max-age=3600");

    const ext = key.split(".").pop().toLowerCase();
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
      pdf: "application/pdf"
    };

    const contentType = object.httpMetadata?.contentType || mimeTypes[ext] || "application/octet-stream";
    headers.set("Content-Type", contentType);

    const safeStock = (vehicle.stockNumber || vehicle.id).toString().replace(/[^a-zA-Z0-9_-]/g, "");
    const filename = `Auction-Sheet-${safeStock}.${ext}`;
    headers.set("Content-Disposition", `inline; filename="${filename}"`);

    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Get public vehicle auction sheet error:", error);
    return notFound("Auction sheet not found.");
  }
}

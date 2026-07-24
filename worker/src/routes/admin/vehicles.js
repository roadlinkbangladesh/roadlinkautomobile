import { success, created, badRequest, notFound, serverError, validationError } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { logAudit, getRequestMeta } from "../../utils/audit.js";
import { getStorageBucket, extractObjectKey, resolveFileUrl, deleteStoredFile } from "../../utils/storage.js";

/**
 * Helper to map DB vehicle row and vehicle_images rows into frontend vehicle object
 */
export function mapDbToVehicle(row, images = []) {
  if (!row) return null;

  const exteriorImages = images.filter(i => i.image_type === "exterior").map(i => resolveFileUrl(i.image_url));
  const interiorImages = images.filter(i => i.image_type === "interior").map(i => resolveFileUrl(i.image_url));
  const auctionImages = images.filter(i => i.image_type === "auction").map(i => resolveFileUrl(i.image_url));
  const allImageUrls = images.map(i => resolveFileUrl(i.image_url));

  let parsedFeatures = [];
  if (row.features) {
    try {
      parsedFeatures = JSON.parse(row.features);
    } catch (e) {
      parsedFeatures = String(row.features).split(",").map(f => f.trim()).filter(Boolean);
    }
  }

  const defaultFallback = "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800";
  const cover = exteriorImages[0] || allImageUrls[0] || defaultFallback;

  // Resolve auction sheet URL and enforce auctionSheetAvailable logic
  const rawSheet = row.auction_sheet_url || (auctionImages[0] || "");
  const resolvedSheetUrl = resolveFileUrl(rawSheet);
  const hasAuctionSheet = Boolean(rawSheet && rawSheet.trim() !== "");
  const auctionSheetAvailable = Boolean(row.auction_sheet_available) && hasAuctionSheet;

  return {
    id: String(row.id),
    dbId: row.id,
    displayOrder: row.display_order ?? 0,
    featuredPosition: row.featured_position ?? 0,
    isNewArrival: Boolean(row.is_new_arrival),
    slug: row.slug,
    stockNumber: row.stock_number,
    featured: Boolean(row.is_featured),
    published: Boolean(row.is_published),
    status: row.status,
    make: row.make,
    model: row.model,
    grade: row.grade || "",
    year: row.year,
    mileage: row.mileage ?? 0,
    engineCC: row.engine_cc ?? 0,
    fuel: row.fuel || "",
    transmission: row.transmission || "",
    drive: row.drive || "",
    bodyType: row.body_type || "",
    exteriorColor: row.exterior_color || "",
    interiorColor: row.interior_color || "",
    seats: row.seats ?? 5,
    doors: row.doors ?? 4,
    chassisNumber: row.chassis_number || "",
    registration: row.registration || "",
    steering: row.steering || "",
    accidentHistory: row.accident_history || "None",
    purchasePrice: row.purchase_price ?? 0,
    price: row.price ?? 0,
    currency: row.currency || "BDT",
    negotiable: Boolean(row.negotiable),
    shortDescription: row.short_description || "",
    description: row.description || "",
    features: parsedFeatures,
    auctionGrade: row.auction_grade || "",
    auctionSheetAvailable,
    auctionSheetUrl: resolvedSheetUrl,
    youtubeUrl: row.youtube_url || "",
    arrivalDate: row.arrival_date || "",
    archivedAt: row.archived_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: allImageUrls.length > 0 ? allImageUrls : [cover],
    exteriorImages: exteriorImages.length > 0 ? exteriorImages : [cover],
    interiorImages: interiorImages,
    coverImage: cover,
    posterImage: cover
  };
}

/**
 * Fetch a single vehicle with its images by numeric ID, stock number, or slug
 */
export async function getVehicleByIdOrStock(db, idOrStockOrSlug) {
  let row = null;
  if (/^\d+$/.test(idOrStockOrSlug)) {
    row = await db.prepare(`SELECT * FROM vehicles WHERE id = ?`).bind(parseInt(idOrStockOrSlug, 10)).first();
  }
  if (!row) {
    row = await db.prepare(`SELECT * FROM vehicles WHERE LOWER(stock_number) = LOWER(?) OR slug = ?`).bind(idOrStockOrSlug, idOrStockOrSlug).first();
  }
  if (!row) return null;

  const imagesRes = await db.prepare(`SELECT * FROM vehicle_images WHERE vehicle_id = ? ORDER BY display_order ASC, id ASC`).bind(row.id).all();
  const images = imagesRes?.results || [];

  return mapDbToVehicle(row, images);
}

/**
 * GET /api/v1/admin/vehicles - Admin Vehicle Listing with search, filter, pagination
 */
export async function listAdminVehicles(request, env) {
  const auth = await authenticate(request, env, "vehicles.view");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") || "").trim();
    const status = url.searchParams.get("status") || "all";
    const make = url.searchParams.get("make") || "all";
    const sort = url.searchParams.get("sort") || "date-desc";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10)));

    let sqlWhere = [];
    let params = [];

    if (search) {
      sqlWhere.push(`(
        LOWER(stock_number) LIKE ? OR
        LOWER(make) LIKE ? OR
        LOWER(model) LIKE ? OR
        LOWER(chassis_number) LIKE ? OR
        LOWER(registration) LIKE ? OR
        CAST(year AS TEXT) LIKE ?
      )`);
      const term = `%${search.toLowerCase()}%`;
      params.push(term, term, term, term, term, term);
    }

    if (status && status !== "all") {
      if (status === "archived") {
        sqlWhere.push(`archived_at IS NOT NULL`);
      } else {
        sqlWhere.push(`status = ? AND archived_at IS NULL`);
        params.push(status);
      }
    } else {
      sqlWhere.push(`archived_at IS NULL`);
    }

    if (make && make !== "all") {
      sqlWhere.push(`LOWER(make) = LOWER(?)`);
      params.push(make);
    }

    const whereClause = sqlWhere.length > 0 ? `WHERE ${sqlWhere.join(" AND ")}` : "";

    let orderBy = "ORDER BY created_at DESC";
    if (sort === "price-asc") orderBy = "ORDER BY price ASC";
    else if (sort === "price-desc") orderBy = "ORDER BY price DESC";
    else if (sort === "year-desc") orderBy = "ORDER BY year DESC";
    else if (sort === "year-asc") orderBy = "ORDER BY year ASC";
    else if (sort === "stock-asc") orderBy = "ORDER BY stock_number ASC";
    else if (sort === "date-asc") orderBy = "ORDER BY created_at ASC";

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
    console.error("List admin vehicles error:", error);
    return serverError("Failed to fetch vehicles.");
  }
}

/**
 * GET /api/v1/admin/vehicles/:id - Get detailed vehicle
 */
export async function getAdminVehicle(request, env, ctx, params) {
  const auth = await authenticate(request, env, "vehicles.view");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const vehicle = await getVehicleByIdOrStock(env.DB, params.id);
    if (!vehicle) return notFound("Vehicle not found.");
    return success(vehicle);
  } catch (error) {
    console.error("Get admin vehicle error:", error);
    return serverError("Failed to fetch vehicle.");
  }
}

/**
 * POST /api/v1/admin/vehicles - Create vehicle
 */
export async function createAdminVehicle(request, env) {
  const auth = await authenticate(request, env, "vehicles.create");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);

  try {
    const data = await request.json();
    if (!data.stockNumber || !data.make || !data.model || !data.year || data.price === undefined || !data.status) {
      return validationError("Please provide all required fields: stockNumber, make, model, year, price, status.");
    }

    const existing = await env.DB.prepare(`SELECT id FROM vehicles WHERE LOWER(stock_number) = LOWER(?)`).bind(data.stockNumber.trim()).first();
    if (existing) {
      return badRequest(`Stock number "${data.stockNumber}" already exists.`);
    }

    const now = new Date().toISOString();
    const slug = data.slug || `${data.make.toLowerCase()}-${data.model.toLowerCase()}-${data.year}-${Math.floor(1000 + Math.random() * 9000)}`;
    const featuresJson = JSON.stringify(data.features || []);

    // Normalize and enforce auction sheet availability logic
    const rawSheet = data.auctionSheetUrl || "";
    const sheetKey = extractObjectKey(rawSheet);
    const sheetAvailable = sheetKey !== "" && data.auctionSheetAvailable ? 1 : 0;

    const result = await env.DB.prepare(`
      INSERT INTO vehicles (
        slug, stock_number, make, model, year, status, is_published, is_featured, featured_position, is_new_arrival,
        display_order, grade, auction_grade, mileage, engine_cc, transmission,
        fuel, drive, body_type, exterior_color, interior_color, seats, doors,
        chassis_number, registration, steering, accident_history, purchase_price,
        price, currency, negotiable, short_description, description, features,
        auction_sheet_available, auction_sheet_url, youtube_url, arrival_date,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `).bind(
      slug, data.stockNumber.trim(), data.make.trim(), data.model.trim(), parseInt(data.year, 10), data.status,
      data.published !== false ? 1 : 0, data.featured ? 1 : 0,
      data.featuredPosition !== undefined ? parseInt(data.featuredPosition, 10) : 0,
      data.isNewArrival ? 1 : 0,
      parseInt(data.displayOrder || 0, 10), data.grade || "", data.auctionGrade || "",
      data.mileage ? parseInt(data.mileage, 10) : 0, data.engineCC ? parseInt(data.engineCC, 10) : 0,
      data.transmission || "", data.fuel || "", data.drive || "", data.bodyType || "",
      data.exteriorColor || "", data.interiorColor || "",
      data.seats ? parseInt(data.seats, 10) : 5, data.doors ? parseInt(data.doors, 10) : 4,
      data.chassisNumber || "", data.registration || "", data.steering || "",
      data.accidentHistory || "None", data.purchasePrice ? parseFloat(data.purchasePrice) : 0,
      parseFloat(data.price), data.currency || "BDT", data.negotiable ? 1 : 0,
      data.shortDescription || "", data.description || "", featuresJson,
      sheetAvailable, sheetKey,
      data.youtubeUrl || "", data.arrivalDate || "",
      now, now
    ).run();

    const vehicleId = result.meta.last_row_id;

    // Handle Exterior Images - store clean object keys
    const extImages = data.exteriorImages || data.images || [];
    let order = 1;
    for (const url of extImages) {
      const cleanKey = extractObjectKey(url);
      if (cleanKey) {
        await env.DB.prepare(`
          INSERT INTO vehicle_images (vehicle_id, image_type, image_url, display_order, created_at)
          VALUES (?, 'exterior', ?, ?, ?)
        `).bind(vehicleId, cleanKey, order++, now).run();
      }
    }

    // Handle Interior Images - store clean object keys
    const intImages = data.interiorImages || [];
    order = 1;
    for (const url of intImages) {
      const cleanKey = extractObjectKey(url);
      if (cleanKey) {
        await env.DB.prepare(`
          INSERT INTO vehicle_images (vehicle_id, image_type, image_url, display_order, created_at)
          VALUES (?, 'interior', ?, ?, ?)
        `).bind(vehicleId, cleanKey, order++, now).run();
      }
    }

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "CREATE_VEHICLE",
      resourceType: "vehicle",
      resourceId: String(vehicleId),
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: JSON.stringify({ stockNumber: data.stockNumber, make: data.make, model: data.model })
    });

    const createdVehicle = await getVehicleByIdOrStock(env.DB, String(vehicleId));
    return created(createdVehicle, "Vehicle created successfully.");
  } catch (error) {
    console.error("Create admin vehicle error:", error);
    return serverError("Failed to create vehicle.");
  }
}

/**
 * PUT /api/v1/admin/vehicles/:id - Update vehicle
 */
export async function updateAdminVehicle(request, env, ctx, params) {
  const auth = await authenticate(request, env, "vehicles.edit");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);

  try {
    const existingVehicle = await getVehicleByIdOrStock(env.DB, params.id);
    if (!existingVehicle) return notFound("Vehicle not found.");

    const dbId = existingVehicle.dbId;
    const data = await request.json();
    const now = new Date().toISOString();

    if (data.stockNumber && data.stockNumber.trim().toLowerCase() !== existingVehicle.stockNumber.toLowerCase()) {
      const dupe = await env.DB.prepare(`SELECT id FROM vehicles WHERE LOWER(stock_number) = LOWER(?) AND id != ?`).bind(data.stockNumber.trim(), dbId).first();
      if (dupe) {
        return badRequest(`Stock number "${data.stockNumber}" is already in use by another vehicle.`);
      }
    }

    const featuresJson = JSON.stringify(data.features !== undefined ? data.features : existingVehicle.features);

    // Collect existing keys prior to update for orphan detection
    const oldKeys = new Set();
    if (existingVehicle.auctionSheetUrl) oldKeys.add(extractObjectKey(existingVehicle.auctionSheetUrl));
    if (existingVehicle.images && Array.isArray(existingVehicle.images)) {
      existingVehicle.images.forEach(img => oldKeys.add(extractObjectKey(img)));
    }

    // Normalize auction sheet URL and enforce availability logic
    const rawSheet = data.auctionSheetUrl !== undefined ? data.auctionSheetUrl : existingVehicle.auctionSheetUrl;
    const sheetKey = extractObjectKey(rawSheet);
    const requestedSheetAvailable = data.auctionSheetAvailable !== undefined ? Boolean(data.auctionSheetAvailable) : Boolean(existingVehicle.auctionSheetAvailable);
    const sheetAvailable = sheetKey !== "" && requestedSheetAvailable ? 1 : 0;

    await env.DB.prepare(`
      UPDATE vehicles SET
        stock_number = ?, make = ?, model = ?, year = ?, status = ?,
        is_published = ?, is_featured = ?, featured_position = ?, is_new_arrival = ?, display_order = ?, grade = ?,
        auction_grade = ?, mileage = ?, engine_cc = ?, transmission = ?,
        fuel = ?, drive = ?, body_type = ?, exterior_color = ?, interior_color = ?,
        seats = ?, doors = ?, chassis_number = ?, registration = ?, steering = ?,
        accident_history = ?, purchase_price = ?, price = ?, currency = ?,
        negotiable = ?, short_description = ?, description = ?, features = ?,
        auction_sheet_available = ?, auction_sheet_url = ?, youtube_url = ?,
        arrival_date = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      (data.stockNumber || existingVehicle.stockNumber).trim(),
      (data.make || existingVehicle.make).trim(),
      (data.model || existingVehicle.model).trim(),
      data.year ? parseInt(data.year, 10) : existingVehicle.year,
      data.status || existingVehicle.status,
      data.published !== undefined ? (data.published ? 1 : 0) : (existingVehicle.published ? 1 : 0),
      data.featured !== undefined ? (data.featured ? 1 : 0) : (existingVehicle.featured ? 1 : 0),
      data.featuredPosition !== undefined ? parseInt(data.featuredPosition, 10) : (data.featured_position !== undefined ? parseInt(data.featured_position, 10) : existingVehicle.featuredPosition),
      data.isNewArrival !== undefined ? (data.isNewArrival ? 1 : 0) : (data.is_new_arrival !== undefined ? (data.is_new_arrival ? 1 : 0) : (existingVehicle.isNewArrival ? 1 : 0)),
      data.displayOrder !== undefined ? parseInt(data.displayOrder, 10) : existingVehicle.displayOrder,
      data.grade !== undefined ? data.grade : existingVehicle.grade,
      data.auctionGrade !== undefined ? data.auctionGrade : existingVehicle.auctionGrade,
      data.mileage !== undefined ? parseInt(data.mileage, 10) : existingVehicle.mileage,
      data.engineCC !== undefined ? parseInt(data.engineCC, 10) : existingVehicle.engineCC,
      data.transmission !== undefined ? data.transmission : existingVehicle.transmission,
      data.fuel !== undefined ? data.fuel : existingVehicle.fuel,
      data.drive !== undefined ? data.drive : existingVehicle.drive,
      data.bodyType !== undefined ? data.bodyType : existingVehicle.bodyType,
      data.exteriorColor !== undefined ? data.exteriorColor : existingVehicle.exteriorColor,
      data.interiorColor !== undefined ? data.interiorColor : existingVehicle.interiorColor,
      data.seats !== undefined ? parseInt(data.seats, 10) : existingVehicle.seats,
      data.doors !== undefined ? parseInt(data.doors, 10) : existingVehicle.doors,
      data.chassisNumber !== undefined ? data.chassisNumber : existingVehicle.chassisNumber,
      data.registration !== undefined ? data.registration : existingVehicle.registration,
      data.steering !== undefined ? data.steering : existingVehicle.steering,
      data.accidentHistory !== undefined ? data.accidentHistory : existingVehicle.accidentHistory,
      data.purchasePrice !== undefined ? parseFloat(data.purchasePrice) : existingVehicle.purchasePrice,
      data.price !== undefined ? parseFloat(data.price) : existingVehicle.price,
      data.currency || existingVehicle.currency || "BDT",
      data.negotiable !== undefined ? (data.negotiable ? 1 : 0) : (existingVehicle.negotiable ? 1 : 0),
      data.shortDescription !== undefined ? data.shortDescription : existingVehicle.shortDescription,
      data.description !== undefined ? data.description : existingVehicle.description,
      featuresJson,
      sheetAvailable,
      sheetKey,
      data.youtubeUrl !== undefined ? data.youtubeUrl : existingVehicle.youtubeUrl,
      data.arrivalDate !== undefined ? data.arrivalDate : existingVehicle.arrivalDate,
      now,
      dbId
    ).run();

    // Re-sync vehicle images if provided
    if (data.exteriorImages || data.interiorImages || data.images) {
      await env.DB.prepare(`DELETE FROM vehicle_images WHERE vehicle_id = ?`).bind(dbId).run();

      const extImages = data.exteriorImages || data.images || [];
      let order = 1;
      for (const url of extImages) {
        const cleanKey = extractObjectKey(url);
        if (cleanKey) {
          await env.DB.prepare(`
            INSERT INTO vehicle_images (vehicle_id, image_type, image_url, display_order, created_at)
            VALUES (?, 'exterior', ?, ?, ?)
          `).bind(dbId, cleanKey, order++, now).run();
        }
      }

      const intImages = data.interiorImages || [];
      order = 1;
      for (const url of intImages) {
        const cleanKey = extractObjectKey(url);
        if (cleanKey) {
          await env.DB.prepare(`
            INSERT INTO vehicle_images (vehicle_id, image_type, image_url, display_order, created_at)
            VALUES (?, 'interior', ?, ?, ?)
          `).bind(dbId, cleanKey, order++, now).run();
        }
      }
    }

    // Clean up orphaned R2 files that are no longer referenced by any vehicle
    for (const oldKey of oldKeys) {
      if (oldKey && oldKey.startsWith("uploads/")) {
        const inUseImg = await env.DB.prepare(`SELECT id FROM vehicle_images WHERE image_url LIKE ?`).bind(`%${oldKey}%`).first();
        const inUseDoc = await env.DB.prepare(`SELECT id FROM vehicles WHERE auction_sheet_url LIKE ?`).bind(`%${oldKey}%`).first();
        if (!inUseImg && !inUseDoc) {
          await deleteStoredFile(env, oldKey);
        }
      }
    }

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "UPDATE_VEHICLE",
      resourceType: "vehicle",
      resourceId: String(dbId),
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: JSON.stringify({ stockNumber: existingVehicle.stockNumber })
    });

    const updated = await getVehicleByIdOrStock(env.DB, String(dbId));
    return success(updated, "Vehicle updated successfully.");
  } catch (error) {
    console.error("Update admin vehicle error:", error);
    return serverError("Failed to update vehicle.");
  }
}

/**
 * DELETE /api/v1/admin/vehicles/:id - Delete vehicle
 */
export async function deleteAdminVehicle(request, env, ctx, params) {
  const auth = await authenticate(request, env, "vehicles.delete");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);

  try {
    const existingVehicle = await getVehicleByIdOrStock(env.DB, params.id);
    if (!existingVehicle) return notFound("Vehicle not found.");

    const dbId = existingVehicle.dbId;

    // Collect candidate R2 keys for orphan cleanup
    const keysToCheck = [];
    if (existingVehicle.auctionSheetUrl) keysToCheck.push(extractObjectKey(existingVehicle.auctionSheetUrl));
    if (existingVehicle.images && Array.isArray(existingVehicle.images)) {
      keysToCheck.push(...existingVehicle.images.map(extractObjectKey));
    }

    await env.DB.prepare(`DELETE FROM vehicle_images WHERE vehicle_id = ?`).bind(dbId).run();
    await env.DB.prepare(`DELETE FROM vehicles WHERE id = ?`).bind(dbId).run();

    // Clean up orphaned R2 files no longer used by any vehicle
    for (const key of keysToCheck) {
      if (key && key.startsWith("uploads/")) {
        const inUseImg = await env.DB.prepare(`SELECT id FROM vehicle_images WHERE image_url LIKE ?`).bind(`%${key}%`).first();
        const inUseDoc = await env.DB.prepare(`SELECT id FROM vehicles WHERE auction_sheet_url LIKE ?`).bind(`%${key}%`).first();
        if (!inUseImg && !inUseDoc) {
          await deleteStoredFile(env, key);
        }
      }
    }

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "DELETE_VEHICLE",
      resourceType: "vehicle",
      resourceId: String(dbId),
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: JSON.stringify({ stockNumber: existingVehicle.stockNumber })
    });

    return success(null, "Vehicle deleted successfully.");
  } catch (error) {
    console.error("Delete admin vehicle error:", error);
    return serverError("Failed to delete vehicle.");
  }
}

/**
 * PUT /api/v1/admin/vehicles/:id/status - Quick status / publish / archive update
 */
export async function updateAdminVehicleStatus(request, env, ctx, params) {
  const auth = await authenticate(request, env, "vehicles.edit");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);

  try {
    const existingVehicle = await getVehicleByIdOrStock(env.DB, params.id);
    if (!existingVehicle) return notFound("Vehicle not found.");

    const dbId = existingVehicle.dbId;
    const body = await request.json();
    const now = new Date().toISOString();

    let newStatus = body.status !== undefined ? body.status : existingVehicle.status;
    let newPublished = body.published !== undefined ? (body.published ? 1 : 0) : (existingVehicle.published ? 1 : 0);
    let newArchivedAt = existingVehicle.archivedAt;

    if (body.archive === true) {
      newArchivedAt = now;
    } else if (body.archive === false) {
      newArchivedAt = null;
    }

    await env.DB.prepare(`
      UPDATE vehicles
      SET status = ?, is_published = ?, archived_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(newStatus, newPublished, newArchivedAt, now, dbId).run();

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: body.published !== undefined ? (body.published ? "PUBLISH_VEHICLE" : "UNPUBLISH_VEHICLE") : "UPDATE_VEHICLE",
      resourceType: "vehicle",
      resourceId: String(dbId),
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: JSON.stringify({ status: newStatus, published: Boolean(newPublished), archivedAt: newArchivedAt })
    });

    const updated = await getVehicleByIdOrStock(env.DB, String(dbId));
    return success(updated, "Vehicle status updated successfully.");
  } catch (error) {
    console.error("Update admin vehicle status error:", error);
    return serverError("Failed to update status.");
  }
}

/**
 * GET /api/v1/admin/dashboard/stats - Dashboard metrics aggregate query
 */
export async function getDashboardStats(request, env) {
  const auth = await authenticate(request, env, "dashboard.view");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const totalRes = await env.DB.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE archived_at IS NULL`).first();
    const availRes = await env.DB.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE status = 'available' AND archived_at IS NULL`).first();
    const incomRes = await env.DB.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE status = 'incoming' AND archived_at IS NULL`).first();
    const resvRes = await env.DB.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE (status = 'reserved' OR status = 'pending') AND archived_at IS NULL`).first();
    const soldRes = await env.DB.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE status = 'sold' AND archived_at IS NULL`).first();

    return success({
      total: totalRes?.c || 0,
      available: availRes?.c || 0,
      incoming: incomRes?.c || 0,
      reserved: resvRes?.c || 0,
      sold: soldRes?.c || 0
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return serverError("Failed to fetch dashboard metrics.");
  }
}

/**
 * POST /api/v1/admin/upload - Generic R2 file & document upload endpoint
 * Uploads media into structured R2 hierarchy: uploads/<company_slug>/vehicles/<stock_number>/<filename>
 */
export async function uploadFile(request, env) {
  const auth = await authenticate(request, env, "vehicles.edit");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return badRequest("No file provided in form request.");
    }

    // Extract stock number context from form payload if provided
    const rawStock = formData.get("stockNumber") || formData.get("stock_number") || formData.get("stock") || "";
    let cleanStock = rawStock.toString().trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "-").replace(/-+/g, "-");
    if (!cleanStock || cleanStock === "-") {
      cleanStock = "general";
    }

    // Fetch active company_slug from database or fallback to slugified name / 'roadlink'
    let companySlug = "roadlink";
    try {
      const settingsRow = await env.DB.prepare("SELECT company_slug, company_name FROM settings WHERE id = 1").first();
      if (settingsRow && settingsRow.company_slug && settingsRow.company_slug.trim()) {
        companySlug = settingsRow.company_slug.trim().toLowerCase();
      } else if (settingsRow && settingsRow.company_name) {
        companySlug = settingsRow.company_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "roadlink";
      }
    } catch (e) {
      companySlug = "roadlink";
    }

    const fileName = file.name || "upload";
    const ext = fileName.split(".").pop().toLowerCase() || "bin";
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const category = (formData.get("category") || formData.get("type") || formData.get("folder") || "").toLowerCase();
    let key = "";

    if (category === "branding" || category === "logo" || category === "favicon") {
      key = `uploads/${companySlug}/branding/${uniqueName}`;
    } else if (category === "carousel" || category === "slide" || category === "hero") {
      key = `uploads/${companySlug}/carousel/${uniqueName}`;
    } else {
      const isDocument = category === "documents" || category === "document" || category === "auction_sheet" || category === "auction-sheet" || ["pdf", "doc", "docx"].includes(ext);
      const mediaSubfolder = isDocument ? "documents" : "images";
      key = `uploads/${companySlug}/vehicles/${cleanStock}/${mediaSubfolder}/${uniqueName}`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const bucket = getStorageBucket(env);

    if (bucket) {
      await bucket.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type || "application/octet-stream"
        }
      });
    } else {
      return serverError("Storage bucket is not configured.");
    }

    const publicUrl = `/api/v1/public/files/${key}`;

    return success({
      url: publicUrl,
      key,
      name: fileName,
      type: file.type || "application/octet-stream"
    }, "File uploaded successfully.");
  } catch (error) {
    console.error("Upload error:", error);
    return serverError(`Failed to upload file: ${error.message}`);
  }
}

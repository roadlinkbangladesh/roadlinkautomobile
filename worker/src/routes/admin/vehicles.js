import { success, created, badRequest, notFound, serverError, validationError } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { logAudit, getRequestMeta } from "../../utils/audit.js";
import { getStorageBucket, extractObjectKey, resolveFileUrl, deleteStoredFile } from "../../utils/storage.js";
import { platformConfig } from "../../services/platform-config.js";
import {
  validateStockNumber,
  validateSlug,
  slugify,
  validateVehicleStateTransition,
  validateFileUpload,
  validateNumber,
  validateString,
  VEHICLE_STATUSES
} from "../../utils/validator.js";
import { purgeArchivedVehicleMedia } from "../../services/vehicle-lifecycle.js";
import { deleteSupersededMedia } from "../../services/orphan-cleanup.js";
import { mapDbToVehicle } from "../../services/vehicle-mapper.js";
import { VehicleRepository } from "../../repositories/vehicle-repository.js";

export { mapDbToVehicle };

/**
 * Fetch a single vehicle with its images by numeric ID, stock number, or slug
 */
export async function getVehicleByIdOrStock(db, idOrStockOrSlug) {
  return await VehicleRepository.findVehicleByIdOrStock(db, idOrStockOrSlug);
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
      } else if (status === "draft") {
        sqlWhere.push(`(LOWER(status) = 'draft' OR is_published = 0) AND archived_at IS NULL`);
      } else {
        sqlWhere.push(`LOWER(status) = LOWER(?) AND archived_at IS NULL`);
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
    const vehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, params.id);
    if (!vehicle) return notFound("Vehicle not found.");
    return success(vehicle);
  } catch (error) {
    console.error("Get admin vehicle error:", error);
    return serverError("Failed to fetch vehicle.");
  }
}

/**
 * POST /api/v1/admin/vehicles - Create vehicle with Platform Policy & Business Rule Enforcement
 */
export async function createAdminVehicle(request, env) {
  const auth = await authenticate(request, env, "vehicles.create");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);
  const config = await platformConfig.getConfig(env);

  try {
    const data = await request.json();

    // 1. Mandatory Field & Type Validation
    const stockErr = validateStockNumber(data.stockNumber);
    if (stockErr) return validationError(stockErr);

    const makeErr = validateString(data.make, { name: "Make", required: true, minLength: 2, maxLength: 50 });
    if (makeErr) return validationError(makeErr);

    const modelErr = validateString(data.model, { name: "Model", required: true, minLength: 1, maxLength: 50 });
    if (modelErr) return validationError(modelErr);

    const yearErr = validateNumber(data.year, { name: "Year", required: true, min: 2000, max: new Date().getFullYear() + 2, integer: true });
    if (yearErr) return validationError(yearErr);

    const priceErr = validateNumber(data.price, { name: "Price", required: true, min: 0 });
    if (priceErr) return validationError(priceErr);

    const status = (data.status || "available").toLowerCase();
    const transitionErr = validateVehicleStateTransition("draft", status);
    if (transitionErr) return validationError(transitionErr);

    // 2. Business Rule: Featured vehicles CANNOT be Archived
    let isFeatured = data.featured ? 1 : 0;
    if (status === "archived" && isFeatured) {
      return badRequest("Featured vehicles cannot be set to Archived status.");
    }

    // 3. Case-Insensitive Uniqueness Check for Stock Number
    const existingStock = await VehicleRepository.findByStockNumber(env.DB, data.stockNumber.trim());
    if (existingStock) {
      return badRequest(`Stock number "${data.stockNumber}" already exists.`);
    }

    // 4. Case-Insensitive Uniqueness Check for Slug
    let rawSlug = (data.slug || "").trim();
    let slug = slugify(rawSlug);
    if (!slug) {
      slug = slugify(`${data.make} ${data.model} ${data.year} ${Math.floor(1000 + Math.random() * 9000)}`);
    }
    const slugErr = validateSlug(slug);
    if (slugErr) return validationError(slugErr);

    const existingSlug = await VehicleRepository.findBySlug(env.DB, slug);
    if (existingSlug) {
      slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // 5. Image Count Policy Check
    const extImages = data.exteriorImages || data.images || [];
    const intImages = data.interiorImages || [];
    const totalImageCount = extImages.length + intImages.length;
    if (totalImageCount > config.max_vehicle_images) {
      return badRequest(`Vehicle exceeds maximum allowed image limit of ${config.max_vehicle_images} images (Provided: ${totalImageCount}).`);
    }

    const now = new Date().toISOString();
    const archivedAt = status === "archived" ? now : null;
    const featuresJson = JSON.stringify(data.features || []);

    // Normalize auction sheet
    const rawSheet = data.auctionSheetUrl || "";
    const sheetKey = extractObjectKey(rawSheet);
    const sheetAvailable = sheetKey !== "" && data.auctionSheetAvailable ? 1 : 0;

    const result = await VehicleRepository.insertVehicle(env.DB, {
      slug,
      stockNumber: data.stockNumber.trim(),
      make: data.make.trim(),
      model: data.model.trim(),
      year: parseInt(data.year, 10),
      status,
      isPublished: data.published !== false ? 1 : 0,
      isFeatured,
      featuredPosition: data.featuredPosition !== undefined ? parseInt(data.featuredPosition, 10) : 0,
      isNewArrival: data.isNewArrival ? 1 : 0,
      displayOrder: parseInt(data.displayOrder || 0, 10),
      grade: data.grade || "",
      auctionGrade: data.auctionGrade || "",
      mileage: data.mileage ? parseInt(data.mileage, 10) : 0,
      engineCC: data.engineCC ? parseInt(data.engineCC, 10) : 0,
      transmission: data.transmission || "",
      fuel: data.fuel || "",
      drive: data.drive || "",
      bodyType: data.bodyType || "",
      exteriorColor: data.exteriorColor || "",
      interiorColor: data.interiorColor || "",
      seats: data.seats ? parseInt(data.seats, 10) : 5,
      doors: data.doors ? parseInt(data.doors, 10) : 4,
      chassisNumber: data.chassisNumber || "",
      registration: data.registration || "",
      steering: data.steering || "",
      accidentHistory: data.accidentHistory || "None",
      purchasePrice: data.purchasePrice ? parseFloat(data.purchasePrice) : 0,
      price: parseFloat(data.price),
      currency: data.currency || "BDT",
      negotiable: data.negotiable ? 1 : 0,
      shortDescription: data.shortDescription || "",
      description: data.description || "",
      featuresJson,
      auctionSheetAvailable: sheetAvailable,
      auctionSheetUrl: sheetKey,
      youtubeUrl: data.youtubeUrl || "",
      arrivalDate: data.arrivalDate || "",
      archivedAt,
      createdAt: now,
      updatedAt: now
    });

    const vehicleId = result.meta.last_row_id;

    // Handle Exterior Images - store clean object keys
    let order = 1;
    for (const url of extImages) {
      const cleanKey = extractObjectKey(url);
      if (cleanKey) {
        await VehicleRepository.insertVehicleImage(env.DB, vehicleId, "exterior", cleanKey, order++, now);
      }
    }

    // Handle Interior Images - store clean object keys
    order = 1;
    for (const url of intImages) {
      const cleanKey = extractObjectKey(url);
      if (cleanKey) {
        await VehicleRepository.insertVehicleImage(env.DB, vehicleId, "interior", cleanKey, order++, now);
      }
    }

    // If created directly in archived state, purge media as per retention rule
    if (status === "archived") {
      await purgeArchivedVehicleMedia(env, vehicleId);
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
      details: JSON.stringify({ stockNumber: data.stockNumber, make: data.make, model: data.model, status })
    });

    const createdVehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, String(vehicleId));
    return created(createdVehicle, "Vehicle created successfully.");
  } catch (error) {
    console.error("Create admin vehicle error:", error);
    return serverError(error?.message || "Failed to create vehicle.");
  }
}

/**
 * PUT /api/v1/admin/vehicles/:id - Update vehicle with Domain & Platform Policy Validation
 */
export async function updateAdminVehicle(request, env, ctx, params) {
  const auth = await authenticate(request, env, "vehicles.edit");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);
  const config = await platformConfig.getConfig(env);

  try {
    const existingVehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, params.id);
    if (!existingVehicle) return notFound("Vehicle not found.");

    const dbId = existingVehicle.dbId;
    const data = await request.json();
    const now = new Date().toISOString();

    // 1. Validate Stock Number if changing
    const newStockNumber = data.stockNumber !== undefined ? data.stockNumber.trim() : existingVehicle.stockNumber;
    if (newStockNumber.toLowerCase() !== existingVehicle.stockNumber.toLowerCase()) {
      const stockErr = validateStockNumber(newStockNumber);
      if (stockErr) return validationError(stockErr);

      const dupe = await VehicleRepository.findByStockNumber(env.DB, newStockNumber, dbId);
      if (dupe) {
        return badRequest(`Stock number "${newStockNumber}" is already in use by another vehicle.`);
      }
    }

    // 2. Validate Vehicle Status Transition
    const currentStatus = existingVehicle.status;
    const newStatus = data.status !== undefined ? data.status.toLowerCase() : currentStatus;
    const isRestore = data.restore === true || (currentStatus === "sold" && newStatus === "available" && data.confirmRestore === true);

    const transitionErr = validateVehicleStateTransition(currentStatus, newStatus, isRestore);
    if (transitionErr) return validationError(transitionErr);

    // 3. Business Rule: Featured vehicles CANNOT be Archived
    let newFeatured = data.featured !== undefined ? (data.featured ? 1 : 0) : (existingVehicle.featured ? 1 : 0);
    if (newStatus === "archived" && newFeatured) {
      return badRequest("Featured vehicles cannot be Archived. Please un-feature the vehicle before archiving.");
    }

    // 4. Image count policy check
    const extImages = data.exteriorImages || data.images || [];
    const intImages = data.interiorImages || [];
    if ((data.exteriorImages || data.interiorImages || data.images) && (extImages.length + intImages.length > config.max_vehicle_images)) {
      return badRequest(`Vehicle exceeds maximum allowed image limit of ${config.max_vehicle_images} images.`);
    }

    const featuresJson = JSON.stringify(data.features !== undefined ? data.features : existingVehicle.features);

    // Handle auction sheet & media replacement
    const rawSheet = data.auctionSheetUrl !== undefined ? data.auctionSheetUrl : existingVehicle.auctionSheetUrl;
    const sheetKey = extractObjectKey(rawSheet);
    const oldSheetKey = extractObjectKey(existingVehicle.auctionSheetUrl);

    if (data.auctionSheetUrl !== undefined && sheetKey !== oldSheetKey) {
      await deleteSupersededMedia(env, oldSheetKey, sheetKey);
    }

    const requestedSheetAvailable = data.auctionSheetAvailable !== undefined ? Boolean(data.auctionSheetAvailable) : Boolean(existingVehicle.auctionSheetAvailable);
    const sheetAvailable = sheetKey !== "" && requestedSheetAvailable ? 1 : 0;

    let archivedAt = existingVehicle.archivedAt;
    if (newStatus === "archived" && !archivedAt) {
      archivedAt = now;
      newFeatured = 0; // Automatically clear featured status on archive
    } else if (newStatus !== "archived") {
      archivedAt = null;
    }

    await VehicleRepository.updateVehicle(env.DB, dbId, {
      stockNumber: newStockNumber,
      make: (data.make || existingVehicle.make).trim(),
      model: (data.model || existingVehicle.model).trim(),
      year: data.year ? parseInt(data.year, 10) : existingVehicle.year,
      status: newStatus,
      isPublished: data.published !== undefined ? (data.published ? 1 : 0) : (existingVehicle.published ? 1 : 0),
      isFeatured: newFeatured,
      featuredPosition: data.featuredPosition !== undefined ? parseInt(data.featuredPosition, 10) : existingVehicle.featuredPosition,
      isNewArrival: data.isNewArrival !== undefined ? (data.isNewArrival ? 1 : 0) : (existingVehicle.isNewArrival ? 1 : 0),
      displayOrder: data.displayOrder !== undefined ? parseInt(data.displayOrder, 10) : existingVehicle.displayOrder,
      grade: data.grade !== undefined ? data.grade : existingVehicle.grade,
      auctionGrade: data.auctionGrade !== undefined ? data.auctionGrade : existingVehicle.auctionGrade,
      mileage: data.mileage !== undefined ? parseInt(data.mileage, 10) : existingVehicle.mileage,
      engineCC: data.engineCC !== undefined ? parseInt(data.engineCC, 10) : existingVehicle.engineCC,
      transmission: data.transmission !== undefined ? data.transmission : existingVehicle.transmission,
      fuel: data.fuel !== undefined ? data.fuel : existingVehicle.fuel,
      drive: data.drive !== undefined ? data.drive : existingVehicle.drive,
      bodyType: data.bodyType !== undefined ? data.bodyType : existingVehicle.bodyType,
      exteriorColor: data.exteriorColor !== undefined ? data.exteriorColor : existingVehicle.exteriorColor,
      interiorColor: data.interiorColor !== undefined ? data.interiorColor : existingVehicle.interiorColor,
      seats: data.seats !== undefined ? parseInt(data.seats, 10) : existingVehicle.seats,
      doors: data.doors !== undefined ? parseInt(data.doors, 10) : existingVehicle.doors,
      chassisNumber: data.chassisNumber !== undefined ? data.chassisNumber : existingVehicle.chassisNumber,
      registration: data.registration !== undefined ? data.registration : existingVehicle.registration,
      steering: data.steering !== undefined ? data.steering : existingVehicle.steering,
      accidentHistory: data.accidentHistory !== undefined ? data.accidentHistory : existingVehicle.accidentHistory,
      purchasePrice: data.purchasePrice !== undefined ? parseFloat(data.purchasePrice) : existingVehicle.purchasePrice,
      price: data.price !== undefined ? parseFloat(data.price) : existingVehicle.price,
      currency: data.currency || existingVehicle.currency || "BDT",
      negotiable: data.negotiable !== undefined ? (data.negotiable ? 1 : 0) : (existingVehicle.negotiable ? 1 : 0),
      shortDescription: data.shortDescription !== undefined ? data.shortDescription : existingVehicle.shortDescription,
      description: data.description !== undefined ? data.description : existingVehicle.description,
      featuresJson,
      auctionSheetAvailable: sheetAvailable,
      auctionSheetUrl: sheetKey,
      youtubeUrl: data.youtubeUrl !== undefined ? data.youtubeUrl : existingVehicle.youtubeUrl,
      arrivalDate: data.arrivalDate !== undefined ? data.arrivalDate : existingVehicle.arrivalDate,
      archivedAt,
      updatedAt: now
    });

    // Re-sync vehicle images if provided
    if (data.exteriorImages || data.interiorImages || data.images) {
      const oldImages = await VehicleRepository.findVehicleImages(env.DB, dbId);

      await VehicleRepository.deleteVehicleImages(env.DB, dbId);

      const newKeys = new Set();

      let order = 1;
      for (const url of extImages) {
        const cleanKey = extractObjectKey(url);
        if (cleanKey) {
          newKeys.add(cleanKey);
          await VehicleRepository.insertVehicleImage(env.DB, dbId, "exterior", cleanKey, order++, now);
        }
      }

      order = 1;
      for (const url of intImages) {
        const cleanKey = extractObjectKey(url);
        if (cleanKey) {
          newKeys.add(cleanKey);
          await VehicleRepository.insertVehicleImage(env.DB, dbId, "interior", cleanKey, order++, now);
        }
      }

      // Delete removed image keys immediately from R2
      for (const oldImg of oldImages) {
        const oldK = extractObjectKey(oldImg.image_url);
        if (oldK && !newKeys.has(oldK)) {
          await deleteSupersededMedia(env, oldK, null);
        }
      }
    }

    // If transitioned to archived status, purge media
    if (newStatus === "archived") {
      await purgeArchivedVehicleMedia(env, dbId);
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
      details: JSON.stringify({ stockNumber: newStockNumber, status: newStatus })
    });

    const updated = await VehicleRepository.findVehicleByIdOrStock(env.DB, String(dbId));
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
    const existingVehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, params.id);
    if (!existingVehicle) return notFound("Vehicle not found.");

    const dbId = existingVehicle.dbId;

    // Purge associated R2 media files
    await purgeArchivedVehicleMedia(env, dbId);

    // Remove DB rows
    await VehicleRepository.deleteVehicleImages(env.DB, dbId);
    await VehicleRepository.deleteVehicle(env.DB, dbId);

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
    const existingVehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, params.id);
    if (!existingVehicle) return notFound("Vehicle not found.");

    const dbId = existingVehicle.dbId;
    const body = await request.json();
    const now = new Date().toISOString();

    let newStatus = body.status !== undefined ? body.status.toLowerCase() : existingVehicle.status;
    let newPublished = body.published !== undefined ? (body.published ? 1 : 0) : (existingVehicle.published ? 1 : 0);
    let newArchivedAt = existingVehicle.archivedAt;

    if (body.archive === true || newStatus === "archived") {
      if (existingVehicle.featured) {
        return badRequest("Featured vehicles cannot be archived. Please un-feature the vehicle first.");
      }
      newStatus = "archived";
      newArchivedAt = now;
      newPublished = 0;
    } else if (body.archive === false) {
      newArchivedAt = null;
      if (newStatus === "archived") newStatus = "available";
    }

    const transitionErr = validateVehicleStateTransition(existingVehicle.status, newStatus, body.confirmRestore === true);
    if (transitionErr) return validationError(transitionErr);

    await VehicleRepository.updateVehicleStatus(env.DB, dbId, newStatus, newPublished, newArchivedAt, now);

    if (newStatus === "archived") {
      await purgeArchivedVehicleMedia(env, dbId);
    }

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: body.published !== undefined ? (body.published ? "PUBLISH_VEHICLE" : "UNPUBLISH_VEHICLE") : "UPDATE_VEHICLE_STATUS",
      resourceType: "vehicle",
      resourceId: String(dbId),
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: JSON.stringify({ status: newStatus, published: Boolean(newPublished), archivedAt: newArchivedAt })
    });

    const updated = await VehicleRepository.findVehicleByIdOrStock(env.DB, String(dbId));
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
    const stats = await VehicleRepository.getDashboardStats(env.DB);
    return success(stats);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return serverError("Failed to fetch dashboard metrics.");
  }
}

/**
 * POST /api/v1/admin/upload - Generic R2 file & document upload endpoint
 * Strictly validates file sizes & MIME types using Platform Configuration
 * Path format: uploads/<company_slug>/vehicles/<stock_number>/<exterior|interior|documents>/<filename>
 */
export async function uploadFile(request, env) {
  const auth = await authenticate(request, env, "vehicles.edit");
  if (auth.errorResponse) return auth.errorResponse;

  const config = await platformConfig.getConfig(env);

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return badRequest("No file provided in form request.");
    }

    const category = (formData.get("category") || formData.get("type") || formData.get("folder") || "").toLowerCase();

    // Validate file size, type & bounds using platform policies
    const uploadErr = validateFileUpload(file, category, config);
    if (uploadErr) {
      return badRequest(uploadErr);
    }

    // Extract stock number context from form payload if provided
    const rawStock = formData.get("stockNumber") || formData.get("stock_number") || formData.get("stock") || "";
    let cleanStock = rawStock.toString().trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "-").replace(/-+/g, "-");
    if (!cleanStock || cleanStock === "-") {
      cleanStock = "general";
    }

    // Fetch active company_slug
    let companySlug = "roadlink";
    try {
      const settingsRow = await env.DB.prepare("SELECT company_slug FROM settings WHERE id = 1").first();
      if (settingsRow && settingsRow.company_slug && settingsRow.company_slug.trim()) {
        companySlug = settingsRow.company_slug.trim().toLowerCase();
      }
    } catch (e) {
      companySlug = "roadlink";
    }

    const fileName = file.name || "upload";
    const ext = fileName.split(".").pop().toLowerCase() || "bin";
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    let key = "";

    if (category === "branding" || category === "logo" || category === "favicon") {
      key = `uploads/${companySlug}/branding/${uniqueName}`;
    } else if (category === "carousel" || category === "slide" || category === "hero") {
      key = `uploads/${companySlug}/carousel/${uniqueName}`;
    } else {
      const isDocument = category === "documents" || category === "document" || category === "auction_sheet" || category === "auction-sheet" || ext === "pdf";
      const mediaSubfolder = isDocument ? "documents" : (category === "interior" ? "interior" : "exterior");
      key = `uploads/${companySlug}/vehicles/${cleanStock}/${mediaSubfolder}/${uniqueName}`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const bucket = getStorageBucket(env);

    if (bucket) {
      await bucket.put(key, arrayBuffer, {
        httpMetadata: {
          contentType: file.type || (ext === "pdf" ? "application/pdf" : "image/jpeg")
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

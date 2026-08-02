import { VehicleRepository } from "../repositories/vehicle-repository.js";
import { mapDbToVehicle } from "./vehicle-mapper.js";
import { platformConfig } from "./platform-config.js";
import { purgeArchivedVehicleMedia } from "./vehicle-lifecycle.js";
import { deleteSupersededMedia } from "./orphan-cleanup.js";
import { logAudit } from "../utils/audit.js";
import { getStorageBucket, extractObjectKey } from "../utils/storage.js";
import {
  validateStockNumber,
  validateSlug,
  slugify,
  validateVehicleStateTransition,
  validateFileUpload,
  validateNumber,
  validateString,
  escapeSqlWildcards
} from "../utils/validator.js";

export class VehicleServiceError extends Error {
  constructor(message, type = "BAD_REQUEST", details = null) {
    super(message);
    this.name = "VehicleServiceError";
    this.type = type; // "VALIDATION_ERROR" | "BAD_REQUEST" | "NOT_FOUND" | "SERVER_ERROR"
    this.details = details;
  }
}

export class VehicleService {
  /**
   * Automatically reorders featured vehicles to guarantee unique, sequential positions (1, 2, 3...)
   * when a vehicle's featured status or position changes.
   */
  static async syncFeaturedPositions(db, targetDbId, isFeatured, requestedPos) {
    targetDbId = Number(targetDbId);
    
    if (!isFeatured) {
      await db.prepare(`UPDATE vehicles SET is_featured = 0, featured_position = 0 WHERE id = ?`).bind(targetDbId).run();
      
      const { results } = await db.prepare(`
        SELECT id, featured_position FROM vehicles 
        WHERE is_featured = 1 AND archived_at IS NULL AND id != ?
        ORDER BY CASE WHEN featured_position > 0 THEN featured_position ELSE 999 END ASC, updated_at DESC
      `).bind(targetDbId).all();

      if (results && results.length > 0) {
        for (let i = 0; i < results.length; i++) {
          const newPos = i + 1;
          if (results[i].featured_position !== newPos) {
            await db.prepare(`UPDATE vehicles SET featured_position = ? WHERE id = ?`).bind(newPos, results[i].id).run();
          }
        }
      }
      return;
    }

    let pos = parseInt(requestedPos, 10);
    if (isNaN(pos) || pos < 1) pos = 1;

    const { results } = await db.prepare(`
      SELECT id, featured_position FROM vehicles 
      WHERE is_featured = 1 AND archived_at IS NULL AND id != ?
      ORDER BY CASE WHEN featured_position > 0 THEN featured_position ELSE 999 END ASC, updated_at DESC
    `).bind(targetDbId).all();

    const otherList = results ? [...results] : [];
    const targetIdx = Math.min(Math.max(0, pos - 1), otherList.length);
    otherList.splice(targetIdx, 0, { id: targetDbId, featured_position: pos });

    for (let i = 0; i < otherList.length; i++) {
      const correctPos = i + 1;
      const vItem = otherList[i];
      if (vItem.id === targetDbId) {
        await db.prepare(`UPDATE vehicles SET is_featured = 1, featured_position = ? WHERE id = ?`).bind(correctPos, targetDbId).run();
      } else if (vItem.featured_position !== correctPos) {
        await db.prepare(`UPDATE vehicles SET featured_position = ? WHERE id = ?`).bind(correctPos, vItem.id).run();
      }
    }
  }

  /**
   * Fetch a single vehicle with its images by numeric ID, stock number, or slug
   */
  static async getVehicleByIdOrStock(db, idOrStockOrSlug, options = {}) {
    return await VehicleRepository.findVehicleByIdOrStock(db, idOrStockOrSlug, options);
  }

  /**
   * Admin Vehicle Listing with search, filter, pagination
   */
  static async listAdminVehicles(db, { search = "", status = "all", make = "all", sort = "date-desc", page = 1, limit = 100 }) {
    const cleanSearch = (search || "").trim();
    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || "100", 10)));

    let sqlWhere = [];
    let params = [];

    if (cleanSearch) {
      sqlWhere.push(`(
        LOWER(stock_number) LIKE ? ESCAPE '\\' OR
        LOWER(make) LIKE ? ESCAPE '\\' OR
        LOWER(model) LIKE ? ESCAPE '\\' OR
        LOWER(chassis_number) LIKE ? ESCAPE '\\' OR
        LOWER(registration) LIKE ? ESCAPE '\\' OR
        CAST(year AS TEXT) LIKE ? ESCAPE '\\'
      )`);
      const term = `%${escapeSqlWildcards(cleanSearch.toLowerCase())}%`;
      params.push(term, term, term, term, term, term);
    }

    if (status && status !== "all") {
      if (status === "archived") {
        sqlWhere.push(`archived_at IS NOT NULL`);
      } else if (status === "draft" || status === "unpublished") {
        sqlWhere.push(`is_published = 0 AND archived_at IS NULL`);
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

    const totalItems = await VehicleRepository.countVehicles(db, whereClause, params);

    const offset = (pageNum - 1) * limitNum;
    const rows = await VehicleRepository.findVehicles(db, whereClause, orderBy, params, limitNum, offset);

    const vehicleIds = rows.map(r => r.id);
    const imagesMap = await VehicleRepository.findImagesForVehicleIds(db, vehicleIds);

    const vehicles = rows.map(row => {
      const images = imagesMap.get(row.id) || [];
      return mapDbToVehicle(row, images, { isAdmin: true });
    });

    return {
      items: vehicles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum) || 1
      }
    };
  }

  /**
   * Public Vehicle Inventory Listing with search, filter, pagination
   */
  static async listPublicVehicles(env, queryParams = {}) {
    const search = (queryParams.search || "").trim();
    const category = (queryParams.category || queryParams.bodyType || "all").toLowerCase();
    const make = (queryParams.make || "all").toLowerCase();
    const status = queryParams.status;
    const featured = queryParams.featured;
    const includeSold = queryParams.includeSold === true || queryParams.includeSold === "true";
    const sort = queryParams.sort || "order-asc";
    const page = Math.max(1, parseInt(queryParams.page || "1", 10));

    // Fetch settings for sold vehicles and featured limit defaults
    const settings = await env.DB.prepare(`SELECT show_sold_vehicles, featured_vehicles_limit FROM settings WHERE id = 1`).first();
    const showSoldVehicles = Boolean(settings?.show_sold_vehicles);
    const featuredLimit = Math.min(9, Math.max(1, settings?.featured_vehicles_limit || 6));

    let limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || "100", 10)));
    if ((featured === "true" || featured === "1" || featured === true) && !queryParams.hasLimit) {
      limit = featuredLimit;
    }

    let sqlWhere = [`is_published = 1 AND archived_at IS NULL`];
    let params = [];

    if (!showSoldVehicles) {
      sqlWhere.push(`LOWER(status) != 'sold'`);
    } else if (!includeSold && (!status || status.toLowerCase() !== "sold")) {
      sqlWhere.push(`LOWER(status) != 'sold'`);
    }

    if (search) {
      sqlWhere.push(`(
        LOWER(stock_number) LIKE ? ESCAPE '\\' OR
        LOWER(make) LIKE ? ESCAPE '\\' OR
        LOWER(model) LIKE ? ESCAPE '\\' OR
        LOWER(grade) LIKE ? ESCAPE '\\' OR
        LOWER(exterior_color) LIKE ? ESCAPE '\\' OR
        LOWER(transmission) LIKE ? ESCAPE '\\' OR
        LOWER(fuel) LIKE ? ESCAPE '\\' OR
        LOWER(short_description) LIKE ? ESCAPE '\\' OR
        CAST(year AS TEXT) LIKE ? ESCAPE '\\'
      )`);
      const term = `%${escapeSqlWildcards(search.toLowerCase())}%`;
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

    if (featured === "true" || featured === "1" || featured === true) {
      sqlWhere.push(`is_featured = 1`);
    }

    const whereClause = `WHERE ${sqlWhere.join(" AND ")}`;

    let orderBy = "ORDER BY display_order ASC, created_at DESC";
    if (featured === "true" || featured === "1" || featured === true) {
      orderBy = "ORDER BY CASE WHEN featured_position > 0 THEN featured_position ELSE 999 END ASC, display_order ASC, created_at DESC";
    } else if (sort === "price-asc") orderBy = "ORDER BY price ASC";
    else if (sort === "price-desc") orderBy = "ORDER BY price DESC";
    else if (sort === "year-desc") orderBy = "ORDER BY year DESC";
    else if (sort === "date-desc") orderBy = "ORDER BY created_at DESC";

    const totalItems = await VehicleRepository.countVehicles(env.DB, whereClause, params);
    const offset = (page - 1) * limit;
    const rows = await VehicleRepository.findVehicles(env.DB, whereClause, orderBy, params, limit, offset);

    const vehicleIds = rows.map(r => r.id);
    const imagesMap = await VehicleRepository.findImagesForVehicleIds(env.DB, vehicleIds);

    const vehicles = rows.map(row => {
      const images = imagesMap.get(row.id) || [];
      return mapDbToVehicle(row, images);
    });

    return {
      items: vehicles,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit) || 1
      }
    };
  }

  /**
   * Fetch single published public vehicle by ID, stock number, or slug
   */
  static async getPublicVehicle(db, identifier) {
    const vehicle = await VehicleRepository.findVehicleByIdOrStock(db, identifier);
    if (!vehicle || !vehicle.published || vehicle.archivedAt) {
      return null;
    }
    return vehicle;
  }

  /**
   * Fetch public auction sheet details and storage key
   */
  static async getPublicAuctionSheetInfo(env, identifier) {
    const vehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, identifier, { isAdmin: true });
    if (!vehicle || !vehicle.published || vehicle.archivedAt) {
      throw new VehicleServiceError("Vehicle not found.", "NOT_FOUND");
    }

    if (!vehicle.auctionSheetAvailable || !vehicle.auctionSheetUrl) {
      throw new VehicleServiceError("Auction sheet not available for this vehicle.", "NOT_FOUND");
    }

    const key = extractObjectKey(vehicle.auctionSheetUrl);
    if (!key) {
      throw new VehicleServiceError("Auction sheet storage key is missing or invalid.", "NOT_FOUND");
    }

    return { vehicle, key };
  }


  /**
   * Create vehicle with Platform Policy & Business Rule Enforcement
   */
  static async createVehicle(env, data, auditContext = {}) {
    const config = await platformConfig.getConfig(env);

    // 1. Mandatory Field & Type Validation
    const stockErr = validateStockNumber(data.stockNumber);
    if (stockErr) throw new VehicleServiceError(stockErr, "VALIDATION_ERROR");

    const makeErr = validateString(data.make, { name: "Make", required: true, minLength: 2, maxLength: 50 });
    if (makeErr) throw new VehicleServiceError(makeErr, "VALIDATION_ERROR");

    const modelErr = validateString(data.model, { name: "Model", required: true, minLength: 1, maxLength: 50 });
    if (modelErr) throw new VehicleServiceError(modelErr, "VALIDATION_ERROR");

    const yearErr = validateNumber(data.year, { name: "Year", required: true, min: 2000, max: new Date().getFullYear() + 2, integer: true });
    if (yearErr) throw new VehicleServiceError(yearErr, "VALIDATION_ERROR");

    const priceErr = validateNumber(data.price, { name: "Price", required: true, min: 0 });
    if (priceErr) throw new VehicleServiceError(priceErr, "VALIDATION_ERROR");

    const rawStatus = (data.status || "available").toLowerCase();
    const transitionErr = validateVehicleStateTransition("available", rawStatus);
    if (transitionErr) throw new VehicleServiceError(transitionErr, "VALIDATION_ERROR");

    // Map "draft" to isPublished = 0 and valid operational status
    let isPublished = (data.published === false || rawStatus === "draft") ? 0 : 1;
    let dbStatus = rawStatus;
    if (rawStatus === "draft" || rawStatus === "archived" || !["available", "incoming", "reserved", "sold"].includes(rawStatus)) {
      dbStatus = "available";
    }

    // 2. Business Rule: Featured vehicles CANNOT be Archived
    let isFeatured = data.featured ? 1 : 0;
    if (rawStatus === "archived" && isFeatured) {
      throw new VehicleServiceError("Featured vehicles cannot be set to Archived status.", "BAD_REQUEST");
    }

    // 3. Case-Insensitive Uniqueness Check for Stock Number
    const existingStock = await VehicleRepository.findByStockNumber(env.DB, data.stockNumber.trim());
    if (existingStock) {
      throw new VehicleServiceError(`Stock number "${data.stockNumber}" already exists.`, "BAD_REQUEST");
    }

    // 4. Case-Insensitive Uniqueness Check for Slug
    let rawSlug = (data.slug || "").trim();
    let slug = slugify(rawSlug);
    if (!slug) {
      slug = slugify(`${data.make} ${data.model} ${data.year} ${Math.floor(1000 + Math.random() * 9000)}`);
    }
    const slugErr = validateSlug(slug);
    if (slugErr) throw new VehicleServiceError(slugErr, "VALIDATION_ERROR");

    const existingSlug = await VehicleRepository.findBySlug(env.DB, slug);
    if (existingSlug) {
      slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // 5. Image Count Policy Check
    const extImages = data.exteriorImages || data.images || [];
    const intImages = data.interiorImages || [];
    const totalImageCount = extImages.length + intImages.length;
    if (totalImageCount > config.max_vehicle_images) {
      throw new VehicleServiceError(`Vehicle exceeds maximum allowed image limit of ${config.max_vehicle_images} images (Provided: ${totalImageCount}).`, "BAD_REQUEST");
    }

    const now = new Date().toISOString();
    const archivedAt = rawStatus === "archived" ? now : null;
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
      status: dbStatus,
      isPublished,
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
      showPrice: (data.showPrice !== undefined ? (data.showPrice ? 1 : 0) : (data.show_price !== undefined ? (data.show_price ? 1 : 0) : 1)),
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

    // Auto-reorder featured vehicles if needed
    await VehicleService.syncFeaturedPositions(env.DB, vehicleId, isFeatured, data.featuredPosition || 1);

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
    if (rawStatus === "archived") {
      await purgeArchivedVehicleMedia(env, vehicleId);
    }

    if (auditContext.user) {
      await logAudit(env, {
        actingUserId: auditContext.user.id,
        actingUsername: auditContext.user.username,
        action: "CREATE_VEHICLE",
        resourceType: "vehicle",
        resourceId: String(vehicleId),
        status: "SUCCESS",
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        details: JSON.stringify({ stockNumber: data.stockNumber, make: data.make, model: data.model, status: dbStatus })
      });
    }

    return await VehicleRepository.findVehicleByIdOrStock(env.DB, String(vehicleId), { isAdmin: true });
  }

  /**
   * Update vehicle with Domain & Platform Policy Validation
   */
  static async updateVehicle(env, idOrStock, data, auditContext = {}) {
    const existingVehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, idOrStock, { isAdmin: true });
    if (!existingVehicle) throw new VehicleServiceError("Vehicle not found.", "NOT_FOUND");

    const dbId = existingVehicle.dbId;
    const now = new Date().toISOString();
    const config = await platformConfig.getConfig(env);

    // 1. Validate Stock Number if changing
    const newStockNumber = data.stockNumber !== undefined ? data.stockNumber.trim() : existingVehicle.stockNumber;
    if (newStockNumber.toLowerCase() !== existingVehicle.stockNumber.toLowerCase()) {
      const stockErr = validateStockNumber(newStockNumber);
      if (stockErr) throw new VehicleServiceError(stockErr, "VALIDATION_ERROR");

      const dupe = await VehicleRepository.findByStockNumber(env.DB, newStockNumber, dbId);
      if (dupe) {
        throw new VehicleServiceError(`Stock number "${newStockNumber}" is already in use by another vehicle.`, "BAD_REQUEST");
      }
    }

    // 2. Validate Vehicle Status Transition
    const currentStatus = existingVehicle.status;
    const rawRequestedStatus = data.status !== undefined ? data.status.toLowerCase() : currentStatus;
    const isRestore = data.restore === true || (currentStatus === "sold" && rawRequestedStatus === "available" && data.confirmRestore === true);

    const transitionErr = validateVehicleStateTransition(currentStatus, rawRequestedStatus, isRestore);
    if (transitionErr) throw new VehicleServiceError(transitionErr, "VALIDATION_ERROR");

    let isPublishedVal = existingVehicle.published ? 1 : 0;
    if (data.published !== undefined) {
      isPublishedVal = data.published ? 1 : 0;
    }
    if (rawRequestedStatus === "draft") {
      isPublishedVal = 0;
    }

    let dbStatus = rawRequestedStatus;
    if (rawRequestedStatus === "draft" || rawRequestedStatus === "archived" || !["available", "incoming", "reserved", "sold"].includes(rawRequestedStatus)) {
      dbStatus = ["available", "incoming", "reserved", "sold"].includes(currentStatus) ? currentStatus : "available";
    }

    // 3. Business Rule: Featured vehicles CANNOT be Archived
    let newFeatured = data.featured !== undefined ? (data.featured ? 1 : 0) : (existingVehicle.featured ? 1 : 0);
    if (rawRequestedStatus === "archived" && newFeatured) {
      throw new VehicleServiceError("Featured vehicles cannot be Archived. Please un-feature the vehicle before archiving.", "BAD_REQUEST");
    }

    // 4. Image count policy check
    const extImages = data.exteriorImages || data.images || [];
    const intImages = data.interiorImages || [];
    if ((data.exteriorImages || data.interiorImages || data.images) && (extImages.length + intImages.length > config.max_vehicle_images)) {
      throw new VehicleServiceError(`Vehicle exceeds maximum allowed image limit of ${config.max_vehicle_images} images.`, "BAD_REQUEST");
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
    if (rawRequestedStatus === "archived" && !archivedAt) {
      archivedAt = now;
      newFeatured = 0; // Automatically clear featured status on archive
    } else if (rawRequestedStatus !== "archived") {
      archivedAt = null;
    }

    await VehicleRepository.updateVehicle(env.DB, dbId, {
      stockNumber: newStockNumber,
      make: (data.make || existingVehicle.make).trim(),
      model: (data.model || existingVehicle.model).trim(),
      year: data.year ? parseInt(data.year, 10) : existingVehicle.year,
      status: dbStatus,
      isPublished: isPublishedVal,
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
      showPrice: data.showPrice !== undefined ? (data.showPrice ? 1 : 0) : (data.show_price !== undefined ? (data.show_price ? 1 : 0) : (existingVehicle.showPrice !== false && existingVehicle.show_price !== false ? 1 : 0)),
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
    if (rawRequestedStatus === "archived") {
      await purgeArchivedVehicleMedia(env, dbId);
    }

    // Auto-reorder featured vehicles if needed
    await VehicleService.syncFeaturedPositions(
      env.DB,
      dbId,
      newFeatured,
      data.featuredPosition !== undefined ? parseInt(data.featuredPosition, 10) : existingVehicle.featuredPosition
    );

    if (auditContext.user) {
      await logAudit(env, {
        actingUserId: auditContext.user.id,
        actingUsername: auditContext.user.username,
        action: "UPDATE_VEHICLE",
        resourceType: "vehicle",
        resourceId: String(dbId),
        status: "SUCCESS",
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        details: JSON.stringify({ stockNumber: newStockNumber, status: dbStatus })
      });
    }

    return await VehicleRepository.findVehicleByIdOrStock(env.DB, String(dbId), { isAdmin: true });
  }

  /**
   * Delete vehicle
   */
  static async deleteVehicle(env, idOrStock, auditContext = {}) {
    const existingVehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, idOrStock, { isAdmin: true });
    if (!existingVehicle) throw new VehicleServiceError("Vehicle not found.", "NOT_FOUND");

    const dbId = existingVehicle.dbId;

    // Purge associated R2 media files
    await purgeArchivedVehicleMedia(env, dbId);

    // Remove DB rows
    await VehicleRepository.deleteVehicleImages(env.DB, dbId);
    await VehicleRepository.deleteVehicle(env.DB, dbId);

    // Auto-reorder remaining featured vehicles
    if (existingVehicle.featured) {
      await VehicleService.syncFeaturedPositions(env.DB, dbId, false, 0);
    }

    if (auditContext.user) {
      await logAudit(env, {
        actingUserId: auditContext.user.id,
        actingUsername: auditContext.user.username,
        action: "DELETE_VEHICLE",
        resourceType: "vehicle",
        resourceId: String(dbId),
        status: "SUCCESS",
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        details: JSON.stringify({ stockNumber: existingVehicle.stockNumber })
      });
    }

    return true;
  }

  /**
   * Quick status / publish / archive update
   */
  static async updateVehicleStatus(env, idOrStock, body, auditContext = {}) {
    const existingVehicle = await VehicleRepository.findVehicleByIdOrStock(env.DB, idOrStock);
    if (!existingVehicle) throw new VehicleServiceError("Vehicle not found.", "NOT_FOUND");

    const dbId = existingVehicle.dbId;
    const now = new Date().toISOString();

    let rawStatus = body.status !== undefined ? body.status.toLowerCase() : existingVehicle.status;
    let newPublished = body.published !== undefined ? (body.published ? 1 : 0) : (existingVehicle.published ? 1 : 0);
    let newArchivedAt = existingVehicle.archivedAt;

    if (rawStatus === "draft") {
      newPublished = 0;
      rawStatus = ["available", "incoming", "reserved", "sold"].includes(existingVehicle.status) ? existingVehicle.status : "available";
    }

    let targetStatus = rawStatus;
    if (body.archive === true || rawStatus === "archived") {
      if (existingVehicle.featured) {
        throw new VehicleServiceError("Featured vehicles cannot be archived. Please un-feature the vehicle first.", "BAD_REQUEST");
      }
      targetStatus = ["available", "incoming", "reserved", "sold"].includes(existingVehicle.status) ? existingVehicle.status : "available";
      newArchivedAt = now;
      newPublished = 0;
    } else if (body.archive === false) {
      newArchivedAt = null;
      if (!["available", "incoming", "reserved", "sold"].includes(targetStatus)) {
        targetStatus = "available";
      }
    } else if (!["available", "incoming", "reserved", "sold"].includes(targetStatus)) {
      targetStatus = "available";
    }

    let newFeatured = body.featured !== undefined ? (body.featured ? 1 : 0) : (existingVehicle.featured ? 1 : 0);
    let newFeaturedPos = body.featuredPosition !== undefined ? parseInt(body.featuredPosition, 10) : existingVehicle.featuredPosition;

    if (body.archive === true || rawStatus === "archived") {
      newFeatured = 0;
    }

    const transitionErr = validateVehicleStateTransition(existingVehicle.status, rawStatus, body.confirmRestore === true);
    if (transitionErr) throw new VehicleServiceError(transitionErr, "VALIDATION_ERROR");

    await VehicleRepository.updateVehicleStatus(env.DB, dbId, targetStatus, newPublished, newArchivedAt, now);
    await VehicleService.syncFeaturedPositions(env.DB, dbId, newFeatured, newFeaturedPos);

    if (rawStatus === "archived") {
      await purgeArchivedVehicleMedia(env, dbId);
    }

    if (auditContext.user) {
      await logAudit(env, {
        actingUserId: auditContext.user.id,
        actingUsername: auditContext.user.username,
        action: body.published !== undefined ? (body.published ? "PUBLISH_VEHICLE" : "UNPUBLISH_VEHICLE") : "UPDATE_VEHICLE_STATUS",
        resourceType: "vehicle",
        resourceId: String(dbId),
        status: "SUCCESS",
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        details: JSON.stringify({ status: targetStatus, published: Boolean(newPublished), archivedAt: newArchivedAt })
      });
    }

    return await VehicleRepository.findVehicleByIdOrStock(env.DB, String(dbId));
  }

  /**
   * Dashboard metrics aggregate query
   */
  static async getDashboardStats(db) {
    return await VehicleRepository.getDashboardStats(db);
  }

  /**
   * R2 file & document upload
   */
  static async uploadFile(env, formData) {
    const file = formData.get("file");
    if (!file) {
      throw new VehicleServiceError("No file provided in form request.", "BAD_REQUEST");
    }

    const category = (formData.get("category") || formData.get("type") || formData.get("folder") || "").toLowerCase();
    const config = await platformConfig.getConfig(env);

    // Validate file size, type & bounds using platform policies
    const uploadErr = validateFileUpload(file, category, config);
    if (uploadErr) {
      throw new VehicleServiceError(uploadErr, "BAD_REQUEST");
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

    if (!bucket) {
      throw new VehicleServiceError("Storage bucket is not configured.", "SERVER_ERROR");
    }

    await bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || (ext === "pdf" ? "application/pdf" : "image/jpeg")
      }
    });

    const publicUrl = `/api/v1/public/files/${key}`;

    return {
      url: publicUrl,
      key,
      name: fileName,
      type: file.type || "application/octet-stream"
    };
  }
}

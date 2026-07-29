import { mapDbToVehicle } from "../services/vehicle-mapper.js";

/**
 * Repository handling database access and persistence operations for the Vehicle domain.
 */
export class VehicleRepository {
  /**
   * Find raw vehicle row by numeric ID, stock number, or slug
   * @param {Object} db - D1 Database binding
   * @param {string|number} idOrStockOrSlug
   * @returns {Promise<Object|null>}
   */
  static async findRawVehicleByIdOrStock(db, idOrStockOrSlug) {
    let row = null;
    const identifier = String(idOrStockOrSlug);
    if (/^\d+$/.test(identifier)) {
      row = await db.prepare(`SELECT * FROM vehicles WHERE id = ?`).bind(parseInt(identifier, 10)).first();
    }
    if (!row) {
      row = await db.prepare(`SELECT * FROM vehicles WHERE LOWER(stock_number) = LOWER(?) OR LOWER(slug) = LOWER(?)`).bind(identifier, identifier).first();
    }
    return row || null;
  }

  /**
   * Fetch all images associated with a vehicle ID
   * @param {Object} db - D1 Database binding
   * @param {number} vehicleId
   * @returns {Promise<Array>}
   */
  static async findVehicleImages(db, vehicleId) {
    const imagesRes = await db.prepare(`SELECT * FROM vehicle_images WHERE vehicle_id = ? ORDER BY display_order ASC, id ASC`).bind(vehicleId).all();
    return imagesRes?.results || [];
  }

  /**
   * Fetch mapped vehicle object (with images) by numeric ID, stock number, or slug
   * @param {Object} db - D1 Database binding
   * @param {string|number} idOrStockOrSlug
   * @returns {Promise<Object|null>}
   */
  static async findVehicleByIdOrStock(db, idOrStockOrSlug) {
    const row = await VehicleRepository.findRawVehicleByIdOrStock(db, idOrStockOrSlug);
    if (!row) return null;

    const images = await VehicleRepository.findVehicleImages(db, row.id);
    return mapDbToVehicle(row, images);
  }

  /**
   * Check if a stock number exists in DB (optionally excluding a vehicle ID)
   * @param {Object} db - D1 Database binding
   * @param {string} stockNumber
   * @param {number|null} excludeId
   * @returns {Promise<Object|null>}
   */
  static async findByStockNumber(db, stockNumber, excludeId = null) {
    if (excludeId) {
      return await db.prepare(`SELECT id FROM vehicles WHERE LOWER(stock_number) = LOWER(?) AND id != ?`).bind(stockNumber, excludeId).first();
    }
    return await db.prepare(`SELECT id FROM vehicles WHERE LOWER(stock_number) = LOWER(?)`).bind(stockNumber).first();
  }

  /**
   * Check if a slug exists in DB (optionally excluding a vehicle ID)
   * @param {Object} db - D1 Database binding
   * @param {string} slug
   * @param {number|null} excludeId
   * @returns {Promise<Object|null>}
   */
  static async findBySlug(db, slug, excludeId = null) {
    if (excludeId) {
      return await db.prepare(`SELECT id FROM vehicles WHERE LOWER(slug) = LOWER(?) AND id != ?`).bind(slug, excludeId).first();
    }
    return await db.prepare(`SELECT id FROM vehicles WHERE LOWER(slug) = LOWER(?)`).bind(slug).first();
  }

  /**
   * Count total vehicles matching where clause
   * @param {Object} db - D1 Database binding
   * @param {string} whereClause
   * @param {Array} params
   * @returns {Promise<number>}
   */
  static async countVehicles(db, whereClause = "", params = []) {
    const query = `SELECT COUNT(*) as total FROM vehicles ${whereClause}`;
    const countRes = await db.prepare(query).bind(...params).first();
    return countRes?.total || 0;
  }

  /**
   * Find vehicle rows with where clause, order by, limit and offset
   * @param {Object} db - D1 Database binding
   * @param {string} whereClause
   * @param {string} orderBy
   * @param {Array} params
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Array>}
   */
  static async findVehicles(db, whereClause = "", orderBy = "ORDER BY created_at DESC", params = [], limit = 100, offset = 0) {
    const query = `SELECT * FROM vehicles ${whereClause} ${orderBy} LIMIT ? OFFSET ?`;
    const rowsRes = await db.prepare(query).bind(...params, limit, offset).all();
    return rowsRes?.results || [];
  }

  /**
   * Get vehicle dashboard metric statistics
   * @param {Object} db - D1 Database binding
   * @returns {Promise<Object>}
   */
  static async getDashboardStats(db) {
    const totalRes = await db.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE archived_at IS NULL`).first();
    const availRes = await db.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE status = 'available' AND archived_at IS NULL`).first();
    const incomRes = await db.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE status = 'incoming' AND archived_at IS NULL`).first();
    const resvRes = await db.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE (status = 'reserved' OR status = 'pending') AND archived_at IS NULL`).first();
    const soldRes = await db.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE status = 'sold' AND archived_at IS NULL`).first();
    const archRes = await db.prepare(`SELECT COUNT(*) as c FROM vehicles WHERE status = 'archived' OR archived_at IS NOT NULL`).first();

    return {
      total: totalRes?.c || 0,
      available: availRes?.c || 0,
      incoming: incomRes?.c || 0,
      reserved: resvRes?.c || 0,
      sold: soldRes?.c || 0,
      archived: archRes?.c || 0
    };
  }

  /**
   * Insert a new vehicle record
   * @param {Object} db - D1 Database binding
   * @param {Object} record
   * @returns {Promise<Object>}
   */
  static async insertVehicle(db, record) {
    return await db.prepare(`
      INSERT INTO vehicles (
        slug, stock_number, make, model, year, status, is_published, is_featured, featured_position, is_new_arrival,
        display_order, grade, auction_grade, mileage, engine_cc, transmission,
        fuel, drive, body_type, exterior_color, interior_color, seats, doors,
        chassis_number, registration, steering, accident_history, purchase_price,
        price, currency, negotiable, short_description, description, features,
        auction_sheet_available, auction_sheet_url, youtube_url, arrival_date,
        archived_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `).bind(
      record.slug, record.stockNumber, record.make, record.model, record.year, record.status,
      record.isPublished, record.isFeatured, record.featuredPosition, record.isNewArrival,
      record.displayOrder, record.grade, record.auctionGrade, record.mileage, record.engineCC,
      record.transmission, record.fuel, record.drive, record.bodyType, record.exteriorColor,
      record.interiorColor, record.seats, record.doors, record.chassisNumber, record.registration,
      record.steering, record.accidentHistory, record.purchasePrice, record.price, record.currency,
      record.negotiable, record.shortDescription, record.description, record.featuresJson,
      record.auctionSheetAvailable, record.auctionSheetUrl, record.youtubeUrl, record.arrivalDate,
      record.archivedAt, record.createdAt, record.updatedAt
    ).run();
  }

  /**
   * Update an existing vehicle record
   * @param {Object} db - D1 Database binding
   * @param {number} dbId
   * @param {Object} record
   * @returns {Promise<Object>}
   */
  static async updateVehicle(db, dbId, record) {
    return await db.prepare(`
      UPDATE vehicles SET
        stock_number = ?, make = ?, model = ?, year = ?, status = ?,
        is_published = ?, is_featured = ?, featured_position = ?, is_new_arrival = ?, display_order = ?, grade = ?,
        auction_grade = ?, mileage = ?, engine_cc = ?, transmission = ?,
        fuel = ?, drive = ?, body_type = ?, exterior_color = ?, interior_color = ?,
        seats = ?, doors = ?, chassis_number = ?, registration = ?, steering = ?,
        accident_history = ?, purchase_price = ?, price = ?, currency = ?,
        negotiable = ?, short_description = ?, description = ?, features = ?,
        auction_sheet_available = ?, auction_sheet_url = ?, youtube_url = ?,
        arrival_date = ?, archived_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      record.stockNumber, record.make, record.model, record.year, record.status,
      record.isPublished, record.isFeatured, record.featuredPosition, record.isNewArrival, record.displayOrder, record.grade,
      record.auctionGrade, record.mileage, record.engineCC, record.transmission,
      record.fuel, record.drive, record.bodyType, record.exteriorColor, record.interiorColor,
      record.seats, record.doors, record.chassisNumber, record.registration, record.steering,
      record.accidentHistory, record.purchasePrice, record.price, record.currency,
      record.negotiable, record.shortDescription, record.description, record.featuresJson,
      record.auctionSheetAvailable, record.auctionSheetUrl, record.youtubeUrl, record.arrivalDate,
      record.archivedAt, record.updatedAt,
      dbId
    ).run();
  }

  /**
   * Delete vehicle by ID
   * @param {Object} db - D1 Database binding
   * @param {number} dbId
   * @returns {Promise<Object>}
   */
  static async deleteVehicle(db, dbId) {
    return await db.prepare(`DELETE FROM vehicles WHERE id = ?`).bind(dbId).run();
  }

  /**
   * Insert a vehicle image record
   * @param {Object} db - D1 Database binding
   * @param {number} vehicleId
   * @param {string} imageType
   * @param {string} imageUrl
   * @param {number} displayOrder
   * @param {string} createdAt
   * @returns {Promise<Object>}
   */
  static async insertVehicleImage(db, vehicleId, imageType, imageUrl, displayOrder, createdAt) {
    return await db.prepare(`
      INSERT INTO vehicle_images (vehicle_id, image_type, image_url, display_order, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(vehicleId, imageType, imageUrl, displayOrder, createdAt).run();
  }

  /**
   * Delete all images for a vehicle
   * @param {Object} db - D1 Database binding
   * @param {number} vehicleId
   * @returns {Promise<Object>}
   */
  static async deleteVehicleImages(db, vehicleId) {
    return await db.prepare(`DELETE FROM vehicle_images WHERE vehicle_id = ?`).bind(vehicleId).run();
  }

  /**
   * Update quick vehicle status / publish state
   * @param {Object} db - D1 Database binding
   * @param {number} dbId
   * @param {string} status
   * @param {number} isPublished
   * @param {string|null} archivedAt
   * @param {string} updatedAt
   * @returns {Promise<Object>}
   */
  static async updateVehicleStatus(db, dbId, status, isPublished, archivedAt, updatedAt) {
    return await db.prepare(`
      UPDATE vehicles
      SET status = ?, is_published = ?, archived_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, isPublished, archivedAt, updatedAt, dbId).run();
  }
}

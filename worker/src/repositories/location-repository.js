/**
 * Repository handling database operations for Business Locations and Location Phones
 */
export class LocationRepository {
  /**
   * Fetch all phones for location IDs
   * @param {Object} db
   * @param {Array<number>} locationIds
   * @returns {Promise<Object>} Map of locationId -> Array<phoneNumber>
   */
  static async fetchPhonesForLocations(db, locationIds) {
    if (!locationIds || locationIds.length === 0) return {};
    const placeholders = locationIds.map(() => "?").join(",");
    const query = await db.prepare(`
      SELECT location_id, phone_number, display_order
      FROM business_location_phones
      WHERE location_id IN (${placeholders})
      ORDER BY display_order ASC, id ASC
    `).bind(...locationIds).all();

    const phoneMap = {};
    locationIds.forEach(id => { phoneMap[id] = []; });

    (query?.results || []).forEach(row => {
      if (!phoneMap[row.location_id]) phoneMap[row.location_id] = [];
      phoneMap[row.location_id].push(row.phone_number);
    });

    return phoneMap;
  }

  /**
   * Check if a location with slug exists
   */
  static async findBySlug(db, slug) {
    return await db.prepare(`
      SELECT 
        id, slug, title, address, map_url as mapUrl, map_embed_url as mapEmbedUrl,
        is_visible as isVisible, is_default as isDefault, display_order as displayOrder,
        created_at as createdAt, updated_at as updatedAt
      FROM business_locations
      WHERE slug = ? AND deleted_at IS NULL
    `).bind(slug).first() || null;
  }

  /**
   * Check active location by ID
   */
  static async findById(db, id) {
    return await db.prepare(`
      SELECT * FROM business_locations WHERE id = ? AND deleted_at IS NULL
    `).bind(id).first() || null;
  }

  /**
   * Get all active admin locations
   */
  static async findAllAdmin(db) {
    const query = await db.prepare(`
      SELECT 
        id, slug, title, address, map_url as mapUrl, map_embed_url as mapEmbedUrl,
        is_visible as isVisible, is_default as isDefault, display_order as displayOrder,
        created_at as createdAt, updated_at as updatedAt
      FROM business_locations
      WHERE deleted_at IS NULL
      ORDER BY display_order ASC, id ASC
    `).all();
    return query?.results || [];
  }

  /**
   * Get public visible active locations
   */
  static async findAllPublic(db) {
    const query = await db.prepare(`
      SELECT 
        id, slug, title, address, map_url as mapUrl, map_embed_url as mapEmbedUrl,
        is_visible as isVisible, is_default as isDefault, display_order as displayOrder,
        created_at as createdAt, updated_at as updatedAt
      FROM business_locations
      WHERE deleted_at IS NULL AND is_visible = 1
      ORDER BY display_order ASC, id ASC
    `).all();
    return query?.results || [];
  }

  /**
   * Count total active locations
   */
  static async countActive(db) {
    const row = await db.prepare(`
      SELECT COUNT(*) as count FROM business_locations WHERE deleted_at IS NULL
    `).first();
    return row?.count || 0;
  }

  /**
   * Get current default location
   */
  static async findDefault(db) {
    return await db.prepare(`
      SELECT id FROM business_locations WHERE is_default = 1 AND deleted_at IS NULL
    `).first() || null;
  }

  /**
   * Unset default on all locations
   */
  static async unsetDefaults(db, excludeId = null) {
    if (excludeId) {
      await db.prepare(`UPDATE business_locations SET is_default = 0 WHERE id != ? AND deleted_at IS NULL`).bind(excludeId).run();
    } else {
      await db.prepare(`UPDATE business_locations SET is_default = 0 WHERE deleted_at IS NULL`).run();
    }
  }

  /**
   * Get max display order
   */
  static async getMaxDisplayOrder(db) {
    const row = await db.prepare(`
      SELECT MAX(display_order) as maxOrder FROM business_locations WHERE deleted_at IS NULL
    `).first();
    return row?.maxOrder || 0;
  }

  /**
   * Create new location
   */
  static async create(db, { slug, title, address, mapUrl, mapEmbedUrl, isVisible, isDefault, displayOrder }) {
    const now = new Date().toISOString();
    const nav = mapUrl || "";
    const embed = mapEmbedUrl || mapUrl || "";
    const res = await db.prepare(`
      INSERT INTO business_locations (
        slug, title, address, map_url, map_embed_url, is_visible, is_default, display_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(slug, title, address, nav, embed, isVisible ? 1 : 0, isDefault ? 1 : 0, displayOrder, now, now).run();

    return res.meta.last_row_id;
  }

  /**
   * Update location by ID
   */
  static async update(db, id, { title, address, mapUrl, mapEmbedUrl, isVisible, isDefault, displayOrder }) {
    const now = new Date().toISOString();
    const nav = mapUrl || "";
    const embed = mapEmbedUrl || mapUrl || "";
    await db.prepare(`
      UPDATE business_locations SET
        title = ?,
        address = ?,
        map_url = ?,
        map_embed_url = ?,
        is_visible = ?,
        is_default = ?,
        display_order = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(title, address, nav, embed, isVisible ? 1 : 0, isDefault ? 1 : 0, displayOrder, now, id).run();
  }

  /**
   * Soft delete location
   */
  static async softDelete(db, id) {
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE business_locations
      SET deleted_at = ?, is_visible = 0, is_default = 0, updated_at = ?
      WHERE id = ?
    `).bind(now, now, id).run();
  }

  /**
   * Set phones for a location
   */
  static async setPhones(db, locationId, phones) {
    const now = new Date().toISOString();
    await db.prepare(`DELETE FROM business_location_phones WHERE location_id = ?`).bind(locationId).run();
    let order = 1;
    for (const phone of phones) {
      await db.prepare(`
        INSERT INTO business_location_phones (location_id, phone_number, display_order, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(locationId, phone, order++, now).run();
    }
  }

  /**
   * Reorder location display sequence
   */
  static async updateDisplayOrder(db, id, displayOrder) {
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE business_locations SET display_order = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL
    `).bind(displayOrder, now, id).run();
  }

  /**
   * Set single default location
   */
  static async setDefault(db, id) {
    const now = new Date().toISOString();
    await db.prepare(`UPDATE business_locations SET is_default = 0, updated_at = ? WHERE deleted_at IS NULL`).bind(now).run();
    await db.prepare(`UPDATE business_locations SET is_default = 1, is_visible = 1, updated_at = ? WHERE id = ?`).bind(now, id).run();
  }
}

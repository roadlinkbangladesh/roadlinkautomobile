/**
 * Repository handling database access for Carousel Slides
 */
export class CarouselRepository {
  static async findAllAdmin(db) {
    const res = await db.prepare(`
      SELECT id, image_url as imageUrl, heading, subheading, badge_text as badgeText, display_order as displayOrder, is_visible as isVisible, created_at as createdAt, updated_at as updatedAt
      FROM carousel_slides
      ORDER BY display_order ASC, id ASC
    `).all();
    return res?.results || [];
  }

  static async findAllPublic(db) {
    const res = await db.prepare(`
      SELECT id, image_url as imageUrl, heading, subheading, badge_text as badgeText, display_order as displayOrder
      FROM carousel_slides
      WHERE is_visible = 1
      ORDER BY display_order ASC, id ASC
    `).all();
    return res?.results || [];
  }

  static async findById(db, id) {
    return await db.prepare(`SELECT * FROM carousel_slides WHERE id = ?`).bind(id).first() || null;
  }

  static async getMaxDisplayOrder(db) {
    const row = await db.prepare(`SELECT MAX(display_order) as maxOrder FROM carousel_slides`).first();
    return row?.maxOrder || 0;
  }

  static async create(db, { imageUrl, heading, subheading, badgeText, displayOrder, isVisible }) {
    const now = new Date().toISOString();
    const res = await db.prepare(`
      INSERT INTO carousel_slides (image_url, heading, subheading, badge_text, display_order, is_visible, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(imageUrl, heading, subheading, badgeText, displayOrder, isVisible ? 1 : 0, now, now).run();
    return res.meta.last_row_id;
  }

  static async update(db, id, { imageUrl, heading, subheading, badgeText, displayOrder, isVisible }) {
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE carousel_slides SET
        image_url = ?,
        heading = ?,
        subheading = ?,
        badge_text = ?,
        display_order = ?,
        is_visible = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(imageUrl, heading, subheading, badgeText, displayOrder, isVisible ? 1 : 0, now, id).run();
  }

  static async delete(db, id) {
    await db.prepare(`DELETE FROM carousel_slides WHERE id = ?`).bind(id).run();
  }

  static async updateDisplayOrder(db, id, displayOrder) {
    await db.prepare(`UPDATE carousel_slides SET display_order = ? WHERE id = ?`).bind(displayOrder, id).run();
  }
}

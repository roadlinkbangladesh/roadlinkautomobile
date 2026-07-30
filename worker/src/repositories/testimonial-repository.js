/**
 * Repository handling database access for Testimonials
 */
export class TestimonialRepository {
  static async findAllAdmin(db) {
    const res = await db.prepare(`
      SELECT id, rating, testimonial_text as testimonialText, customer_name as customerName, display_order as displayOrder, is_visible as isVisible, created_at as createdAt, updated_at as updatedAt
      FROM testimonials
      ORDER BY display_order ASC, id ASC
    `).all();
    return res?.results || [];
  }

  static async findAllPublic(db) {
    const res = await db.prepare(`
      SELECT id, rating, testimonial_text as testimonialText, customer_name as customerName, display_order as displayOrder
      FROM testimonials
      WHERE is_visible = 1
      ORDER BY display_order ASC, id ASC
    `).all();
    return res?.results || [];
  }

  static async findById(db, id) {
    return await db.prepare(`SELECT * FROM testimonials WHERE id = ?`).bind(id).first() || null;
  }

  static async getMaxDisplayOrder(db) {
    const row = await db.prepare(`SELECT MAX(display_order) as maxOrder FROM testimonials`).first();
    return row?.maxOrder || 0;
  }

  static async create(db, { rating, testimonialText, customerName, displayOrder, isVisible }) {
    const now = new Date().toISOString();
    const res = await db.prepare(`
      INSERT INTO testimonials (rating, testimonial_text, customer_name, display_order, is_visible, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(rating, testimonialText, customerName, displayOrder, isVisible ? 1 : 0, now, now).run();
    return res.meta.last_row_id;
  }

  static async update(db, id, { rating, testimonialText, customerName, displayOrder, isVisible }) {
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE testimonials SET
        rating = ?,
        testimonial_text = ?,
        customer_name = ?,
        display_order = ?,
        is_visible = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(rating, testimonialText, customerName, displayOrder, isVisible ? 1 : 0, now, id).run();
  }

  static async delete(db, id) {
    await db.prepare(`DELETE FROM testimonials WHERE id = ?`).bind(id).run();
  }

  static async updateDisplayOrder(db, id, displayOrder) {
    await db.prepare(`UPDATE testimonials SET display_order = ? WHERE id = ?`).bind(displayOrder, id).run();
  }
}

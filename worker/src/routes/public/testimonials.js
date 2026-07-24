import { success, serverError } from "../../utils/response.js";

/**
 * GET /api/v1/public/testimonials - List visible testimonials for homepage
 */
export async function getPublicTestimonials(request, env) {
  try {
    const res = await env.DB.prepare(`
      SELECT id, rating, testimonial_text as testimonialText, customer_name as customerName, display_order as displayOrder
      FROM testimonials
      WHERE is_visible = 1
      ORDER BY display_order ASC, id ASC
    `).all();

    return success(res.results || []);
  } catch (error) {
    console.error("Get public testimonials error:", error);
    return serverError("Failed to fetch testimonials.");
  }
}

import { success, serverError } from "../../utils/response.js";

/**
 * GET /api/v1/public/carousel - List visible hero carousel slides for website
 */
export async function getPublicCarousel(request, env) {
  try {
    const res = await env.DB.prepare(`
      SELECT id, image_url as imageUrl, heading, subheading, badge_text as badgeText, display_order as displayOrder
      FROM carousel_slides
      WHERE is_visible = 1
      ORDER BY display_order ASC, id ASC
    `).all();

    return success(res.results || []);
  } catch (error) {
    console.error("Get public carousel error:", error);
    return serverError("Failed to fetch carousel slides.");
  }
}

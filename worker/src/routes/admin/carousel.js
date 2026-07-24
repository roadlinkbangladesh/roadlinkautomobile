import { success, badRequest, notFound, serverError } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { logAudit } from "../../utils/audit.js";

/**
 * GET /api/v1/admin/carousel - List all carousel slides for admin
 */
export async function listAdminCarouselSlides(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const res = await env.DB.prepare(`
      SELECT id, image_url as imageUrl, heading, subheading, badge_text as badgeText, display_order as displayOrder, is_visible as isVisible, created_at as createdAt, updated_at as updatedAt
      FROM carousel_slides
      ORDER BY display_order ASC, id ASC
    `).all();

    const slides = (res.results || []).map(slide => ({
      ...slide,
      isVisible: Boolean(slide.isVisible)
    }));

    return success(slides);
  } catch (error) {
    console.error("List admin carousel slides error:", error);
    return serverError("Failed to fetch carousel slides.");
  }
}

/**
 * POST /api/v1/admin/carousel - Create new carousel slide
 */
export async function createAdminCarouselSlide(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await request.json();
    const imageUrl = (body.imageUrl || body.image_url || "").trim();
    const heading = (body.heading || "").trim();
    const subheading = (body.subheading || "").trim();
    const badgeText = (body.badgeText || body.badge_text || "").trim();
    const isVisible = body.isVisible !== undefined ? (body.isVisible ? 1 : 0) : 1;

    if (!imageUrl) return badRequest("Background image is required.");
    if (!heading) return badRequest("Slide heading is required.");

    const maxOrderRow = await env.DB.prepare(`SELECT MAX(display_order) as maxOrder FROM carousel_slides`).first();
    const displayOrder = body.displayOrder ? Number(body.displayOrder) : ((maxOrderRow?.maxOrder || 0) + 1);

    const now = new Date().toISOString();

    const result = await env.DB.prepare(`
      INSERT INTO carousel_slides (image_url, heading, subheading, badge_text, display_order, is_visible, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(imageUrl, heading, subheading, badgeText, displayOrder, isVisible, now, now).run();

    const slideId = result.meta.last_row_id;

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "carousel.create",
      resourceType: "carousel_slide",
      resourceId: slideId,
      status: "SUCCESS"
    });

    return success({
      id: slideId,
      imageUrl,
      heading,
      subheading,
      badgeText,
      displayOrder,
      isVisible: Boolean(isVisible),
      createdAt: now,
      updatedAt: now
    }, "Carousel slide created successfully.", 201);
  } catch (error) {
    console.error("Create carousel slide error:", error);
    return serverError("Failed to create carousel slide.");
  }
}

/**
 * PUT /api/v1/admin/carousel/:id - Update carousel slide
 */
export async function updateAdminCarouselSlide(request, env, ctx, params) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const id = parseInt(params.id, 10);
    if (!id || isNaN(id)) return badRequest("Invalid slide ID.");

    const existing = await env.DB.prepare(`SELECT * FROM carousel_slides WHERE id = ?`).bind(id).first();
    if (!existing) return notFound("Carousel slide not found.");

    const body = await request.json();
    const imageUrl = body.imageUrl !== undefined ? body.imageUrl.trim() : (body.image_url !== undefined ? body.image_url.trim() : existing.image_url);
    const heading = body.heading !== undefined ? body.heading.trim() : existing.heading;
    const subheading = body.subheading !== undefined ? body.subheading.trim() : existing.subheading;
    const badgeText = body.badgeText !== undefined ? body.badgeText.trim() : (body.badge_text !== undefined ? body.badge_text.trim() : existing.badge_text);
    const isVisible = body.isVisible !== undefined ? (body.isVisible ? 1 : 0) : existing.is_visible;
    const displayOrder = body.displayOrder !== undefined ? Number(body.displayOrder) : existing.display_order;

    if (!imageUrl) return badRequest("Background image is required.");
    if (!heading) return badRequest("Slide heading is required.");

    const now = new Date().toISOString();

    await env.DB.prepare(`
      UPDATE carousel_slides SET
        image_url = ?,
        heading = ?,
        subheading = ?,
        badge_text = ?,
        display_order = ?,
        is_visible = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(imageUrl, heading, subheading, badgeText, displayOrder, isVisible, now, id).run();

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "carousel.update",
      resourceType: "carousel_slide",
      resourceId: id,
      status: "SUCCESS"
    });

    return success({
      id,
      imageUrl,
      heading,
      subheading,
      badgeText,
      displayOrder,
      isVisible: Boolean(isVisible),
      updatedAt: now
    }, "Carousel slide updated successfully.");
  } catch (error) {
    console.error("Update carousel slide error:", error);
    return serverError("Failed to update carousel slide.");
  }
}

/**
 * DELETE /api/v1/admin/carousel/:id - Delete carousel slide
 */
export async function deleteAdminCarouselSlide(request, env, ctx, params) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const id = parseInt(params.id, 10);
    if (!id || isNaN(id)) return badRequest("Invalid slide ID.");

    await env.DB.prepare(`DELETE FROM carousel_slides WHERE id = ?`).bind(id).run();

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "carousel.delete",
      resourceType: "carousel_slide",
      resourceId: id,
      status: "SUCCESS"
    });

    return success({ id }, "Carousel slide deleted successfully.");
  } catch (error) {
    console.error("Delete carousel slide error:", error);
    return serverError("Failed to delete carousel slide.");
  }
}

/**
 * PUT /api/v1/admin/carousel/reorder - Reorder carousel slides
 */
export async function reorderAdminCarouselSlides(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await request.json();
    const slideIds = body.slideIds || body.slide_ids;
    if (!Array.isArray(slideIds)) return badRequest("slideIds array is required.");

    let order = 1;
    for (const id of slideIds) {
      await env.DB.prepare(`UPDATE carousel_slides SET display_order = ? WHERE id = ?`).bind(order++, id).run();
    }

    return success(null, "Carousel slides reordered successfully.");
  } catch (error) {
    console.error("Reorder carousel slides error:", error);
    return serverError("Failed to reorder carousel slides.");
  }
}

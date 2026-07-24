import { success, badRequest, notFound, serverError } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { logAudit } from "../../utils/audit.js";

/**
 * GET /api/v1/admin/testimonials - List all testimonials
 */
export async function listAdminTestimonials(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const res = await env.DB.prepare(`
      SELECT id, rating, testimonial_text as testimonialText, customer_name as customerName, display_order as displayOrder, is_visible as isVisible, created_at as createdAt, updated_at as updatedAt
      FROM testimonials
      ORDER BY display_order ASC, id ASC
    `).all();

    const testimonials = (res.results || []).map(item => ({
      ...item,
      isVisible: Boolean(item.isVisible)
    }));

    return success(testimonials);
  } catch (error) {
    console.error("List admin testimonials error:", error);
    return serverError("Failed to fetch testimonials.");
  }
}

/**
 * POST /api/v1/admin/testimonials - Create testimonial
 */
export async function createAdminTestimonial(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await request.json();
    const rating = Math.min(5, Math.max(1, parseInt(body.rating || "5", 10)));
    const testimonialText = (body.testimonialText || body.testimonial_text || "").trim();
    const customerName = (body.customerName || body.customer_name || "").trim();
    const isVisible = body.isVisible !== undefined ? (body.isVisible ? 1 : 0) : 1;

    if (!testimonialText) return badRequest("Testimonial text is required.");
    if (!customerName) return badRequest("Customer name is required.");

    const maxOrderRow = await env.DB.prepare(`SELECT MAX(display_order) as maxOrder FROM testimonials`).first();
    const displayOrder = body.displayOrder ? Number(body.displayOrder) : ((maxOrderRow?.maxOrder || 0) + 1);

    const now = new Date().toISOString();

    const result = await env.DB.prepare(`
      INSERT INTO testimonials (rating, testimonial_text, customer_name, display_order, is_visible, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(rating, testimonialText, customerName, displayOrder, isVisible, now, now).run();

    const id = result.meta.last_row_id;

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "testimonial.create",
      resourceType: "testimonial",
      resourceId: id,
      status: "SUCCESS"
    });

    return success({
      id,
      rating,
      testimonialText,
      customerName,
      displayOrder,
      isVisible: Boolean(isVisible),
      createdAt: now,
      updatedAt: now
    }, "Testimonial created successfully.", 201);
  } catch (error) {
    console.error("Create testimonial error:", error);
    return serverError("Failed to create testimonial.");
  }
}

/**
 * PUT /api/v1/admin/testimonials/:id - Update testimonial
 */
export async function updateAdminTestimonial(request, env, ctx, params) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const id = parseInt(params.id, 10);
    if (!id || isNaN(id)) return badRequest("Invalid testimonial ID.");

    const existing = await env.DB.prepare(`SELECT * FROM testimonials WHERE id = ?`).bind(id).first();
    if (!existing) return notFound("Testimonial not found.");

    const body = await request.json();
    const rating = body.rating !== undefined ? Math.min(5, Math.max(1, parseInt(body.rating, 10))) : existing.rating;
    const testimonialText = body.testimonialText !== undefined ? body.testimonialText.trim() : (body.testimonial_text !== undefined ? body.testimonial_text.trim() : existing.testimonial_text);
    const customerName = body.customerName !== undefined ? body.customerName.trim() : (body.customer_name !== undefined ? body.customer_name.trim() : existing.customer_name);
    const isVisible = body.isVisible !== undefined ? (body.isVisible ? 1 : 0) : existing.is_visible;
    const displayOrder = body.displayOrder !== undefined ? Number(body.displayOrder) : existing.display_order;

    if (!testimonialText) return badRequest("Testimonial text is required.");
    if (!customerName) return badRequest("Customer name is required.");

    const now = new Date().toISOString();

    await env.DB.prepare(`
      UPDATE testimonials SET
        rating = ?,
        testimonial_text = ?,
        customer_name = ?,
        display_order = ?,
        is_visible = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(rating, testimonialText, customerName, displayOrder, isVisible, now, id).run();

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "testimonial.update",
      resourceType: "testimonial",
      resourceId: id,
      status: "SUCCESS"
    });

    return success({
      id,
      rating,
      testimonialText,
      customerName,
      displayOrder,
      isVisible: Boolean(isVisible),
      updatedAt: now
    }, "Testimonial updated successfully.");
  } catch (error) {
    console.error("Update testimonial error:", error);
    return serverError("Failed to update testimonial.");
  }
}

/**
 * DELETE /api/v1/admin/testimonials/:id - Delete testimonial
 */
export async function deleteAdminTestimonial(request, env, ctx, params) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const id = parseInt(params.id, 10);
    if (!id || isNaN(id)) return badRequest("Invalid testimonial ID.");

    await env.DB.prepare(`DELETE FROM testimonials WHERE id = ?`).bind(id).run();

    await logAudit(env, {
      actingUserId: auth.user.id,
      actingUsername: auth.user.username,
      action: "testimonial.delete",
      resourceType: "testimonial",
      resourceId: id,
      status: "SUCCESS"
    });

    return success({ id }, "Testimonial deleted successfully.");
  } catch (error) {
    console.error("Delete testimonial error:", error);
    return serverError("Failed to delete testimonial.");
  }
}

/**
 * PUT /api/v1/admin/testimonials/reorder - Reorder testimonials
 */
export async function reorderAdminTestimonials(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await request.json();
    const testimonialIds = body.testimonialIds || body.testimonial_ids;
    if (!Array.isArray(testimonialIds)) return badRequest("testimonialIds array is required.");

    let order = 1;
    for (const id of testimonialIds) {
      await env.DB.prepare(`UPDATE testimonials SET display_order = ? WHERE id = ?`).bind(order++, id).run();
    }

    return success(null, "Testimonials reordered successfully.");
  } catch (error) {
    console.error("Reorder testimonials error:", error);
    return serverError("Failed to reorder testimonials.");
  }
}

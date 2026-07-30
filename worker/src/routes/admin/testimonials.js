import { success, badRequest, notFound, serverError } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { getRequestMeta } from "../../utils/audit.js";
import { TestimonialService, TestimonialDomainError } from "../../services/testimonial-service.js";

function handleTestimonialError(error) {
  if (error instanceof TestimonialDomainError) {
    if (error.status === 404) return notFound(error.message);
    return badRequest(error.message);
  }
  console.error("Testimonial domain error:", error);
  return serverError(error?.message || "Internal server error.");
}

export async function listAdminTestimonials(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const list = await TestimonialService.listAdminTestimonials(env);
    return success(list);
  } catch (error) {
    return handleTestimonialError(error);
  }
}

export async function createAdminTestimonial(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const meta = getRequestMeta(request);

  try {
    const body = await request.json();
    const created = await TestimonialService.createTestimonial(env, auth.user, body, meta);
    return success(created, "Testimonial created successfully.", 201);
  } catch (error) {
    return handleTestimonialError(error);
  }
}

export async function updateAdminTestimonial(request, env, ctx, params) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const id = parseInt(params.id, 10);
  if (!id || isNaN(id)) return badRequest("Invalid testimonial ID.");

  const meta = getRequestMeta(request);

  try {
    const body = await request.json();
    const updated = await TestimonialService.updateTestimonial(env, auth.user, id, body, meta);
    return success(updated, "Testimonial updated successfully.");
  } catch (error) {
    return handleTestimonialError(error);
  }
}

export async function deleteAdminTestimonial(request, env, ctx, params) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const id = parseInt(params.id, 10);
  if (!id || isNaN(id)) return badRequest("Invalid testimonial ID.");

  const meta = getRequestMeta(request);

  try {
    const res = await TestimonialService.deleteTestimonial(env, auth.user, id, meta);
    return success(res, "Testimonial deleted successfully.");
  } catch (error) {
    return handleTestimonialError(error);
  }
}

export async function reorderAdminTestimonials(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const meta = getRequestMeta(request);

  try {
    const body = await request.json();
    const testimonialIds = body.testimonialIds || body.testimonial_ids;
    await TestimonialService.reorderTestimonials(env, auth.user, testimonialIds, meta);
    return success(null, "Testimonials reordered successfully.");
  } catch (error) {
    return handleTestimonialError(error);
  }
}

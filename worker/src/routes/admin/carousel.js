import { success, badRequest, notFound, serverError } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { getRequestMeta } from "../../utils/audit.js";
import { CarouselService, CarouselDomainError } from "../../services/carousel-service.js";

function handleCarouselError(error) {
  if (error instanceof CarouselDomainError) {
    if (error.status === 404) return notFound(error.message);
    return badRequest(error.message);
  }
  console.error("Carousel domain error:", error);
  return serverError(error?.message || "Internal server error.");
}

export async function listAdminCarouselSlides(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const slides = await CarouselService.listAdminSlides(env);
    return success(slides);
  } catch (error) {
    return handleCarouselError(error);
  }
}

export async function createAdminCarouselSlide(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const meta = getRequestMeta(request);

  try {
    const body = await request.json();
    const created = await CarouselService.createSlide(env, auth.user, body, meta);
    return success(created, "Carousel slide created successfully.", 201);
  } catch (error) {
    return handleCarouselError(error);
  }
}

export async function updateAdminCarouselSlide(request, env, ctx, params) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const id = parseInt(params.id, 10);
  if (!id || isNaN(id)) return badRequest("Invalid slide ID.");

  const meta = getRequestMeta(request);

  try {
    const body = await request.json();
    const updated = await CarouselService.updateSlide(env, auth.user, id, body, meta);
    return success(updated, "Carousel slide updated successfully.");
  } catch (error) {
    return handleCarouselError(error);
  }
}

export async function deleteAdminCarouselSlide(request, env, ctx, params) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const id = parseInt(params.id, 10);
  if (!id || isNaN(id)) return badRequest("Invalid slide ID.");

  const meta = getRequestMeta(request);

  try {
    const res = await CarouselService.deleteSlide(env, auth.user, id, meta);
    return success(res, "Carousel slide deleted successfully.");
  } catch (error) {
    return handleCarouselError(error);
  }
}

export async function reorderAdminCarouselSlides(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const meta = getRequestMeta(request);

  try {
    const body = await request.json();
    const slideIds = body.slideIds || body.slide_ids;
    await CarouselService.reorderSlides(env, auth.user, slideIds, meta);
    return success(null, "Carousel slides reordered successfully.");
  } catch (error) {
    return handleCarouselError(error);
  }
}

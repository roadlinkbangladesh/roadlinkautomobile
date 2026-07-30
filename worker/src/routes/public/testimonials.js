import { success, serverError } from "../../utils/response.js";
import { TestimonialService } from "../../services/testimonial-service.js";

/**
 * GET /api/v1/public/testimonials - List visible testimonials for homepage
 */
export async function getPublicTestimonials(request, env) {
  try {
    const list = await TestimonialService.getPublicTestimonials(env);
    return success(list);
  } catch (error) {
    console.error("Get public testimonials error:", error);
    return serverError("Failed to fetch testimonials.");
  }
}

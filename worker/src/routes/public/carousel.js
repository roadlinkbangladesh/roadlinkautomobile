import { success, serverError } from "../../utils/response.js";
import { CarouselService } from "../../services/carousel-service.js";

/**
 * GET /api/v1/public/carousel - List visible hero carousel slides for website
 */
export async function getPublicCarousel(request, env) {
  try {
    const slides = await CarouselService.getPublicCarousel(env);
    return success(slides);
  } catch (error) {
    console.error("Get public carousel error:", error);
    return serverError("Failed to fetch carousel slides.");
  }
}

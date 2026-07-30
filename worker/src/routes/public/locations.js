import { success, badRequest, notFound, serverError } from "../../utils/response.js";
import { LocationService, LocationDomainError } from "../../services/location-service.js";

/**
 * GET /api/v1/public/locations
 */
export async function getPublicLocations(request, env) {
  try {
    const locations = await LocationService.getPublicLocations(env);
    return success(locations);
  } catch (error) {
    console.error("Error fetching public locations:", error);
    return serverError("Failed to retrieve business locations.");
  }
}

/**
 * GET /api/v1/public/locations/:slug
 */
export async function getPublicLocationBySlug(request, env) {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    const slug = parts[parts.length - 1];

    const location = await LocationService.getPublicLocationBySlug(env, slug);
    return success(location);
  } catch (error) {
    if (error instanceof LocationDomainError) {
      if (error.status === 404) return notFound(error.message);
      return badRequest(error.message);
    }
    console.error("Error fetching location by slug:", error);
    return serverError("Failed to retrieve location details.");
  }
}

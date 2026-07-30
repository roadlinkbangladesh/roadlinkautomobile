import { success, badRequest, notFound, serverError, forbidden } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { getRequestMeta } from "../../utils/audit.js";
import { LocationService, LocationDomainError } from "../../services/location-service.js";

function handleLocationError(error) {
  if (error instanceof LocationDomainError) {
    switch (error.status) {
      case 400: return badRequest(error.message);
      case 403: return forbidden(error.message);
      case 404: return notFound(error.message);
      default: return badRequest(error.message);
    }
  }
  console.error("Location domain error:", error);
  return serverError(error?.message || "Internal server error.");
}

/**
 * Check if user has permission to manage locations.
 */
async function checkLocationsAuth(request, env) {
  const auth = await authenticate(request, env);
  if (auth.errorResponse) return auth;

  const hasAccess = auth.user.is_super_admin ||
                    auth.permissions.includes("locations.manage") ||
                    auth.permissions.includes("settings.edit") ||
                    auth.permissions.includes("settings.view");

  if (!hasAccess) {
    return { errorResponse: forbidden("Access denied. Insufficient permissions to manage business locations.") };
  }
  return auth;
}

/**
 * GET /api/v1/admin/locations
 */
export async function listAdminLocations(request, env) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const list = await LocationService.listAdminLocations(env);
    return success(list);
  } catch (error) {
    return handleLocationError(error);
  }
}

/**
 * POST /api/v1/admin/locations
 */
export async function createAdminLocation(request, env) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const meta = getRequestMeta(request);

  try {
    const data = await request.json();
    const created = await LocationService.createLocation(env, auth.user, data, meta);
    return success(created, "Business location created successfully.", 201);
  } catch (error) {
    return handleLocationError(error);
  }
}

/**
 * PUT /api/v1/admin/locations/:id
 */
export async function updateAdminLocation(request, env, ctx, params) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const id = parseInt(params?.id || parts[parts.length - 1], 10);

  if (!id || isNaN(id)) return badRequest("Invalid location ID.");

  const meta = getRequestMeta(request);

  try {
    const data = await request.json();
    const updated = await LocationService.updateLocation(env, auth.user, id, data, meta);
    return success(updated, "Business location updated successfully.");
  } catch (error) {
    return handleLocationError(error);
  }
}

/**
 * DELETE /api/v1/admin/locations/:id
 */
export async function deleteAdminLocation(request, env) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const id = parseInt(parts[parts.length - 1], 10);

  if (!id || isNaN(id)) return badRequest("Invalid location ID.");

  const meta = getRequestMeta(request);

  try {
    const res = await LocationService.deleteLocation(env, auth.user, id, meta);
    return success(res, "Business location archived successfully.");
  } catch (error) {
    return handleLocationError(error);
  }
}

/**
 * PUT /api/v1/admin/locations/reorder
 */
export async function reorderAdminLocations(request, env) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const meta = getRequestMeta(request);

  try {
    const data = await request.json();
    const locationIds = data.locationIds || data.ids;
    const res = await LocationService.reorderLocations(env, auth.user, locationIds, meta);
    return success(res, "Business locations reordered successfully.");
  } catch (error) {
    return handleLocationError(error);
  }
}

/**
 * PUT /api/v1/admin/locations/:id/default
 */
export async function setDefaultAdminLocation(request, env) {
  const auth = await checkLocationsAuth(request, env);
  if (auth.errorResponse) return auth.errorResponse;

  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const id = parseInt(parts[parts.length - 2], 10);

  if (!id || isNaN(id)) return badRequest("Invalid location ID.");

  const meta = getRequestMeta(request);

  try {
    const res = await LocationService.setDefaultLocation(env, auth.user, id, meta);
    return success({ id: res.id, isDefault: res.isDefault }, res.message);
  } catch (error) {
    return handleLocationError(error);
  }
}

import { success, created, badRequest, notFound, serverError, validationError } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { getRequestMeta } from "../../utils/audit.js";
import { mapDbToVehicle } from "../../services/vehicle-mapper.js";
import { VehicleService, VehicleServiceError } from "../../services/vehicle-service.js";

export { mapDbToVehicle };

/**
 * Maps VehicleServiceError to appropriate HTTP response
 */
function handleServiceError(error, defaultMessage = "An unexpected error occurred.") {
  if (error instanceof VehicleServiceError) {
    if (error.type === "VALIDATION_ERROR") return validationError(error.message);
    if (error.type === "BAD_REQUEST") return badRequest(error.message);
    if (error.type === "NOT_FOUND") return notFound(error.message);
    if (error.type === "SERVER_ERROR") return serverError(error.message);
  }
  console.error("Admin vehicle route error:", error);
  return serverError(error?.message || defaultMessage);
}

/**
 * Fetch a single vehicle with its images by numeric ID, stock number, or slug
 */
export async function getVehicleByIdOrStock(db, idOrStockOrSlug) {
  return await VehicleService.getVehicleByIdOrStock(db, idOrStockOrSlug);
}

/**
 * GET /api/v1/admin/vehicles - Admin Vehicle Listing with search, filter, pagination
 */
export async function listAdminVehicles(request, env) {
  const auth = await authenticate(request, env, "vehicles.view");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "all";
    const make = url.searchParams.get("make") || "all";
    const sort = url.searchParams.get("sort") || "date-desc";
    const page = url.searchParams.get("page") || "1";
    const limit = url.searchParams.get("limit") || "100";

    const result = await VehicleService.listAdminVehicles(env.DB, {
      search,
      status,
      make,
      sort,
      page,
      limit
    });

    return success(result);
  } catch (error) {
    return handleServiceError(error, "Failed to fetch vehicles.");
  }
}

/**
 * GET /api/v1/admin/vehicles/:id - Get detailed vehicle
 */
export async function getAdminVehicle(request, env, ctx, params) {
  const auth = await authenticate(request, env, "vehicles.view");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const vehicle = await VehicleService.getVehicleByIdOrStock(env.DB, params.id, { isAdmin: true });
    if (!vehicle) return notFound("Vehicle not found.");
    return success(vehicle);
  } catch (error) {
    return handleServiceError(error, "Failed to fetch vehicle.");
  }
}

/**
 * POST /api/v1/admin/vehicles - Create vehicle with Platform Policy & Business Rule Enforcement
 */
export async function createAdminVehicle(request, env) {
  const auth = await authenticate(request, env, "vehicles.create");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);

  try {
    const data = await request.json();
    const createdVehicle = await VehicleService.createVehicle(env, data, {
      user: auth.user,
      ipAddress,
      userAgent
    });
    return created(createdVehicle, "Vehicle created successfully.");
  } catch (error) {
    return handleServiceError(error, "Failed to create vehicle.");
  }
}

/**
 * PUT /api/v1/admin/vehicles/:id - Update vehicle with Domain & Platform Policy Validation
 */
export async function updateAdminVehicle(request, env, ctx, params) {
  const auth = await authenticate(request, env, "vehicles.edit");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);

  try {
    const data = await request.json();
    const updatedVehicle = await VehicleService.updateVehicle(env, params.id, data, {
      user: auth.user,
      ipAddress,
      userAgent
    });
    return success(updatedVehicle, "Vehicle updated successfully.");
  } catch (error) {
    return handleServiceError(error, "Failed to update vehicle.");
  }
}

/**
 * DELETE /api/v1/admin/vehicles/:id - Delete vehicle
 */
export async function deleteAdminVehicle(request, env, ctx, params) {
  const auth = await authenticate(request, env, "vehicles.delete");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);

  try {
    await VehicleService.deleteVehicle(env, params.id, {
      user: auth.user,
      ipAddress,
      userAgent
    });
    return success(null, "Vehicle deleted successfully.");
  } catch (error) {
    return handleServiceError(error, "Failed to delete vehicle.");
  }
}

/**
 * PUT /api/v1/admin/vehicles/:id/status - Quick status / publish / archive update
 */
export async function updateAdminVehicleStatus(request, env, ctx, params) {
  const auth = await authenticate(request, env, "vehicles.edit");
  if (auth.errorResponse) return auth.errorResponse;

  const { ipAddress, userAgent } = getRequestMeta(request);

  try {
    const body = await request.json();
    const updatedVehicle = await VehicleService.updateVehicleStatus(env, params.id, body, {
      user: auth.user,
      ipAddress,
      userAgent
    });
    return success(updatedVehicle, "Vehicle status updated successfully.");
  } catch (error) {
    return handleServiceError(error, "Failed to update status.");
  }
}

/**
 * GET /api/v1/admin/dashboard/stats - Dashboard metrics aggregate query
 */
export async function getDashboardStats(request, env) {
  const auth = await authenticate(request, env, "dashboard.view");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const stats = await VehicleService.getDashboardStats(env.DB);
    return success(stats);
  } catch (error) {
    return handleServiceError(error, "Failed to fetch dashboard metrics.");
  }
}

/**
 * POST /api/v1/admin/upload - Generic R2 file & document upload endpoint
 */
export async function uploadFile(request, env) {
  const auth = await authenticate(request, env, "vehicles.edit");
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const formData = await request.formData();
    const result = await VehicleService.uploadFile(env, formData);
    return success(result, "File uploaded successfully.");
  } catch (error) {
    return handleServiceError(error, "Failed to upload file.");
  }
}

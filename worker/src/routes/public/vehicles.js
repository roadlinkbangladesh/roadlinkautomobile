import { success, notFound, serverError, applySecurityHeaders } from "../../utils/response.js";
import { VehicleService, VehicleServiceError } from "../../services/vehicle-service.js";
import { getStorageBucket } from "../../utils/storage.js";

/**
 * GET /api/v1/public/vehicles - Public Vehicle Inventory Listing
 */
export async function listPublicVehicles(request, env) {
  try {
    const url = new URL(request.url);
    const queryParams = {
      search: url.searchParams.get("search") || "",
      category: url.searchParams.get("category") || url.searchParams.get("bodyType") || "all",
      make: url.searchParams.get("make") || "all",
      status: url.searchParams.get("status"),
      featured: url.searchParams.get("featured"),
      includeSold: url.searchParams.get("includeSold"),
      sort: url.searchParams.get("sort") || "order-asc",
      page: url.searchParams.get("page") || "1",
      limit: url.searchParams.get("limit") || "100",
      hasLimit: url.searchParams.has("limit")
    };

    const result = await VehicleService.listPublicVehicles(env, queryParams);
    return success(result);
  } catch (error) {
    console.error("List public vehicles error:", error);
    return serverError("Failed to fetch vehicles.");
  }
}

/**
 * GET /api/v1/public/vehicles/:identifier - Get single published vehicle by ID, stock number, or slug
 */
export async function getPublicVehicle(request, env, ctx, params) {
  try {
    const vehicle = await VehicleService.getPublicVehicle(env.DB, params.identifier);
    if (!vehicle) {
      return notFound("Vehicle not found.");
    }
    return success(vehicle);
  } catch (error) {
    console.error("Get public vehicle error:", error);
    return serverError("Failed to fetch vehicle details.");
  }
}

/**
 * GET /api/v1/public/files/* & GET /api/v1/public/images/* - Get generic file or asset from R2 storage
 */
export async function getPublicFile(request, env, ctx, params) {
  try {
    const url = new URL(request.url);
    let key = params?.key;
    if (!key) {
      key = url.pathname.replace(/^\/api\/v1\/public\/(files|images)\//, "");
    }
    if (!key) return notFound("File key is required.");

    // Clean leading slashes
    key = key.replace(/^\/+/, "");

    const bucket = getStorageBucket(env);
    if (!bucket) {
      return notFound("Storage service not configured.");
    }

    const object = await bucket.get(key);
    if (!object) {
      return notFound("File not found.");
    }

    const headers = new Headers();
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    const ext = key.split(".").pop().toLowerCase();
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };

    const contentType = object.httpMetadata?.contentType || mimeTypes[ext] || "application/octet-stream";
    headers.set("Content-Type", contentType);

    if (ext === "pdf") {
      const filename = key.split("/").pop() || "document.pdf";
      headers.set("Content-Disposition", `inline; filename="${filename}"`);
    }

    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Get public file error:", error);
    return notFound("File not found.");
  }
}

export const getPublicImage = getPublicFile;

/**
 * GET /api/v1/public/vehicles/:identifier/auction-sheet - Stream/serve auction sheet for a published vehicle
 */
export async function getPublicVehicleAuctionSheet(request, env, ctx, params) {
  try {
    const { vehicle, key } = await VehicleService.getPublicAuctionSheetInfo(env, params.identifier);

    const bucket = getStorageBucket(env);
    if (!bucket) {
      return notFound("Storage service not configured.");
    }

    const object = await bucket.get(key);
    if (!object) {
      return notFound("Auction sheet file not found.");
    }

    const headers = new Headers();
    // Cache-Control and anti-download protective headers
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.set("X-Content-Type-Options", "nosniff");

    // Route-specific Content-Security-Policy allowing authorized portal framing
    const frameAncestors = new Set([
      "'self'",
      "https://roadlinkautomobiles.com",
      "https://www.roadlinkautomobiles.com",
      "https://admin.roadlinkautomobiles.com"
    ]);

    const reqOrigin = request.headers.get("Origin");
    if (reqOrigin && reqOrigin !== "null") {
      frameAncestors.add(reqOrigin);
    }

    const reqReferer = request.headers.get("Referer");
    if (reqReferer) {
      try {
        const refUrl = new URL(reqReferer);
        frameAncestors.add(refUrl.origin);
      } catch (e) {
        // ignore invalid URL
      }
    }

    headers.set("Content-Security-Policy", `frame-ancestors ${Array.from(frameAncestors).join(" ")}`);

    const ext = key.split(".").pop().toLowerCase();
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
      pdf: "application/pdf"
    };

    const contentType = object.httpMetadata?.contentType || mimeTypes[ext] || "application/octet-stream";
    headers.set("Content-Type", contentType);

    const safeStock = (vehicle.stockNumber || vehicle.id).toString().replace(/[^a-zA-Z0-9_-]/g, "");
    const filename = `Auction-Sheet-${safeStock}.${ext}`;
    headers.set("Content-Disposition", `inline; filename="${filename}"`);

    const securedHeaders = applySecurityHeaders(headers, request);

    return new Response(object.body, { headers: securedHeaders });
  } catch (error) {
    if (error instanceof VehicleServiceError && error.type === "NOT_FOUND") {
      return notFound(error.message);
    }
    console.error("Get public vehicle auction sheet error:", error);
    return notFound("Auction sheet not found.");
  }
}


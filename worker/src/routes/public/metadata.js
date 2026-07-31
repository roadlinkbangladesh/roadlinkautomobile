import { MetadataService } from "../../services/metadata-service.js";
import { success, badRequest } from "../../utils/response.js";

/**
 * Returns JSON metadata for homepage.
 * GET /api/v1/public/metadata/home?url=...
 */
export async function getPublicHomeMetadata(request, env, ctx) {
    try {
        const url = new URL(request.url);
        const requestUrl = url.searchParams.get("url") || request.url;

        const metadata = await MetadataService.buildPageMetadata(env, {
            requestUrl,
            pageType: "home"
        });

        return success(metadata);
    } catch (err) {
        console.error("Error generating home metadata:", err);
        return badRequest("Failed to generate homepage metadata.");
    }
}

/**
 * Returns JSON metadata for a specific vehicle by stock number or ID.
 * GET /api/v1/public/metadata/vehicle/:identifier?url=...
 */
export async function getPublicVehicleMetadata(request, env, ctx, params) {
    try {
        const identifier = params?.identifier || "";
        const url = new URL(request.url);
        const requestUrl = url.searchParams.get("url") || request.url;

        const metadata = await MetadataService.buildPageMetadata(env, {
            requestUrl,
            pageType: "vehicle",
            vehicleIdentifier: identifier
        });

        return success(metadata);
    } catch (err) {
        console.error(`Error generating vehicle metadata for "${params?.identifier}":`, err);
        return badRequest("Failed to generate vehicle metadata.");
    }
}

/**
 * Returns JSON metadata for stock inventory page.
 * GET /api/v1/public/metadata/stock?url=...
 */
export async function getPublicStockMetadata(request, env, ctx) {
    try {
        const url = new URL(request.url);
        const requestUrl = url.searchParams.get("url") || request.url;

        const metadata = await MetadataService.buildPageMetadata(env, {
            requestUrl,
            pageType: "stock"
        });

        return success(metadata);
    } catch (err) {
        console.error("Error generating stock metadata:", err);
        return badRequest("Failed to generate stock metadata.");
    }
}

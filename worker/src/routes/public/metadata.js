import { MetadataService } from "../../services/metadata-service.js";
import { SettingsRepository } from "../../repositories/settings-repository.js";
import { resolveFileUrl } from "../../utils/storage.js";
import { success, badRequest } from "../../utils/response.js";

/**
 * Returns JSON metadata for homepage.
 * GET /api/v1/public/metadata/home?url=...
 */
export async function getPublicHomeMetadata(request, env, ctx) {
    try {
        const url = new URL(request.url);
        const requestUrl = url.searchParams.get("url") || request.url;
        const workerOrigin = url.origin;

        const metadata = await MetadataService.buildPageMetadata(env, {
            requestUrl,
            workerOrigin,
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
        const workerOrigin = url.origin;

        const metadata = await MetadataService.buildPageMetadata(env, {
            requestUrl,
            workerOrigin,
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
        const workerOrigin = url.origin;

        const metadata = await MetadataService.buildPageMetadata(env, {
            requestUrl,
            workerOrigin,
            pageType: "stock"
        });

        return success(metadata);
    } catch (err) {
        console.error("Error generating stock metadata:", err);
        return badRequest("Failed to generate stock metadata.");
    }
}

/**
 * Returns webmanifest for PWA / site icon standards.
 * GET /api/v1/public/metadata/manifest or GET /site.webmanifest
 */
export async function getPublicSiteManifest(request, env, ctx) {
    try {
        let settings = null;
        if (env && env.DB) {
            settings = await SettingsRepository.getPublicSettings(env.DB);
        }
        const companyName = settings?.company_name || "Roadlink Automobiles";
        const title = settings?.website_title || companyName;
        const description = settings?.website_description || "Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh.";
        
        let iconUrl = "/assets/logo.png";
        if (settings?.favicon_url) {
            iconUrl = resolveFileUrl(settings.favicon_url);
        } else if (settings?.company_logo_url) {
            iconUrl = resolveFileUrl(settings.company_logo_url);
        }

        const manifest = {
            name: title,
            short_name: companyName,
            description: description,
            start_url: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#1e3a8a",
            icons: [
                {
                    src: iconUrl,
                    sizes: "192x192 512x512",
                    type: "image/png",
                    purpose: "any maskable"
                }
            ]
        };

        return new Response(JSON.stringify(manifest, null, 2), {
            headers: {
                "Content-Type": "application/manifest+json; charset=utf-8",
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (err) {
        console.error("Error generating manifest:", err);
        return badRequest("Failed to generate site manifest.");
    }
}

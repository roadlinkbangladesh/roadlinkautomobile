import { MetadataService } from "../../services/metadata-service.js";

/**
 * Handles server-side HTML rendering with metadata injection for Cloudflare Worker runtime.
 */
export async function handleHtmlRequest(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    let pageType = "home";
    let templateFile = "/index.html";
    let vehicleIdentifier = null;

    if (pathname === "/stock" || pathname === "/stock.html") {
        pageType = "stock";
        templateFile = "/stock.html";
    } else if (pathname === "/vehicle" || pathname === "/vehicle.html") {
        pageType = "vehicle";
        templateFile = "/vehicle.html";
        vehicleIdentifier = url.searchParams.get("stock") || url.searchParams.get("id") || url.searchParams.get("slug");
    } else if (pathname.startsWith("/vehicle/")) {
        pageType = "vehicle";
        templateFile = "/vehicle.html";
        vehicleIdentifier = decodeURIComponent(pathname.split("/vehicle/")[1] || "");
    } else if (pathname.startsWith("/stock/")) {
        pageType = "vehicle";
        templateFile = "/vehicle.html";
        vehicleIdentifier = decodeURIComponent(pathname.split("/stock/")[1] || "");
    } else if (pathname === "/" || pathname === "/index.html") {
        pageType = "home";
        templateFile = "/index.html";
    } else {
        // Not a public HTML page route
        return null;
    }

    let htmlTemplate = "";

    // 1. Fetch template HTML from Cloudflare Worker ASSETS binding if present
    if (env && env.ASSETS) {
        try {
            const assetUrl = new URL(templateFile, url.origin);
            const assetRes = await env.ASSETS.fetch(new Request(assetUrl));
            if (assetRes && assetRes.ok) {
                htmlTemplate = await assetRes.text();
            }
        } catch (err) {
            console.error("Failed to fetch HTML asset template from env.ASSETS:", err);
        }
    }

    // 2. Fallback if ASSETS binding is unavailable or failed
    if (!htmlTemplate) {
        return null; // allow fallback to standard static asset fetch or notFound
    }

    // 3. Compile metadata from D1 DB (Settings & Vehicle)
    const metadata = await MetadataService.buildPageMetadata(env, {
        requestUrl: request.url,
        baseUrl: url.origin,
        pageType,
        vehicleIdentifier
    });

    // 4. Inject metadata into HTML template
    const renderedHtml = MetadataService.renderHtml(htmlTemplate, metadata);

    return new Response(renderedHtml, {
        status: 200,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60, s-maxage=300"
        }
    });
}

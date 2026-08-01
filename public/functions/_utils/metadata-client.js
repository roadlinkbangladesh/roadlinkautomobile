import { renderHtmlMetadata } from "./render.js";

/**
 * Shared Cloudflare Pages Function handler that retrieves template HTML,
 * fetches page metadata from the Worker API, and injects metadata into the HTML.
 * 
 * @param {Object} context - Cloudflare Pages Function context
 * @param {string} pageType - "home" | "vehicle" | "stock"
 * @param {string|null} vehicleIdentifierOverride - optional vehicle stock number or ID
 * @returns {Promise<Response>}
 */
export async function fetchAndInjectMetadata(context, pageType = "home", vehicleIdentifierOverride = null) {
  // 1. Retrieve static HTML template from Cloudflare Pages storage
  const templateResponse = await context.next();

  // If request failed or is not HTML, return original response
  const contentType = templateResponse.headers.get("content-type") || "";
  if (!templateResponse.ok || !contentType.includes("text/html")) {
    return templateResponse;
  }

  try {
    const requestUrl = context.request.url;
    const url = new URL(requestUrl);

    let vehicleIdentifier = vehicleIdentifierOverride;
    if (!vehicleIdentifier && pageType === "vehicle") {
      vehicleIdentifier = url.searchParams.get("stock") || url.searchParams.get("id") || url.searchParams.get("slug");
    }

    // 2. Build metadata API endpoint path
    let metadataEndpoint = "/api/v1/public/metadata/home";
    if (pageType === "vehicle" && vehicleIdentifier) {
      metadataEndpoint = `/api/v1/public/metadata/vehicle/${encodeURIComponent(vehicleIdentifier)}`;
    } else if (pageType === "stock") {
      metadataEndpoint = "/api/v1/public/metadata/stock";
    }

    const queryParams = new URLSearchParams({ url: requestUrl }).toString();
    const fullApiPath = `${metadataEndpoint}?${queryParams}`;

    let metadata = null;

    // 3. Try Cloudflare Service Binding if bound in context.env
    const workerBinding = context.env.WORKER || context.env.BACKEND || context.env.WORKER_API;
    if (workerBinding && typeof workerBinding.fetch === "function") {
      try {
        const bindingUrl = `https://worker.internal${fullApiPath}`;
        const res = await workerBinding.fetch(new Request(bindingUrl, {
          headers: { "Accept": "application/json" }
        }));
        if (res.ok) {
          const payload = await res.json();
          metadata = payload.data || payload.metadata || payload;
        }
      } catch (e) {
        console.warn("Pages Function: Service binding fetch failed, falling back to HTTP fetch:", e.message);
      }
    }

    // 4. Fallback to HTTPS fetch
    if (!metadata) {
      const apiBaseUrl = context.env.WORKER_API_URL || (url.origin.includes("api.") ? url.origin : "https://api.roadlinkautomobiles.com");
      const httpUrl = `${apiBaseUrl.replace(/\/+$/, "")}${fullApiPath}`;
      const res = await fetch(httpUrl, {
        headers: { "Accept": "application/json" },
        cf: {
          cacheTtl: 60,
          cacheEverything: true
        }
      });
      if (res.ok) {
        const payload = await res.json();
        metadata = payload.data || payload.metadata || payload;
      }
    }

    // If metadata could not be retrieved, return untouched static HTML with debug header
    if (!metadata) {
      const fallbackHeaders = new Headers(templateResponse.headers);
      fallbackHeaders.set("X-Pages-Function", "active");
      fallbackHeaders.set("X-Metadata-Injected", "false-fetch-failed");
      return new Response(templateResponse.body, {
        status: templateResponse.status,
        statusText: templateResponse.statusText,
        headers: fallbackHeaders
      });
    }

    // 5. Read HTML template content
    const htmlText = await templateResponse.text();

    // 6. Inject metadata into HTML
    const injectedHtml = renderHtmlMetadata(htmlText, metadata);

    // 7. Construct and return modified HTML Response
    const newHeaders = new Headers(templateResponse.headers);
    newHeaders.set("Content-Type", "text/html; charset=UTF-8");
    newHeaders.set("Cache-Control", "public, max-age=0, must-revalidate");
    newHeaders.set("X-Pages-Function", "active");
    newHeaders.set("X-Metadata-Injected", "true");

    return new Response(injectedHtml, {
      status: templateResponse.status,
      statusText: templateResponse.statusText,
      headers: newHeaders
    });

  } catch (err) {
    console.error("Pages Function metadata injection error:", err);
    // Return original template response on error with debug header
    const errHeaders = new Headers(templateResponse.headers);
    errHeaders.set("X-Pages-Function", "active-error");
    errHeaders.set("X-Metadata-Error", err.message || "Unknown error");
    return new Response(templateResponse.body, {
      status: templateResponse.status,
      statusText: templateResponse.statusText,
      headers: errHeaders
    });
  }
}

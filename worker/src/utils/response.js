import { HTTP_STATUS } from "../config/constants.js";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin"
};

const ALLOWED_ORIGINS = new Set([
  "https://roadlinkautomobiles.com",
  "https://www.roadlinkautomobiles.com",
  "https://admin.roadlinkautomobiles.com",
]);

export function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");

  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "null";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    "Content-Security-Policy": "default-src 'self' 'unsafe-inline' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; connect-src * 'self' data: blob:; object-src 'none'; base-uri 'self';",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  };
}

/**
 * Injects security and CORS headers into custom Response headers objects
 */
export function applySecurityHeaders(customHeaders = {}, request = null) {
  const headers = customHeaders instanceof Headers ? customHeaders : new Headers(customHeaders);

  if (!headers.has("X-Content-Type-Options")) {
    headers.set("X-Content-Type-Options", "nosniff");
  }
  if (!headers.has("Referrer-Policy")) {
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  }
  if (!headers.has("Permissions-Policy")) {
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  }

  const origin = request ? request.headers.get("Origin") : null;
  if (origin && origin !== "null") {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  } else if (!headers.has("Access-Control-Allow-Origin")) {
    headers.set("Access-Control-Allow-Origin", "*");
  }

  return headers;
}

/**
 * Standard JSON response
 */
function json(status, success, data = null, message = null) {

    const body = {
        success
    };

    if (data !== null) {
        body.data = data;
    }

    if (message !== null) {
        body.message = message;
    }

    return Response.json(body, {
        status,
        headers: CORS_HEADERS
    });

}

/**
 * 200 OK
 */
export function success(data = null, message = null) {
    return json(
        HTTP_STATUS.OK,
        true,
        data,
        message
    );
}

/**
 * 201 Created
 */
export function created(data = null, message = "Created successfully.") {
    return json(
        HTTP_STATUS.CREATED,
        true,
        data,
        message
    );
}

/**
 * 400 Bad Request
 */
export function badRequest(message = "Bad request.", extra = null) {
    if (extra && typeof extra === "object") {
        const body = {
            success: false,
            ...extra,
            message
        };
        return Response.json(body, {
            status: HTTP_STATUS.BAD_REQUEST,
            headers: CORS_HEADERS
        });
    }
    return json(
        HTTP_STATUS.BAD_REQUEST,
        false,
        null,
        message
    );
}

/**
 * 401 Unauthorized
 */
export function unauthorized(message = "Unauthorized.", extra = null) {
    if (extra && typeof extra === "object") {
        const body = {
            success: false,
            ...extra,
            message
        };
        return Response.json(body, {
            status: HTTP_STATUS.UNAUTHORIZED,
            headers: CORS_HEADERS
        });
    }
    return json(
        HTTP_STATUS.UNAUTHORIZED,
        false,
        null,
        message
    );
}

/**
 * 403 Forbidden
 */
export function forbidden(message = "Forbidden.", extra = null) {
    if (extra && typeof extra === "object") {
        const body = {
            success: false,
            ...extra,
            message
        };
        return Response.json(body, {
            status: HTTP_STATUS.FORBIDDEN,
            headers: CORS_HEADERS
        });
    }
    return json(
        HTTP_STATUS.FORBIDDEN,
        false,
        null,
        message
    );
}

/**
 * 404 Not Found
 */
export function notFound(message = "Not found.") {
    return json(
        HTTP_STATUS.NOT_FOUND,
        false,
        null,
        message
    );
}

/**
 * 409 Conflict
 */
export function conflict(message = "Conflict.") {
    return json(
        HTTP_STATUS.CONFLICT,
        false,
        null,
        message
    );
}

/**
 * 422 Unprocessable Entity
 */
export function validationError(message = "Validation failed.") {
    return json(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        false,
        null,
        message
    );
}

/**
 * 429 Too Many Requests
 */
export function tooManyRequests(message = "Too many requests. Please try again later.") {
    return json(
        HTTP_STATUS.TOO_MANY_REQUESTS || 429,
        false,
        null,
        message
    );
}

/**
 * 500 Internal Server Error
 */
export function serverError(message = "Internal server error.") {
    return json(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        false,
        null,
        message
    );
}
/**
 * CORS preflight response
 */
export function preflight() {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
    });
}

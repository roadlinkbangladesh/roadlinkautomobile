import { HTTP_STATUS } from "../config/constants.js";

export const ALLOWED_ORIGINS = new Set([
  "https://roadlinkautomobiles.com",
  "https://www.roadlinkautomobiles.com",
  "https://admin.roadlinkautomobiles.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

export function isAllowedOrigin(origin, env = null) {
  if (!origin || typeof origin !== "string" || origin === "null") {
    return false;
  }
  if (ALLOWED_ORIGINS.has(origin)) {
    return true;
  }
  const envAllowed = env?.ALLOWED_ORIGINS || (typeof process !== "undefined" ? process.env?.ALLOWED_ORIGINS : null);
  if (envAllowed && typeof envAllowed === "string") {
    const customList = envAllowed.split(",").map(o => o.trim()).filter(Boolean);
    if (customList.includes(origin)) {
      return true;
    }
  }
  if (/^https:\/\/[a-z0-9-]+\.run\.app$/i.test(origin)) {
    return true;
  }
  return false;
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

export function getCorsHeaders(request, env = null) {
  const origin = request ? request.headers.get("Origin") : null;
  const isAllowed = isAllowedOrigin(origin, env);

  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    "Content-Security-Policy": "default-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https: data: blob:; object-src 'none'; base-uri 'self';",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  };

  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

/**
 * Injects security and CORS headers into custom Response headers objects
 */
export function applySecurityHeaders(customHeaders = {}, request = null, env = null) {
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
  if (isAllowedOrigin(origin, env)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  } else if (origin) {
    // Untrusted Origin: do NOT reflect arbitrary origins
    headers.delete("Access-Control-Allow-Origin");
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
export function preflight(requestOrEnv = null, env = null) {
    let request = null;
    let actualEnv = env;
    if (requestOrEnv && typeof requestOrEnv.headers?.get === "function") {
        request = requestOrEnv;
    } else if (requestOrEnv && !env) {
        actualEnv = requestOrEnv;
    }
    const origin = request ? request.headers.get("Origin") : null;
    const isAllowed = isAllowedOrigin(origin, actualEnv);

    const headers = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
        "X-Content-Type-Options": "nosniff"
    };

    if (isAllowed) {
        headers["Access-Control-Allow-Origin"] = origin;
    }

    return new Response(null, {
        status: isAllowed ? 204 : 403,
        headers
    });
}

import { HTTP_STATUS } from "../config/constants.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://roadlinkautomobile.pages.dev",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
export function badRequest(message = "Bad request.") {
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
export function unauthorized(message = "Unauthorized.") {
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
export function forbidden(message = "Forbidden.") {
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

import { HTTP_STATUS } from "../config/constants.js";

function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json"
        }
    });
}

export function success(data = null, message = "Success") {
    return json(HTTP_STATUS.OK, {
        success: true,
        message,
        data
    });
}

export function created(data = null, message = "Created successfully.") {
    return json(HTTP_STATUS.CREATED, {
        success: true,
        message,
        data
    });
}

export function validationError(errors = {}, message = "Validation failed.") {
    return json(HTTP_STATUS.BAD_REQUEST, {
        success: false,
        message,
        errors
    });
}

export function unauthorized(message = "Unauthorized.") {
    return json(HTTP_STATUS.UNAUTHORIZED, {
        success: false,
        message
    });
}

export function forbidden(message = "Forbidden.") {
    return json(HTTP_STATUS.FORBIDDEN, {
        success: false,
        message
    });
}

export function notFound(message = "Not found.") {
    return json(HTTP_STATUS.NOT_FOUND, {
        success: false,
        message
    });
}

export function conflict(message = "Conflict.") {
    return json(HTTP_STATUS.CONFLICT, {
        success: false,
        message
    });
}

export function serverError(message = "Internal server error.") {
    return json(HTTP_STATUS.INTERNAL_SERVER_ERROR, {
        success: false,
        message
    });
}

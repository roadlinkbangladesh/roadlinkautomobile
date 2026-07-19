/**
 * Roadlink API
 * Application constants
 *
 * Only values that are effectively static for the application
 * belong here.
 *
 * Values configurable by administrators must be stored in the
 * database (settings table), not in this file.
 */

export const APP = Object.freeze({
    NAME: "Roadlink API",
    VERSION: "1.0.0"
});

export const API = Object.freeze({
    PREFIX: "/api/v1",

    AUTH: "/api/v1/auth",

    ADMIN: "/api/v1/admin",

    PUBLIC: "/api/v1/public"
});

export const USER_ROLES = Object.freeze({
    ADMIN: "admin",
    MANAGER: "manager"
});

export const HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,

    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,

    INTERNAL_SERVER_ERROR: 500
});

export const VEHICLE = Object.freeze({
    MIN_YEAR: 2010,
    MAX_FUTURE_MODEL_YEAR_OFFSET: 2
});

export const IMAGE = Object.freeze({
    MAX_IMAGES_PER_VEHICLE: 50,

    ALLOWED_EXTENSIONS: Object.freeze([
        "jpg",
        "jpeg",
        "png",
        "webp"
    ])
});

export const PAGINATION = Object.freeze({
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100
});

export const SORT_ORDER = Object.freeze({
    ASC: "ASC",
    DESC: "DESC"
});

export const LOG_ACTIONS = Object.freeze({
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",

    CREATE_USER: "CREATE_USER",
    UPDATE_USER: "UPDATE_USER",

    CREATE_VEHICLE: "CREATE_VEHICLE",
    UPDATE_VEHICLE: "UPDATE_VEHICLE",
    DELETE_VEHICLE: "DELETE_VEHICLE",

    PUBLISH_VEHICLE: "PUBLISH_VEHICLE",
    UNPUBLISH_VEHICLE: "UNPUBLISH_VEHICLE",

    UPDATE_SETTINGS: "UPDATE_SETTINGS"
});

export const PASSWORD = Object.freeze({
    ALGORITHM: "PBKDF2",
    HASH: "SHA-256",

    ITERATIONS: 100000,

    SALT_LENGTH: 16,

    KEY_LENGTH: 32
});

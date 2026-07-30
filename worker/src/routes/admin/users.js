import {
    success,
    created,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    serverError
} from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { getRequestMeta } from "../../utils/audit.js";
import { UserService, UserDomainError } from "../../services/user-service.js";

function handleUserError(error) {
    if (error instanceof UserDomainError) {
        switch (error.status) {
            case 400: return badRequest(error.message);
            case 401: return unauthorized(error.message);
            case 403: return forbidden(error.message);
            case 404: return notFound(error.message);
            case 409: return conflict(error.message);
            default: return badRequest(error.message);
        }
    }
    console.error("User domain error:", error);
    return serverError(error?.message || "Internal server error.");
}

/**
 * GET /api/v1/admin/users
 */
export async function listUsers(request, env) {
    const auth = await authenticate(request, env, ["users.manage", "mfa.manage"]);
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const list = await UserService.listUsers(env, auth.user);
        return success(list);
    } catch (error) {
        return handleUserError(error);
    }
}

/**
 * GET /api/v1/admin/users/:id
 */
export async function getUser(request, env, ctx, params) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    try {
        const user = await UserService.getUserById(env, auth.user, id);
        return success(user);
    } catch (error) {
        return handleUserError(error);
    }
}

/**
 * POST /api/v1/admin/users
 */
export async function createUser(request, env) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const meta = getRequestMeta(request);

    try {
        const body = await request.json();
        const result = await UserService.createUser(env, auth.user, body, meta);
        return created(result);
    } catch (error) {
        return handleUserError(error);
    }
}

/**
 * PUT /api/v1/admin/users/:id
 */
export async function updateUser(request, env, ctx, params) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const meta = getRequestMeta(request);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    try {
        const body = await request.json();
        const updated = await UserService.updateUser(env, auth.user, id, body, meta);
        return success(updated);
    } catch (error) {
        return handleUserError(error);
    }
}

/**
 * DELETE /api/v1/admin/users/:id
 */
export async function deleteUser(request, env, ctx, params) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const meta = getRequestMeta(request);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    try {
        await UserService.deleteUser(env, auth.user, id, meta);
        return success(null, "User deleted successfully.");
    } catch (error) {
        return handleUserError(error);
    }
}

/**
 * POST /api/v1/admin/users/:id/reset-password
 */
export async function resetPassword(request, env, ctx, params) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const meta = getRequestMeta(request);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    try {
        const result = await UserService.resetPassword(env, auth.user, id, meta);
        return success(result);
    } catch (error) {
        return handleUserError(error);
    }
}

/**
 * PUT /api/v1/admin/users/change-password
 * PUT /api/v1/admin/change-password
 */
export async function changePassword(request, env) {
    const auth = await authenticate(request, env, null, true);
    if (auth.errorResponse) return auth.errorResponse;

    const meta = getRequestMeta(request);

    try {
        const body = await request.json();
        const result = await UserService.changePassword(
            env,
            auth.user,
            body.currentPassword,
            body.newPassword,
            meta
        );
        return success(result, "Password changed successfully. Please sign in again with your new password.");
    } catch (error) {
        return handleUserError(error);
    }
}

/**
 * GET /api/v1/admin/profile
 */
export async function getProfile(request, env) {
    const auth = await authenticate(request, env, null, true, true, false);
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const profile = await UserService.getProfile(env, auth.user, auth.permissions);
        return success(profile);
    } catch (error) {
        return handleUserError(error);
    }
}

/**
 * PUT /api/v1/admin/profile
 */
export async function updateProfile(request, env) {
    const auth = await authenticate(request, env);
    if (auth.errorResponse) return auth.errorResponse;

    const meta = getRequestMeta(request);

    try {
        const body = await request.json();
        const profile = await UserService.updateProfile(env, auth.user, body.display_name, meta);
        return success({
            ...profile,
            permissions: auth.permissions
        });
    } catch (error) {
        return handleUserError(error);
    }
}

/**
 * POST /api/v1/admin/users/:id/unlock
 */
export async function unlockUser(request, env, ctx, params) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    const meta = getRequestMeta(request);

    try {
        const unlocked = await UserService.unlockUser(env, auth.user, id, meta);
        return success(unlocked, "User account unlocked successfully.");
    } catch (error) {
        return handleUserError(error);
    }
}

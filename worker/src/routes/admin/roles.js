import { success, badRequest, notFound, conflict, serverError, forbidden } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { getRequestMeta } from "../../utils/audit.js";
import { RoleService, RoleDomainError, SYSTEM_PERMISSIONS } from "../../services/role-service.js";

export { SYSTEM_PERMISSIONS };

function handleRoleError(error) {
    if (error instanceof RoleDomainError) {
        switch (error.status) {
            case 400: return badRequest(error.message);
            case 403: return forbidden(error.message);
            case 404: return notFound(error.message);
            case 409: return conflict(error.message);
            default: return badRequest(error.message);
        }
    }
    console.error("Role domain error:", error);
    return serverError(error?.message || "Internal server error.");
}

export async function listPermissions(request, env) {
    const auth = await authenticate(request, env, "roles.manage");
    if (auth.errorResponse) return auth.errorResponse;
    return success(RoleService.listPermissions());
}

export async function listRoles(request, env) {
    const auth = await authenticate(request, env, ["roles.manage", "users.manage"]);
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const roles = await RoleService.listRoles(env, auth.user);
        return success(roles);
    } catch (error) {
        return handleRoleError(error);
    }
}

export async function getRole(request, env, ctx, params) {
    const auth = await authenticate(request, env, ["roles.manage", "users.manage"]);
    if (auth.errorResponse) return auth.errorResponse;

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return badRequest("Invalid role ID.");
    }

    try {
        const role = await RoleService.getRole(env, auth.user, id);
        return success(role);
    } catch (error) {
        return handleRoleError(error);
    }
}

export async function createRole(request, env) {
    const auth = await authenticate(request, env, "roles.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const meta = getRequestMeta(request);

    try {
        const body = await request.json();
        const role = await RoleService.createRole(env, auth.user, body, meta, auth.permissions);
        return success(role, "Role created successfully.");
    } catch (error) {
        return handleRoleError(error);
    }
}

export async function updateRole(request, env, ctx, params) {
    const auth = await authenticate(request, env, "roles.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return badRequest("Invalid role ID.");
    }

    const meta = getRequestMeta(request);

    try {
        const body = await request.json();
        const updated = await RoleService.updateRole(env, auth.user, id, body, meta, auth.permissions);
        return success(updated, "Role updated successfully.");
    } catch (error) {
        return handleRoleError(error);
    }
}

export async function deleteRole(request, env, ctx, params) {
    const auth = await authenticate(request, env, "roles.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return badRequest("Invalid role ID.");
    }

    const meta = getRequestMeta(request);

    try {
        await RoleService.deleteRole(env, auth.user, id, meta);
        return success(null, "Role deleted successfully.");
    } catch (error) {
        return handleRoleError(error);
    }
}

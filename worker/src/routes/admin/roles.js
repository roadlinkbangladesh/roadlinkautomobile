import { success, badRequest, notFound, conflict, serverError, forbidden } from "../../utils/response.js";
import { authenticate, isStrictlyLessPrivileged } from "../../utils/auth.js";
import { logAudit, getRequestMeta } from "../../utils/audit.js";

export const SYSTEM_PERMISSIONS = [
    { key: "dashboard.view", group: "Dashboard", description: "View dashboard widgets and charts" },
    { key: "vehicles.view", group: "Vehicles", description: "View vehicles inventory" },
    { key: "vehicles.create", group: "Vehicles", description: "Add new vehicles" },
    { key: "vehicles.edit", group: "Vehicles", description: "Edit vehicle details" },
    { key: "vehicles.delete", group: "Vehicles", description: "Delete vehicles" },
    { key: "vehicles.publish", group: "Vehicles", description: "Publish or unpublish vehicles" },
    { key: "settings.view", group: "Settings", description: "View system settings" },
    { key: "settings.edit", group: "Settings", description: "Modify system settings" },
    { key: "locations.manage", group: "Locations", description: "Manage business locations and contact numbers" },
    { key: "users.manage", group: "Users", description: "Manage administrative users" },
    { key: "roles.manage", group: "Roles", description: "Manage roles and permissions" },
    { key: "reports.accounting.view", group: "Reports", description: "View future accounting reports" },
    { key: "audit.view", group: "Audit Logs", description: "View security audit logs" }
];

export async function listPermissions(request, env) {
    const auth = await authenticate(request, env, "roles.manage");
    if (auth.errorResponse) return auth.errorResponse;
    return success(SYSTEM_PERMISSIONS);
}

export async function listRoles(request, env) {
    const auth = await authenticate(request, env);
    if (auth.errorResponse) return auth.errorResponse;

    if (!auth.permissions.includes("roles.manage") && !auth.permissions.includes("users.manage")) {
        return forbidden("Access denied. Insufficient permissions.");
    }

    try {
        const roles = await env.DB
            .prepare(`SELECT * FROM roles ORDER BY id ASC`)
            .all();

        const list = roles.results || [];
        
        // If not Super Administrator, filter roles to only show those strictly less privileged than the caller's role
        let viewableRoles = list;
        if (!auth.user.is_super_admin) {
            const filtered = [];
            for (const r of list) {
                if (await isStrictlyLessPrivileged(env, r.id, auth.user.role_id)) {
                    filtered.push(r);
                }
            }
            viewableRoles = filtered;
        }

        const enriched = [];
        for (const role of viewableRoles) {
            const permsQuery = await env.DB
                .prepare(`SELECT count(*) as count FROM role_permissions WHERE role_id = ?`)
                .bind(role.id)
                .first();
            const usersQuery = await env.DB
                .prepare(`SELECT count(*) as count FROM users WHERE role_id = ?`)
                .bind(role.id)
                .first();
            
            enriched.push({
                ...role,
                is_system_role: role.is_system_role === 1,
                permissions_count: permsQuery?.count || 0,
                users_count: usersQuery?.count || 0
            });
        }

        return success(enriched);
    } catch (error) {
        console.error("List roles error:", error);
        return serverError("Failed to retrieve roles.");
    }
}

export async function getRole(request, env, ctx, params) {
    const auth = await authenticate(request, env);
    if (auth.errorResponse) return auth.errorResponse;

    if (!auth.permissions.includes("roles.manage") && !auth.permissions.includes("users.manage")) {
        return forbidden("Access denied. Insufficient permissions.");
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid role ID.");
    }

    // If not Super Administrator, verify the requested role is strictly less privileged
    if (!auth.user.is_super_admin && !(await isStrictlyLessPrivileged(env, id, auth.user.role_id))) {
        return forbidden("Access denied. You do not have permission to view this role.");
    }

    try {
        const role = await env.DB
            .prepare(`SELECT * FROM roles WHERE id = ? LIMIT 1`)
            .bind(id)
            .first();

        if (!role) {
            return notFound("Role not found.");
        }

        const permsQuery = await env.DB
            .prepare(`SELECT permission_key FROM role_permissions WHERE role_id = ?`)
            .bind(id)
            .all();

        const permissions = (permsQuery.results || []).map(p => p.permission_key);

        return success({
            ...role,
            is_system_role: role.is_system_role === 1,
            permissions
        });
    } catch (error) {
        console.error("Get role error:", error);
        return serverError("Failed to retrieve role.");
    }
}

export async function createRole(request, env) {
    const auth = await authenticate(request, env, "roles.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    try {
        const body = await request.json();
        const name = body.name?.trim();
        const description = body.description?.trim();
        const permissions = body.permissions || [];

        if (!name) {
            return badRequest("Role name is required.");
        }

        // Delegated Administrator Guard: non-super-admins can only grant permissions they possess
        if (!auth.user.is_super_admin && Array.isArray(permissions)) {
            const unpossessed = permissions.filter(p => !auth.permissions.includes(p));
            if (unpossessed.length > 0) {
                await logAudit(env, {
                    actingUserId: auth.user.id,
                    actingUsername: auth.user.username,
                    action: "security.privilege_escalation_attempt",
                    resourceType: "role",
                    status: "FAILURE",
                    reason: "Attempted to grant permissions not possessed by caller",
                    ipAddress,
                    userAgent
                });
                return forbidden("Access denied. You cannot grant permissions that your own role does not possess.");
            }
        }

        // Validate unique name
        const existing = await env.DB
            .prepare(`SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1`)
            .bind(name)
            .first();

        if (existing) {
            return conflict("A role with this name already exists.");
        }

        const now = new Date().toISOString();

        // Insert role
        const role = await env.DB
            .prepare(`
                INSERT INTO roles (name, description, is_system_role, created_at, updated_at)
                VALUES (?, ?, 0, ?, ?)
                RETURNING id, name, description, is_system_role, created_at, updated_at
            `)
            .bind(name, description, now, now)
            .first();

        // Insert permissions
        const validKeys = SYSTEM_PERMISSIONS.map(p => p.key);
        for (const perm of permissions) {
            if (validKeys.includes(perm)) {
                await env.DB
                    .prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES (?, ?)`)
                    .bind(role.id, perm)
                    .run();
            }
        }

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetRoleId: role.id,
            action: "role.create",
            resourceType: "role",
            resourceId: role.id,
            status: "SUCCESS",
            ipAddress,
            userAgent,
            details: { name, permissions }
        });

        return success({
            ...role,
            is_system_role: false,
            permissions
        }, "Role created successfully.");
    } catch (error) {
        console.error("Create role error:", error);
        return serverError("Failed to create role.");
    }
}

export async function updateRole(request, env, ctx, params) {
    const auth = await authenticate(request, env, "roles.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid role ID.");
    }

    // Delegated Administrator Guard: non-super-admins can only edit roles strictly less privileged than their own
    if (!auth.user.is_super_admin && !(await isStrictlyLessPrivileged(env, id, auth.user.role_id))) {
        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetRoleId: id,
            action: "security.privilege_escalation_attempt",
            resourceType: "role",
            status: "FAILURE",
            reason: "Attempted to modify role of equal or higher privilege",
            ipAddress,
            userAgent
        });
        return forbidden("Access denied. You can only modify roles that are strictly less privileged than your own role.");
    }

    try {
        const role = await env.DB
            .prepare(`SELECT * FROM roles WHERE id = ? LIMIT 1`)
            .bind(id)
            .first();

        if (!role) {
            return notFound("Role not found.");
        }

        const isSystemRole = role.is_system_role === 1 || role.system_role_key === "SUPER_ADMIN";

        const body = await request.json();
        const name = body.name?.trim();
        const description = body.description?.trim();
        const permissions = body.permissions;

        if (!name) {
            return badRequest("Role name is required.");
        }

        // Delegated Administrator Guard: non-super-admins can only grant permissions they possess
        if (!auth.user.is_super_admin && Array.isArray(permissions)) {
            const unpossessed = permissions.filter(p => !auth.permissions.includes(p));
            if (unpossessed.length > 0) {
                await logAudit(env, {
                    actingUserId: auth.user.id,
                    actingUsername: auth.user.username,
                    targetRoleId: id,
                    action: "security.privilege_escalation_attempt",
                    resourceType: "role",
                    status: "FAILURE",
                    reason: "Attempted to grant unpossessed permissions",
                    ipAddress,
                    userAgent
                });
                return forbidden("Access denied. You cannot grant permissions that your own role does not possess.");
            }
        }

        // Validate unique name excluding current role
        const existing = await env.DB
            .prepare(`SELECT id FROM roles WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1`)
            .bind(name, id)
            .first();

        if (existing) {
            return conflict("Another role with this name already exists.");
        }

        const now = new Date().toISOString();

        // System role immutability: preserve system role attributes
        const updated = await env.DB
            .prepare(`
                UPDATE roles
                SET name = ?, description = ?, updated_at = ?
                WHERE id = ?
                RETURNING id, name, description, is_system_role, system_role_key, created_at, updated_at
            `)
            .bind(name, description, now, id)
            .first();

        // Sync permissions if provided
        if (permissions !== undefined) {
            // Delete old ones
            await env.DB
                .prepare(`DELETE FROM role_permissions WHERE role_id = ?`)
                .bind(id)
                .run();

            // Insert new ones
            const validKeys = SYSTEM_PERMISSIONS.map(p => p.key);
            for (const perm of permissions) {
                if (validKeys.includes(perm)) {
                    await env.DB
                        .prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES (?, ?)`)
                        .bind(id, perm)
                        .run();
                }
            }
        }

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetRoleId: id,
            action: "role.update",
            resourceType: "role",
            resourceId: id,
            status: "SUCCESS",
            ipAddress,
            userAgent,
            details: { name, description, permissions }
        });

        return success({
            ...updated,
            is_system_role: isSystemRole,
            permissions: permissions || []
        }, "Role updated successfully.");
    } catch (error) {
        console.error("Update role error:", error);
        return serverError("Failed to update role.");
    }
}

export async function deleteRole(request, env, ctx, params) {
    const auth = await authenticate(request, env, "roles.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid role ID.");
    }

    try {
        const role = await env.DB
            .prepare(`SELECT * FROM roles WHERE id = ? LIMIT 1`)
            .bind(id)
            .first();

        if (!role) {
            return notFound("Role not found.");
        }

        // System Role Immutability Guard: System roles can NEVER be deleted
        if (role.is_system_role === 1 || role.system_role_key === "SUPER_ADMIN") {
            await logAudit(env, {
                actingUserId: auth.user.id,
                actingUsername: auth.user.username,
                targetRoleId: id,
                action: "role.delete",
                resourceType: "role",
                status: "FAILURE",
                reason: "System roles cannot be deleted.",
                ipAddress,
                userAgent
            });
            return badRequest("System roles (such as Super Administrator) are immutable and cannot be deleted.");
        }

        // Delegated Administrator Guard: non-super-admins can only delete roles strictly less privileged than their own
        if (!auth.user.is_super_admin && !(await isStrictlyLessPrivileged(env, id, auth.user.role_id))) {
            await logAudit(env, {
                actingUserId: auth.user.id,
                actingUsername: auth.user.username,
                targetRoleId: id,
                action: "security.privilege_escalation_attempt",
                resourceType: "role",
                status: "FAILURE",
                reason: "Attempted to delete role of equal or higher privilege",
                ipAddress,
                userAgent
            });
            return forbidden("Access denied. You can only delete roles that are strictly less privileged than your own role.");
        }

        // Check if assigned to any users
        const userCount = await env.DB
            .prepare(`SELECT count(*) as count FROM users WHERE role_id = ?`)
            .bind(id)
            .first();

        if (userCount?.count > 0) {
            return badRequest("The role cannot be deleted because it is currently assigned to one or more users.");
        }

        // Delete permissions and role
        await env.DB
            .prepare(`DELETE FROM role_permissions WHERE role_id = ?`)
            .bind(id)
            .run();

        await env.DB
            .prepare(`DELETE FROM roles WHERE id = ?`)
            .bind(id)
            .run();

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetRoleId: id,
            action: "role.delete",
            resourceType: "role",
            resourceId: id,
            status: "SUCCESS",
            ipAddress,
            userAgent,
            details: { deletedRoleName: role.name }
        });

        return success(null, "Role deleted successfully.");
    } catch (error) {
        console.error("Delete role error:", error);
        return serverError("Failed to delete role.");
    }
}

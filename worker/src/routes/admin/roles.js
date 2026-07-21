import { success, badRequest, notFound, conflict, serverError, forbidden } from "../../utils/response.js";
import { authenticate, isStrictlyLessPrivileged } from "../../utils/auth.js";

export const SYSTEM_PERMISSIONS = [
    { key: "dashboard.view", group: "Dashboard", description: "View dashboard widgets and charts" },
    { key: "vehicles.view", group: "Vehicles", description: "View vehicles inventory" },
    { key: "vehicles.create", group: "Vehicles", description: "Add new vehicles" },
    { key: "vehicles.edit", group: "Vehicles", description: "Edit vehicle details" },
    { key: "vehicles.delete", group: "Vehicles", description: "Delete vehicles" },
    { key: "vehicles.publish", group: "Vehicles", description: "Publish or unpublish vehicles" },
    { key: "settings.view", group: "Settings", description: "View system settings" },
    { key: "settings.edit", group: "Settings", description: "Modify system settings" },
    { key: "users.manage", group: "Users", description: "Manage administrative users" },
    { key: "roles.manage", group: "Roles", description: "Manage roles and permissions" },
    { key: "reports.accounting.view", group: "Reports", description: "View future accounting reports" }
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
        if (auth.user.role_id !== 1) {
            const filtered = [];
            for (const r of list) {
                if (await isStrictlyLessPrivileged(env, r.id, auth.user.role_id)) {
                    filtered.push(r);
                }
            }
            viewableRoles = filtered;
        }

        // Load assigned permissions count and user count for each role
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
    if (auth.user.role_id !== 1 && !(await isStrictlyLessPrivileged(env, id, auth.user.role_id))) {
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

    // Only Super Administrators may create roles
    if (auth.user.role_id !== 1) {
        return forbidden("Access denied. Only Super Administrators may create roles.");
    }

    try {
        const body = await request.json();
        const name = body.name?.trim();
        const description = body.description?.trim();
        const permissions = body.permissions || [];

        if (!name) {
            return badRequest("Role name is required.");
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
                INSERT INTO roles (name, description, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                RETURNING id, name, description, created_at, updated_at
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

        return success({
            ...role,
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

    // Only Super Administrators may edit roles
    if (auth.user.role_id !== 1) {
        return forbidden("Access denied. Only Super Administrators may modify roles.");
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid role ID.");
    }

    if (id === 1) {
        return badRequest("The system default Super Administrator role cannot be modified.");
    }

    try {
        const role = await env.DB
            .prepare(`SELECT * FROM roles WHERE id = ? LIMIT 1`)
            .bind(id)
            .first();

        if (!role) {
            return notFound("Role not found.");
        }

        const body = await request.json();
        const name = body.name?.trim();
        const description = body.description?.trim();
        const permissions = body.permissions;

        if (!name) {
            return badRequest("Role name is required.");
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

        // Update role
        const updated = await env.DB
            .prepare(`
                UPDATE roles
                SET name = ?, description = ?, updated_at = ?
                WHERE id = ?
                RETURNING id, name, description, created_at, updated_at
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

        return success({
            ...updated,
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

    // Only Super Administrators may delete roles
    if (auth.user.role_id !== 1) {
        return forbidden("Access denied. Only Super Administrators may delete roles.");
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid role ID.");
    }

    // Protect core roles (e.g., Admin role with id=1 should not be deleted)
    if (id === 1) {
        return badRequest("The system default Super Administrator role cannot be deleted.");
    }

    try {
        const role = await env.DB
            .prepare(`SELECT id FROM roles WHERE id = ? LIMIT 1`)
            .bind(id)
            .first();

        if (!role) {
            return notFound("Role not found.");
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

        return success(null, "Role deleted successfully.");
    } catch (error) {
        console.error("Delete role error:", error);
        return serverError("Failed to delete role.");
    }
}

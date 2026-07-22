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
import { authenticate, isStrictlyLessPrivileged } from "../../utils/auth.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { validatePasswordComplexity } from "../../utils/password-validator.js";
import { wouldCauseSuperAdminLockout } from "../../utils/lockout.js";
import { logAudit, getRequestMeta } from "../../utils/audit.js";

/**
 * GET /api/v1/admin/users
 */
export async function listUsers(request, env) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const users = await env.DB
            .prepare(`
                SELECT u.id, u.username, u.display_name, u.role_id, r.name as role_name, r.is_system_role, r.system_role_key, u.is_active, u.last_login_at, u.created_at, u.updated_at, u.must_change_password
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                ORDER BY u.id ASC
            `)
            .all();

        const results = users.results || [];

        // If not Super Administrator, filter list to only show users strictly less privileged than caller's role (plus self)
        let viewableUsers = results;
        if (!auth.user.is_super_admin) {
            const filtered = [];
            for (const u of results) {
                if (u.id === auth.user.id || (await isStrictlyLessPrivileged(env, u.role_id, auth.user.role_id))) {
                    filtered.push(u);
                }
            }
            viewableUsers = filtered;
        }

        const list = viewableUsers.map(u => ({
            ...u,
            is_active: u.is_active === 1,
            must_change_password: u.must_change_password === 1
        }));

        return success(list);
    } catch (error) {
        console.error("List users error:", error);
        return serverError();
    }
}

/**
 * GET /api/v1/admin/users/:id
 */
export async function getUser(request, env, ctx, params) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    try {
        const user = await env.DB
            .prepare(`
                SELECT u.id, u.username, u.display_name, u.role_id, r.name as role_name, r.is_system_role, r.system_role_key, u.is_active, u.last_login_at, u.created_at, u.updated_at, u.must_change_password
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = ?
                LIMIT 1
            `)
            .bind(id)
            .first();

        if (!user) {
            return notFound("User not found.");
        }

        // Delegated Administrator Guard: Cannot view details of someone equal or more privileged
        if (!auth.user.is_super_admin) {
            if (id !== auth.user.id && !(await isStrictlyLessPrivileged(env, user.role_id, auth.user.role_id))) {
                return forbidden("Access denied. You do not have permission to view this user's details.");
            }
        }

        return success({
            ...user,
            is_active: user.is_active === 1,
            must_change_password: user.must_change_password === 1
        });
    } catch (error) {
        console.error("Get user error:", error);
        return serverError();
    }
}

/**
 * POST /api/v1/admin/users
 */
export async function createUser(request, env) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    try {
        const body = await request.json();
        const username = body.username?.trim();
        const displayName = body.display_name?.trim();
        const roleId = parseInt(body.role_id);
        const isActive = body.is_active === undefined ? 1 : (body.is_active ? 1 : 0);

        if (!username || !displayName || isNaN(roleId)) {
            return badRequest("All fields (username, display_name, role_id) are required.");
        }

        // Validate role exists
        const roleExists = await env.DB
            .prepare(`SELECT id, name, is_system_role, system_role_key FROM roles WHERE id = ? LIMIT 1`)
            .bind(roleId)
            .first();

        if (!roleExists) {
            return badRequest("Invalid role. Selected role does not exist.");
        }

        // Role assignment check: Non-Super-Admin must only assign strictly less privileged roles
        if (!auth.user.is_super_admin) {
            if (!(await isStrictlyLessPrivileged(env, roleId, auth.user.role_id))) {
                await logAudit(env, {
                    actingUserId: auth.user.id,
                    actingUsername: auth.user.username,
                    targetRoleId: roleId,
                    action: "security.privilege_escalation_attempt",
                    resourceType: "user",
                    status: "FAILURE",
                    reason: "Attempted to assign role with equal or higher privilege",
                    ipAddress,
                    userAgent
                });
                return forbidden("You can only assign roles that are strictly less privileged than your own.");
            }
        }

        // Check unique username
        const existing = await env.DB
            .prepare(`SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`)
            .bind(username)
            .first();

        if (existing) {
            return conflict("Username is already taken.");
        }

        // Generate strong temporary password passing complexity requirements
        const charsUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const charsLower = "abcdefghijkmnopqrstuvwxyz";
        const charsNumbers = "23456789";
        const charsSpecial = "!@#$%^*()_+-=";

        let tempPassword = "Tmp!";
        const allChars = charsUpper + charsLower + charsNumbers + charsSpecial;
        const randomValues = new Uint32Array(8);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < 8; i++) {
            tempPassword += allChars.charAt(randomValues[i] % allChars.length);
        }

        const complexityCheck = validatePasswordComplexity(tempPassword);
        if (!complexityCheck.isValid) {
            tempPassword = "ResetPass123!";
        }

        // Hash password
        const passwordHash = await hashPassword(tempPassword);
        const now = new Date().toISOString();
        const roleSlug = roleExists.name.toLowerCase();

        const result = await env.DB
            .prepare(`
                INSERT INTO users (username, password_hash, display_name, role, role_id, is_active, must_change_password, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                RETURNING id, username, display_name, role_id, is_active, must_change_password, created_at, updated_at
            `)
            .bind(username, passwordHash, displayName, roleSlug, roleId, isActive, now, now)
            .first();

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetUserId: result.id,
            targetRoleId: roleId,
            action: "user.create",
            resourceType: "user",
            resourceId: result.id,
            status: "SUCCESS",
            ipAddress,
            userAgent,
            details: { username, displayName, roleId, roleName: roleExists.name, isActive: isActive === 1 }
        });

        return created({
            user: {
                ...result,
                role_name: roleExists.name,
                is_active: result.is_active === 1,
                must_change_password: result.must_change_password === 1
            },
            temporaryPassword: tempPassword
        });
    } catch (error) {
        console.error("Create user error:", error);
        return serverError("Failed to create user.");
    }
}

/**
 * PUT /api/v1/admin/users/:id
 */
export async function updateUser(request, env, ctx, params) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    try {
        const user = await env.DB
            .prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`)
            .bind(id)
            .first();

        if (!user) {
            return notFound("User not found.");
        }

        const body = await request.json();
        const displayName = body.display_name?.trim();
        const roleId = body.role_id === undefined ? undefined : parseInt(body.role_id);
        const isActive = body.is_active;

        // Security Checks: cannot deactivate or demote self
        if (id === auth.user.id) {
            if (isActive !== undefined && !isActive) {
                return badRequest("You cannot deactivate your own account.");
            }
            if (roleId !== undefined && roleId !== auth.user.role_id) {
                return badRequest("You cannot change your own role.");
            }
        }

        // Delegated Administrator Guard: Cannot modify someone equal or more privileged
        if (!auth.user.is_super_admin) {
            if (!(await isStrictlyLessPrivileged(env, user.role_id, auth.user.role_id))) {
                await logAudit(env, {
                    actingUserId: auth.user.id,
                    actingUsername: auth.user.username,
                    targetUserId: id,
                    action: "security.privilege_escalation_attempt",
                    resourceType: "user",
                    status: "FAILURE",
                    reason: "Attempted to modify user account of equal or higher privilege",
                    ipAddress,
                    userAgent
                });
                return forbidden("Access denied. You can only modify user accounts that are strictly less privileged than your own.");
            }

            // If changing role, new role must be strictly less privileged
            if (roleId !== undefined && !(await isStrictlyLessPrivileged(env, roleId, auth.user.role_id))) {
                await logAudit(env, {
                    actingUserId: auth.user.id,
                    actingUsername: auth.user.username,
                    targetUserId: id,
                    targetRoleId: roleId,
                    action: "security.privilege_escalation_attempt",
                    resourceType: "user",
                    status: "FAILURE",
                    reason: "Attempted to assign role of equal or higher privilege",
                    ipAddress,
                    userAgent
                });
                return forbidden("You can only assign roles that are strictly less privileged than your own.");
            }
        }

        // Lockout Prevention Check: ensure active Super Admin count does not drop below 1
        const causesLockout = await wouldCauseSuperAdminLockout(env, id, isActive, roleId);
        if (causesLockout) {
            await logAudit(env, {
                actingUserId: auth.user.id,
                actingUsername: auth.user.username,
                targetUserId: id,
                action: "user.update",
                resourceType: "user",
                status: "FAILURE",
                reason: "Administrative Lockout Prevention: Operation would leave zero active Super Administrators.",
                ipAddress,
                userAgent
            });
            return badRequest("Cannot deactivate or reassign the last active Super Administrator. At least one active Super Administrator account must exist.");
        }

        const updatedFields = [];
        const bindings = [];

        if (displayName !== undefined) {
            updatedFields.push("display_name = ?");
            bindings.push(displayName);
        }

        if (roleId !== undefined) {
            const roleExists = await env.DB
                .prepare(`SELECT id, name FROM roles WHERE id = ? LIMIT 1`)
                .bind(roleId)
                .first();

            if (!roleExists) {
                return badRequest("Invalid role. Selected role does not exist.");
            }
            updatedFields.push("role = ?");
            bindings.push(roleExists.name.toLowerCase());
            updatedFields.push("role_id = ?");
            bindings.push(roleId);
        }

        if (isActive !== undefined) {
            updatedFields.push("is_active = ?");
            bindings.push(isActive ? 1 : 0);
        }

        if (updatedFields.length === 0) {
            return badRequest("No editable fields provided.");
        }

        const now = new Date().toISOString();
        updatedFields.push("updated_at = ?");
        bindings.push(now);

        bindings.push(id);

        const query = `
            UPDATE users
            SET ${updatedFields.join(", ")}
            WHERE id = ?
            RETURNING id, username, display_name, role_id, is_active, must_change_password, created_at, updated_at
        `;

        const result = await env.DB
            .prepare(query)
            .bind(...bindings)
            .first();

        // Specific action audit
        let auditAction = "user.update";
        if (isActive !== undefined && Boolean(user.is_active) !== Boolean(isActive)) {
            auditAction = isActive ? "user.activate" : "user.deactivate";
        } else if (roleId !== undefined && user.role_id !== roleId) {
            auditAction = "role.assignment";
        }

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetUserId: id,
            targetRoleId: roleId !== undefined ? roleId : user.role_id,
            action: auditAction,
            resourceType: "user",
            resourceId: id,
            status: "SUCCESS",
            ipAddress,
            userAgent,
            details: { displayName, roleId, isActive }
        });

        return success({
            ...result,
            is_active: result.is_active === 1,
            must_change_password: result.must_change_password === 1
        });
    } catch (error) {
        console.error("Update user error:", error);
        return serverError("Failed to update user.");
    }
}

/**
 * DELETE /api/v1/admin/users/:id
 */
export async function deleteUser(request, env, ctx, params) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    if (id === auth.user.id) {
        return badRequest("You cannot delete your own account.");
    }

    try {
        const user = await env.DB
            .prepare(`
                SELECT u.id, u.username, u.role_id, r.is_system_role, r.system_role_key
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.id = ?
                LIMIT 1
            `)
            .bind(id)
            .first();

        if (!user) {
            return notFound("User not found.");
        }

        // Delegated Administrator Guard: Cannot delete someone equal or more privileged
        if (!auth.user.is_super_admin) {
            if (!(await isStrictlyLessPrivileged(env, user.role_id, auth.user.role_id))) {
                await logAudit(env, {
                    actingUserId: auth.user.id,
                    actingUsername: auth.user.username,
                    targetUserId: id,
                    action: "security.privilege_escalation_attempt",
                    resourceType: "user",
                    status: "FAILURE",
                    reason: "Attempted to delete user account of equal or higher privilege",
                    ipAddress,
                    userAgent
                });
                return forbidden("Access denied. You can only delete user accounts that are strictly less privileged than your own.");
            }
        }

        // Lockout Prevention Check: Ensure at least one active Super Admin remains
        const causesLockout = await wouldCauseSuperAdminLockout(env, id);
        if (causesLockout) {
            await logAudit(env, {
                actingUserId: auth.user.id,
                actingUsername: auth.user.username,
                targetUserId: id,
                action: "user.delete",
                resourceType: "user",
                status: "FAILURE",
                reason: "Administrative Lockout Prevention: Cannot delete the last active Super Administrator account.",
                ipAddress,
                userAgent
            });
            return badRequest("Cannot delete the last active Super Administrator account. At least one active Super Administrator must remain.");
        }

        await env.DB
            .prepare(`DELETE FROM users WHERE id = ?`)
            .bind(id)
            .run();

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetUserId: id,
            action: "user.delete",
            resourceType: "user",
            resourceId: id,
            status: "SUCCESS",
            ipAddress,
            userAgent,
            details: { deletedUsername: user.username }
        });

        return success(null, "User deleted successfully.");
    } catch (error) {
        console.error("Delete user error:", error);
        return serverError("Failed to delete user.");
    }
}

/**
 * POST /api/v1/admin/users/:id/reset-password
 */
export async function resetPassword(request, env, ctx, params) {
    const auth = await authenticate(request, env, "users.manage");
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    if (id === auth.user.id) {
        return badRequest("You cannot reset your own password. Please use the Change Password page.");
    }

    try {
        const user = await env.DB
            .prepare(`SELECT id, username, role_id FROM users WHERE id = ? LIMIT 1`)
            .bind(id)
            .first();

        if (!user) {
            return notFound("User not found.");
        }

        // Delegated Administrator Guard: Cannot reset password for someone equal or more privileged
        if (!auth.user.is_super_admin) {
            if (!(await isStrictlyLessPrivileged(env, user.role_id, auth.user.role_id))) {
                await logAudit(env, {
                    actingUserId: auth.user.id,
                    actingUsername: auth.user.username,
                    targetUserId: id,
                    action: "security.privilege_escalation_attempt",
                    resourceType: "user",
                    status: "FAILURE",
                    reason: "Attempted password reset on user of equal or higher privilege",
                    ipAddress,
                    userAgent
                });
                return forbidden("Access denied. You can only reset passwords for users who are strictly less privileged than your own role.");
            }
        }

        // Generate strong temporary password passing complexity requirements
        const charsUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const charsLower = "abcdefghijkmnopqrstuvwxyz";
        const charsNumbers = "23456789";
        const charsSpecial = "!@#$%^*()_+-=";

        let tempPassword = "Tmp!";
        const allChars = charsUpper + charsLower + charsNumbers + charsSpecial;
        const randomValues = new Uint32Array(8);
        crypto.getRandomValues(randomValues);
        for (let i = 0; i < 8; i++) {
            tempPassword += allChars.charAt(randomValues[i] % allChars.length);
        }

        const complexityCheck = validatePasswordComplexity(tempPassword);
        if (!complexityCheck.isValid) {
            tempPassword = "ResetPass123!";
        }

        const passwordHash = await hashPassword(tempPassword);
        const now = new Date().toISOString();

        await env.DB
            .prepare(`
                UPDATE users
                SET password_hash = ?, must_change_password = 1, updated_at = ?
                WHERE id = ?
            `)
            .bind(passwordHash, now, id)
            .run();

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetUserId: id,
            action: "user.password_reset",
            resourceType: "user",
            resourceId: id,
            status: "SUCCESS",
            ipAddress,
            userAgent
        });

        return success({
            temporaryPassword: tempPassword
        });
    } catch (error) {
        console.error("Reset password error:", error);
        return serverError("Failed to reset password.");
    }
}

/**
 * PUT /api/v1/admin/users/change-password
 * PUT /api/v1/admin/change-password
 */
export async function changePassword(request, env) {
    // Authenticate user, bypassing must_change_password block because they are changing their password!
    const auth = await authenticate(request, env, null, true);
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    try {
        const body = await request.json();
        const currentPassword = body.currentPassword;
        const newPassword = body.newPassword;

        if (!currentPassword || !newPassword) {
            return badRequest("Current password and new password are required.");
        }

        // Fetch stored password hash
        const storedUser = await env.DB
            .prepare(`SELECT password_hash, username FROM users WHERE id = ? LIMIT 1`)
            .bind(auth.user.id)
            .first();

        if (!storedUser) {
            return notFound("User not found.");
        }

        // Verify current password
        const isCurrentValid = await verifyPassword(currentPassword, storedUser.password_hash);
        if (!isCurrentValid) {
            await logAudit(env, {
                actingUserId: auth.user.id,
                actingUsername: auth.user.username,
                targetUserId: auth.user.id,
                action: "user.password_change",
                resourceType: "user",
                status: "FAILURE",
                reason: "Incorrect current password",
                ipAddress,
                userAgent
            });
            return badRequest("Incorrect current password.");
        }

        // Reject identical reuse
        if (currentPassword === newPassword) {
            return badRequest("New password cannot be the same as the current password.");
        }

        // Validate new password complexity
        const complexityCheck = validatePasswordComplexity(newPassword);
        if (!complexityCheck.isValid) {
            return badRequest(complexityCheck.message);
        }

        const newHash = await hashPassword(newPassword);
        const now = new Date().toISOString();

        await env.DB
            .prepare(`
                UPDATE users
                SET password_hash = ?, must_change_password = 0, updated_at = ?
                WHERE id = ?
            `)
            .bind(newHash, now, auth.user.id)
            .run();

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetUserId: auth.user.id,
            action: "user.password_change",
            resourceType: "user",
            resourceId: auth.user.id,
            status: "SUCCESS",
            ipAddress,
            userAgent
        });

        return success(null, "Password changed successfully.");
    } catch (error) {
        console.error("Change password error:", error);
        return serverError("Failed to update password.");
    }
}

/**
 * GET /api/v1/admin/profile
 */
export async function getProfile(request, env) {
    const auth = await authenticate(request, env);
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const user = await env.DB
            .prepare(`
                SELECT u.id, u.username, u.display_name, u.role_id, r.name as role_name, r.is_system_role, r.system_role_key, u.is_active, u.created_at, u.last_login_at
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = ?
                LIMIT 1
            `)
            .bind(auth.user.id)
            .first();

        if (!user) {
            return notFound("User not found.");
        }

        return success({
            ...user,
            is_active: user.is_active === 1,
            permissions: auth.permissions
        });
    } catch (error) {
        console.error("Get profile error:", error);
        return serverError("Failed to fetch profile.");
    }
}

/**
 * PUT /api/v1/admin/profile
 */
export async function updateProfile(request, env) {
    const auth = await authenticate(request, env);
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    try {
        const body = await request.json();
        const displayName = body.display_name?.trim();

        if (!displayName) {
            return badRequest("Display name is required.");
        }

        const now = new Date().toISOString();

        const result = await env.DB
            .prepare(`
                UPDATE users
                SET display_name = ?, updated_at = ?
                WHERE id = ?
                RETURNING id, username, display_name, role_id, is_active, created_at, updated_at
            `)
            .bind(displayName, now, auth.user.id)
            .first();

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetUserId: auth.user.id,
            action: "user.profile_update",
            resourceType: "user",
            resourceId: auth.user.id,
            status: "SUCCESS",
            ipAddress,
            userAgent,
            details: { displayName }
        });

        return success({
            ...result,
            is_active: result.is_active === 1,
            permissions: auth.permissions
        });
    } catch (error) {
        console.error("Update profile error:", error);
        return serverError("Failed to update profile.");
    }
}

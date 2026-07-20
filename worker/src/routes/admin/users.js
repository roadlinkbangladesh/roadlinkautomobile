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
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { validatePasswordComplexity } from "../../utils/password-validator.js";

/**
 * GET /api/v1/admin/users
 */
export async function listUsers(request, env) {
    const auth = await authenticate(request, env, "admin");
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const users = await env.DB
            .prepare(`
                SELECT id, username, display_name, role, is_active, last_login_at, created_at, updated_at, must_change_password
                FROM users
                ORDER BY id ASC
            `)
            .all();

        // Convert SQLite 1/0 to true/false for JSON consistency if desired, or keep as integer.
        // Let's normalize SQLite integers (0/1) to boolean for the frontend representation.
        const list = (users.results || []).map(u => ({
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
    const auth = await authenticate(request, env, "admin");
    if (auth.errorResponse) return auth.errorResponse;

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    try {
        const user = await env.DB
            .prepare(`
                SELECT id, username, display_name, role, is_active, last_login_at, created_at, updated_at, must_change_password
                FROM users
                WHERE id = ?
                LIMIT 1
            `)
            .bind(id)
            .first();

        if (!user) {
            return notFound("User not found.");
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
    const auth = await authenticate(request, env, "admin");
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const body = await request.json();
        const username = body.username?.trim();
        const password = body.password;
        const displayName = body.display_name?.trim();
        const role = body.role;
        const isActive = body.is_active === undefined ? 1 : (body.is_active ? 1 : 0);

        if (!username || !password || !displayName || !role) {
            return badRequest("All fields (username, password, display_name, role) are required.");
        }

        if (role !== "admin" && role !== "manager") {
            return badRequest("Invalid role. Role must be 'admin' or 'manager'.");
        }

        // Validate password complexity
        const complexityCheck = validatePasswordComplexity(password);
        if (!complexityCheck.isValid) {
            return badRequest(complexityCheck.message);
        }

        // Check unique username
        const existing = await env.DB
            .prepare(`
                SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1
            `)
            .bind(username)
            .first();

        if (existing) {
            return conflict("Username is already taken.");
        }

        // Hash password
        const passwordHash = await hashPassword(password);
        const now = new Date().toISOString();

        const result = await env.DB
            .prepare(`
                INSERT INTO users (username, password_hash, display_name, role, is_active, must_change_password, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?)
                RETURNING id, username, display_name, role, is_active, must_change_password, created_at, updated_at
            `)
            .bind(username, passwordHash, displayName, role, isActive, now, now)
            .first();

        return created({
            ...result,
            is_active: result.is_active === 1,
            must_change_password: result.must_change_password === 1
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
    const auth = await authenticate(request, env, "admin");
    if (auth.errorResponse) return auth.errorResponse;

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
        const role = body.role;
        const isActive = body.is_active;

        // Security Checks: cannot deactivate or demote self
        if (id === auth.user.id) {
            if (isActive !== undefined && !isActive) {
                return badRequest("You cannot deactivate your own account.");
            }
            if (role !== undefined && role !== "admin") {
                return badRequest("You cannot revoke your own administrator privileges.");
            }
        }

        const updatedFields = [];
        const bindings = [];

        if (displayName !== undefined) {
            updatedFields.push("display_name = ?");
            bindings.push(displayName);
        }

        if (role !== undefined) {
            if (role !== "admin" && role !== "manager") {
                return badRequest("Invalid role. Role must be 'admin' or 'manager'.");
            }
            updatedFields.push("role = ?");
            bindings.push(role);
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

        // Bind user ID for WHERE clause
        bindings.push(id);

        const query = `
            UPDATE users
            SET ${updatedFields.join(", ")}
            WHERE id = ?
            RETURNING id, username, display_name, role, is_active, must_change_password, created_at, updated_at
        `;

        const result = await env.DB
            .prepare(query)
            .bind(...bindings)
            .first();

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
    const auth = await authenticate(request, env, "admin");
    if (auth.errorResponse) return auth.errorResponse;

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    if (id === auth.user.id) {
        return badRequest("You cannot delete your own account.");
    }

    try {
        const user = await env.DB
            .prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`)
            .bind(id)
            .first();

        if (!user) {
            return notFound("User not found.");
        }

        await env.DB
            .prepare(`DELETE FROM users WHERE id = ?`)
            .bind(id)
            .run();

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
    const auth = await authenticate(request, env, "admin");
    if (auth.errorResponse) return auth.errorResponse;

    const id = parseInt(params.id);
    if (isNaN(id)) {
        return badRequest("Invalid user ID.");
    }

    if (id === auth.user.id) {
        return badRequest("You cannot reset your own password. Please use the Change Password page.");
    }

    try {
        const user = await env.DB
            .prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`)
            .bind(id)
            .first();

        if (!user) {
            return notFound("User not found.");
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

    try {
        const body = await request.json();
        const currentPassword = body.currentPassword;
        const newPassword = body.newPassword;

        if (!currentPassword || !newPassword) {
            return badRequest("Current password and new password are required.");
        }

        // Fetch stored password hash
        const storedUser = await env.DB
            .prepare(`SELECT password_hash FROM users WHERE id = ? LIMIT 1`)
            .bind(auth.user.id)
            .first();

        if (!storedUser) {
            return notFound("User not found.");
        }

        // Verify current password
        const isCurrentValid = await verifyPassword(currentPassword, storedUser.password_hash);
        if (!isCurrentValid) {
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

        return success(null, "Password changed successfully.");
    } catch (error) {
        console.error("Change password error:", error);
        return serverError("Failed to update password.");
    }
}

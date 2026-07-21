import { unauthorized, forbidden } from "./response.js";
import { verifyToken } from "./jwt.js";

/**
 * Common Authentication & Authorization Middleware for Workers
 */
export async function authenticate(request, env, requiredPermission = null, isChangePasswordRoute = false) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return { errorResponse: unauthorized("Authentication required.") };
    }

    const token = authHeader.substring(7);

    const decoded = await verifyToken(token, env.JWT_SECRET);
    if (!decoded) {
        return { errorResponse: unauthorized("Invalid or expired token.") };
    }

    // Retrieve active record directly from DB to verify constraints
    const user = await env.DB
        .prepare(`
            SELECT u.*, r.name as role_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = ?
            LIMIT 1
        `)
        .bind(decoded.id)
        .first();

    if (!user) {
        return { errorResponse: unauthorized("User not found.") };
    }

    if (user.is_active !== 1) {
        return { errorResponse: forbidden("Your account is deactivated.") };
    }

    // Retrieve role permissions
    const permissionsQuery = await env.DB
        .prepare(`
            SELECT permission_key
            FROM role_permissions
            WHERE role_id = ?
        `)
        .bind(user.role_id)
        .all();
    
    const permissions = (permissionsQuery.results || []).map(p => p.permission_key);

    // Protected endpoints must reject requests from users whose must_change_password flag is true,
    // except for change password or logout operations.
    if ((user.must_change_password === 1 || user.must_change_password === true) && !isChangePasswordRoute) {
        return {
            errorResponse: Response.json({
                success: false,
                mustChangePassword: true,
                message: "You must change your password before performing any other operations."
            }, {
                status: 403,
                headers: {
                    "Access-Control-Allow-Origin": "https://roadlinkautomobile.pages.dev",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization"
                }
            })
        };
    }

    if (requiredPermission && !permissions.includes(requiredPermission)) {
        return { errorResponse: forbidden("Access denied. Insufficient permissions.") };
    }

    return { user, permissions };
}

/**
 * Checks if roleA is strictly less privileged than roleB.
 * Super Administrator (role B ID === 1) is always more privileged than any other role (except itself).
 * For other roles, roleA is strictly less privileged if and only if roleA's permissions
 * are a strict subset of roleB's permissions.
 */
export async function isStrictlyLessPrivileged(env, roleAId, roleBId) {
    const rAId = parseInt(roleAId);
    const rBId = parseInt(roleBId);

    // If same role, they are equal, not strictly less privileged
    if (rAId === rBId) return false;

    // Super Administrator is more privileged than any other role
    if (rBId === 1) {
        return rAId !== 1;
    }
    // No other role is more or equally privileged than Super Administrator
    if (rAId === 1) {
        return false;
    }

    const permsAQuery = await env.DB
        .prepare(`SELECT permission_key FROM role_permissions WHERE role_id = ?`)
        .bind(rAId)
        .all();
    const permsBQuery = await env.DB
        .prepare(`SELECT permission_key FROM role_permissions WHERE role_id = ?`)
        .bind(rBId)
        .all();

    const permsA = (permsAQuery.results || []).map(rp => rp.permission_key);
    const permsB = (permsBQuery.results || []).map(rp => rp.permission_key);

    // Every permission in A must be present in B (subset)
    const isSubset = permsA.every(p => permsB.includes(p));
    if (!isSubset) return false;

    // B must have strictly more permissions than A (strict subset)
    return permsB.length > permsA.length;
}


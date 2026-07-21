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

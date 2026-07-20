import { unauthorized, forbidden } from "./response.js";
import { verifyToken } from "./jwt.js";

/**
 * Common Authentication & Authorization Middleware for Workers
 */
export async function authenticate(request, env, requiredRole = null, isChangePasswordRoute = false) {
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
            SELECT *
            FROM users
            WHERE id = ?
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

    if (requiredRole && user.role !== requiredRole) {
        return { errorResponse: forbidden("Access denied. Privileges required.") };
    }

    return { user };
}

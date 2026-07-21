import { badRequest, unauthorized, serverError, success } from "../../utils/response.js";
import { verifyPassword } from "../../utils/password.js";
import { createToken } from "../../utils/jwt.js";
import { JWT } from "../../config/constants.js";

export async function login(request, env) {

    try {
        
        const body = await request.json();
        
        const username = body.username?.trim();
        const password = body.password;
        const rememberMe = body.rememberMe === true;
        
        if (!username || !password) {
            return badRequest(
                "Username and password are required."
            );
        }

        const user = await env.DB
            .prepare(`
                SELECT u.*, r.name as role_name
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.username = ?
                LIMIT 1
            `)
            .bind(username)
            .first();
        
        if (!user) {
            return unauthorized(
                "Invalid username or password."
            );
        }
        
        const validPassword = await verifyPassword(
            password,
            user.password_hash
        );
        
        if (!validPassword) {
            return unauthorized(
                "Invalid username or password."
            );
        }
        
        // Determine token lifetime based on Remember Me selection
        
        const expiresIn = rememberMe
            ? JWT.REMEMBER_ME_EXPIRES_IN
            : JWT.SESSION_EXPIRES_IN;
        
        // Fetch user permissions
        const permissionsQuery = await env.DB
            .prepare(`
                SELECT permission_key
                FROM role_permissions
                WHERE role_id = ?
            `)
            .bind(user.role_id)
            .all();
        const permissions = (permissionsQuery.results || []).map(p => p.permission_key);

        // Generate JWT
        const token = await createToken(
            {
                id: user.id,
                username: user.username,
                role_id: user.role_id
            },
            env.JWT_SECRET,
            expiresIn
        );
        
        return success({
            token,
            mustChangePassword: user.must_change_password === 1 || user.must_change_password === true,
            user: {
                id: user.id,
                username: user.username,
                role_id: user.role_id,
                role_name: user.role_name,
                display_name: user.display_name,
                permissions: permissions
            }
        });
        
    } catch (error) {

        console.error(error);

        return serverError();

    }

}

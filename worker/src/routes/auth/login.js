import { badRequest, unauthorized, serverError, success } from "../../utils/response.js";
import { verifyPassword } from "../../utils/password.js";
import { createToken } from "../../utils/jwt.js";
import { JWT } from "../../config/constants.js";

export async function login(request, env) {

    try {

        const body = await request.json();

        const username = body.username?.trim();
        const password = body.password;

        if (!username || !password) {
            return badRequest(
                "Username and password are required."
            );
        }

        const user = await env.DB
            .prepare(`
                SELECT *
                FROM users
                WHERE username = ?
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
        
        const token = await createToken(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            env.JWT_SECRET,
            JWT.SESSION_EXPIRES_IN
        );
        
        return success({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
        
    } catch (error) {

        console.error(error);

        return serverError();

    }

}

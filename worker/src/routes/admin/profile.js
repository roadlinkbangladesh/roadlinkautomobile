import { success, unauthorized } from "../../utils/response.js";
import { verifyToken } from "../../utils/jwt.js";

export async function profile(request, env) {

    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return unauthorized("Authentication required.");
    }

    const token = authHeader.substring(7);

    const user = await verifyToken(
        token,
        env.JWT_SECRET
    );

    if (!user) {
        return unauthorized("Invalid or expired token.");
    }

    return success({
        id: user.id,
        username: user.username,
        role: user.role
    });

}

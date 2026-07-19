import {
    success,
    unauthorized,
    serverError
} from "../../utils/response.js";

import { verifyToken } from "../../utils/jwt.js";

export async function getSettings(request, env) {

    try {

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
            return unauthorized(
                "Invalid or expired token."
            );
        }

        return success({});

    } catch (error) {

        console.error(error);

        return serverError();

    }

}

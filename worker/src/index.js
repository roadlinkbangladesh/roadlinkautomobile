import { success, notFound, serverError } from "./utils/response.js";
import { API, APP } from "./config/constants.js";

import { login } from "./routes/auth/login.js";

const routes = {
    [`POST:${API.AUTH}/login`]: login
};

import { hashPassword, verifyPassword } from "./utils/password.js";

export default {
    async fetch() {

        const encoder = new TextEncoder();

        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode("admin123"),
            "PBKDF2",
            false,
            ["deriveBits"]
        );

        return Response.json({
            success: true,
            type: key.type,
            algorithm: key.algorithm.name
        });

    }
};

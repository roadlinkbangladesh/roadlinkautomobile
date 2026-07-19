import { success, notFound, serverError } from "./utils/response.js";
import { API, APP } from "./config/constants.js";

import { login } from "./routes/auth/login.js";

const routes = {
    [`POST:${API.AUTH}/login`]: login
};

import { hashPassword, verifyPassword } from "./utils/password.js";

export default {
    async fetch() {
        try {

            const encoder = new TextEncoder();

            const keyMaterial = await crypto.subtle.importKey(
                "raw",
                encoder.encode("admin123"),
                "PBKDF2",
                false,
                ["deriveBits"]
            );

            const salt = crypto.getRandomValues(new Uint8Array(16));

            const derived = await crypto.subtle.deriveBits(
                {
                    name: "PBKDF2",
                    hash: "SHA-256",
                    salt,
                    iterations: 600000
                },
                keyMaterial,
                32 * 8
            );

            return Response.json({
                success: true,
                bytes: new Uint8Array(derived).length
            });

        } catch (err) {

            return Response.json({
                success: false,
                name: err.name,
                message: err.message,
                stack: err.stack
            }, {
                status: 500
            });

        }
    }
};

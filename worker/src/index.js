import { success, notFound, serverError } from "./utils/response.js";
import { API, APP } from "./config/constants.js";

import { login } from "./routes/auth/login.js";

const routes = {
    [`POST:${API.AUTH}/login`]: login
};

import { hashPassword, verifyPassword } from "./utils/password.js";

export default {
    async fetch() {

        const password = "admin123";

        const hash = await hashPassword(password);

        const valid = await verifyPassword(
            "admin123",
            hash
        );

        const invalid = await verifyPassword(
            "wrongpassword",
            hash
        );

        return Response.json({
            hash,
            valid,
            invalid
        });
    }
};


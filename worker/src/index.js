import { success, notFound, serverError } from "./utils/response.js";
import { API, APP } from "./config/constants.js";

import { login } from "./routes/auth/login.js";

const routes = {
    [`POST:${API.AUTH}/login`]: login
};

import { hashPassword, verifyPassword } from "./utils/password.js";

export default {
    async fetch() {

        const salt = crypto.getRandomValues(new Uint8Array(16));

        return Response.json({
            success: true,
            saltLength: salt.length
        });

    }
};

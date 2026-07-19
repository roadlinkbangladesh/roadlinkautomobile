import { success, notFound, serverError } from "./utils/response.js";
import { API } from "./config/constants.js";

import { login } from "./routes/auth/login.js";

const routes = {
    [`POST:${API.AUTH}/login`]: login
};

import { hashPassword } from "./utils/password.js";

export default {
    async fetch() {

        const hash = await hashPassword("roadlink123");

        return Response.json({
            hash
        });

    }
};

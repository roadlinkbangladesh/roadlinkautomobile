import { success, notFound, serverError } from "./utils/response.js";
import { API } from "./config/constants.js";

import { login } from "./routes/auth/login.js";

const routes = {
    [`POST:${API.AUTH}/login`]: login
};

export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            const key = `${request.method}:${url.pathname}`;

            const handler = routes[key];

            if (!handler) {
                return notFound();
            }

            return await handler(request, env, ctx);

        } catch (error) {
            console.error(error);
            return serverError();
        }
    }
};

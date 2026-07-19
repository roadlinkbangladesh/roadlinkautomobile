import { success, notFound, serverError } from "./utils/response.js";
import { API, APP } from "./config/constants.js";

import { login } from "./routes/auth/login.js";

const routes = {
    [`POST:${API.AUTH}/login`]: login
};

export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);
            const routeKey = `${request.method}:${url.pathname}`;

            if (url.pathname === "/") {
                return success(
                    {
                        application: APP.NAME,
                        version: APP.VERSION
                    },
                    "Roadlink API is running."
                );
            }

            const handler = routes[routeKey];

            if (!handler) {
                return notFound("API endpoint not found.");
            }

            return await handler(request, env);

        } catch (error) {
            console.error(error);

            return serverError();
        }
    }
};

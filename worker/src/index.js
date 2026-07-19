import { API } from "./config/constants.js";
import { success, notFound, serverError } from "./utils/response.js";

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
                        application: "Roadlink API",
                        version: "1.0.0"
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

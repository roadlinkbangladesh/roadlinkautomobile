import { preflight, notFound, serverError } from "./utils/response.js";
import { API } from "./config/constants.js";
import { login } from "./routes/auth/login.js";
import { getSettings, updateSettings } from "./routes/admin/settings.js";

const routes = {

    // Authentication
    [`POST:${API.AUTH}/login`]: login,

    // Settings
    [`GET:${API.ADMIN}/settings`]: getSettings,
    [`PUT:${API.ADMIN}/settings`]: updateSettings,

};

export default {
    async fetch(request, env, ctx) {

        // Handle CORS preflight requests
        if (request.method === "OPTIONS") {
            return preflight(env);
        }
        
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

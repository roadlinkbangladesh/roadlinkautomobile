import { preflight, notFound, serverError } from "./utils/response.js";
import { API } from "./config/constants.js";
import { login } from "./routes/auth/login.js";
import { getSettings, updateSettings } from "./routes/admin/settings.js";
import {
    listUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    changePassword
} from "./routes/admin/users.js";

const routes = {

    // Authentication
    [`POST:${API.AUTH}/login`]: login,

    // Settings
    [`GET:${API.ADMIN}/settings`]: getSettings,
    [`PUT:${API.ADMIN}/settings`]: updateSettings,

    // User Management
    [`GET:${API.ADMIN}/users`]: listUsers,
    [`POST:${API.ADMIN}/users`]: createUser,
    [`GET:${API.ADMIN}/users/:id`]: getUser,
    [`PUT:${API.ADMIN}/users/:id`]: updateUser,
    [`DELETE:${API.ADMIN}/users/:id`]: deleteUser,
    [`POST:${API.ADMIN}/users/:id/reset-password`]: resetPassword,
    [`PUT:${API.ADMIN}/users/change-password`]: changePassword,
    [`PUT:${API.ADMIN}/change-password`]: changePassword,

};

export default {
    async fetch(request, env, ctx) {

        // Handle CORS preflight requests
        if (request.method === "OPTIONS") {
            return preflight(env);
        }
        
        try {
            const url = new URL(request.url);
            const pathname = url.pathname;
            const method = request.method;

            let handler = null;
            let params = {};

            // Find matching route by scanning keys and converting parameters to regex patterns
            // Sort keys so that routes without parameter placeholders (no ":") are processed first
            const sortedRouteKeys = Object.keys(routes).sort((a, b) => {
                const aPath = a.split(":").slice(1).join(":");
                const bPath = b.split(":").slice(1).join(":");
                const aHasPlaceholder = aPath.includes(":");
                const bHasPlaceholder = bPath.includes(":");
                
                if (aHasPlaceholder && !bHasPlaceholder) return 1;
                if (!aHasPlaceholder && bHasPlaceholder) return -1;
                return 0;
            });

            for (const routeKey of sortedRouteKeys) {
                const parts = routeKey.split(":");
                const routeMethod = parts[0];
                // Joint in case the route path contains colons, though usually it's just path
                const routePath = parts.slice(1).join(":");

                if (routeMethod !== method) continue;

                const regexPath = routePath.replace(/:[a-zA-Z0-9_]+/g, "([^/]+)");
                const regex = new RegExp(`^${regexPath}$`);
                const match = pathname.match(regex);

                if (match) {
                    handler = routes[routeKey];
                    const paramNames = (routePath.match(/:[a-zA-Z0-9_]+/g) || []).map(p => p.slice(1));
                    paramNames.forEach((name, idx) => {
                        params[name] = match[idx + 1];
                    });
                    break;
                }
            }

            if (!handler) {
                return notFound();
            }

            return await handler(request, env, ctx, params);

        } catch (error) {
            console.error(error);
            return serverError();
        }
    }
};

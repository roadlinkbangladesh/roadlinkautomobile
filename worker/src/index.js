import { success, notFound } from "./utils/response.js";
import { API, APP } from "./config/constants.js";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/") {
            return success({
                application: APP.NAME,
                version: APP.VERSION
            }, "Roadlink API is running.");
        }

        if (url.pathname.startsWith(API.PREFIX)) {
            return notFound("API endpoint not found.");
        }

        return notFound("Resource not found.");
    }
};

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
    changePassword,
    getProfile,
    updateProfile
} from "./routes/admin/users.js";
import {
    listRoles,
    getRole,
    createRole,
    updateRole,
    deleteRole,
    listPermissions
} from "./routes/admin/roles.js";
import {
    listAuditLogs,
    exportAuditLogs
} from "./routes/admin/audit_logs.js";
import {
    listAdminVehicles,
    getAdminVehicle,
    createAdminVehicle,
    updateAdminVehicle,
    deleteAdminVehicle,
    updateAdminVehicleStatus,
    getDashboardStats,
    uploadFile
} from "./routes/admin/vehicles.js";
import {
    listPublicVehicles,
    getPublicVehicle,
    getPublicSettings,
    getPublicFile,
    getPublicImage
} from "./routes/public/vehicles.js";
import {
    getPublicLocations,
    getPublicLocationBySlug
} from "./routes/public/locations.js";
import {
    listAdminLocations,
    createAdminLocation,
    updateAdminLocation,
    deleteAdminLocation,
    reorderAdminLocations,
    setDefaultAdminLocation
} from "./routes/admin/locations.js";
import {
    listAdminCarouselSlides,
    createAdminCarouselSlide,
    updateAdminCarouselSlide,
    deleteAdminCarouselSlide,
    reorderAdminCarouselSlides
} from "./routes/admin/carousel.js";
import { getPublicCarousel } from "./routes/public/carousel.js";
import {
    listAdminTestimonials,
    createAdminTestimonial,
    updateAdminTestimonial,
    deleteAdminTestimonial,
    reorderAdminTestimonials
} from "./routes/admin/testimonials.js";
import { getPublicTestimonials } from "./routes/public/testimonials.js";
import { runMaintenanceTasks } from "./routes/admin/maintenance.js";

const routes = {

    // Public API
    [`GET:${API.PUBLIC}/vehicles`]: listPublicVehicles,
    [`GET:${API.PUBLIC}/vehicles/:identifier`]: getPublicVehicle,
    [`GET:${API.PUBLIC}/settings`]: getPublicSettings,
    [`GET:${API.PUBLIC}/files/:key`]: getPublicFile,
    [`GET:${API.PUBLIC}/images/:key`]: getPublicImage,

    // Public Locations
    [`GET:${API.PUBLIC}/locations`]: getPublicLocations,
    [`GET:${API.PUBLIC}/locations/:slug`]: getPublicLocationBySlug,

    // Public Carousel & Testimonials
    [`GET:${API.PUBLIC}/carousel`]: getPublicCarousel,
    [`GET:${API.PUBLIC}/testimonials`]: getPublicTestimonials,

    // Authentication
    [`POST:${API.AUTH}/login`]: login,

    // Settings
    [`GET:${API.ADMIN}/settings`]: getSettings,
    [`PUT:${API.ADMIN}/settings`]: updateSettings,

    // Platform Maintenance & Retention
    [`POST:${API.ADMIN}/maintenance/run`]: runMaintenanceTasks,

    // Homepage Carousel Management
    [`GET:${API.ADMIN}/carousel`]: listAdminCarouselSlides,
    [`POST:${API.ADMIN}/carousel`]: createAdminCarouselSlide,
    [`PUT:${API.ADMIN}/carousel/reorder`]: reorderAdminCarouselSlides,
    [`PUT:${API.ADMIN}/carousel/:id`]: updateAdminCarouselSlide,
    [`DELETE:${API.ADMIN}/carousel/:id`]: deleteAdminCarouselSlide,

    // Testimonials Management
    [`GET:${API.ADMIN}/testimonials`]: listAdminTestimonials,
    [`POST:${API.ADMIN}/testimonials`]: createAdminTestimonial,
    [`PUT:${API.ADMIN}/testimonials/reorder`]: reorderAdminTestimonials,
    [`PUT:${API.ADMIN}/testimonials/:id`]: updateAdminTestimonial,
    [`DELETE:${API.ADMIN}/testimonials/:id`]: deleteAdminTestimonial,

    // Business Locations Management
    [`GET:${API.ADMIN}/locations`]: listAdminLocations,
    [`POST:${API.ADMIN}/locations`]: createAdminLocation,
    [`PUT:${API.ADMIN}/locations/reorder`]: reorderAdminLocations,
    [`PUT:${API.ADMIN}/locations/:id/default`]: setDefaultAdminLocation,
    [`PUT:${API.ADMIN}/locations/:id`]: updateAdminLocation,
    [`DELETE:${API.ADMIN}/locations/:id`]: deleteAdminLocation,

    // Dashboard Statistics
    [`GET:${API.ADMIN}/dashboard/stats`]: getDashboardStats,

    // File Upload (R2 Storage)
    [`POST:${API.ADMIN}/upload`]: uploadFile,

    // Vehicle Management
    [`GET:${API.ADMIN}/vehicles`]: listAdminVehicles,
    [`POST:${API.ADMIN}/vehicles`]: createAdminVehicle,
    [`GET:${API.ADMIN}/vehicles/:id`]: getAdminVehicle,
    [`PUT:${API.ADMIN}/vehicles/:id`]: updateAdminVehicle,
    [`DELETE:${API.ADMIN}/vehicles/:id`]: deleteAdminVehicle,
    [`PUT:${API.ADMIN}/vehicles/:id/status`]: updateAdminVehicleStatus,

    // User Management
    [`GET:${API.ADMIN}/users`]: listUsers,
    [`POST:${API.ADMIN}/users`]: createUser,
    [`GET:${API.ADMIN}/users/:id`]: getUser,
    [`PUT:${API.ADMIN}/users/:id`]: updateUser,
    [`DELETE:${API.ADMIN}/users/:id`]: deleteUser,
    [`POST:${API.ADMIN}/users/:id/reset-password`]: resetPassword,
    [`PUT:${API.ADMIN}/users/change-password`]: changePassword,
    [`PUT:${API.ADMIN}/change-password`]: changePassword,

    // Profile Management
    [`GET:${API.ADMIN}/profile`]: getProfile,
    [`PUT:${API.ADMIN}/profile`]: updateProfile,

    // Roles & Permissions Management
    [`GET:${API.ADMIN}/permissions`]: listPermissions,
    [`GET:${API.ADMIN}/roles`]: listRoles,
    [`POST:${API.ADMIN}/roles`]: createRole,
    [`GET:${API.ADMIN}/roles/:id`]: getRole,
    [`PUT:${API.ADMIN}/roles/:id`]: updateRole,
    [`DELETE:${API.ADMIN}/roles/:id`]: deleteRole,

    // Security Audit Logs (Append-Only)
    [`GET:${API.ADMIN}/audit-logs`]: listAuditLogs,
    [`GET:${API.ADMIN}/audit-logs/export`]: exportAuditLogs,

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

                const regexPath = routePath.replace(/:key/g, "(.+)").replace(/:[a-zA-Z0-9_]+/g, "([^/]+)");
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

            console.log("Incoming request:", method, pathname);
            
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

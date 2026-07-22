import { success, serverError } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { logAudit, getRequestMeta } from "../../utils/audit.js";

export async function getSettings(request, env) {
    const auth = await authenticate(request, env, "settings.view");
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const settings = await env.DB
            .prepare(`SELECT * FROM settings LIMIT 1`)
            .first();
        
        return success(settings);
    } catch (error) {
        console.error("Get settings error:", error);
        return serverError();
    }
}

export async function updateSettings(request, env) {
    const auth = await authenticate(request, env, "settings.edit");
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    try {
        const body = await request.json();
        const now = new Date().toISOString();

        await env.DB
            .prepare(`
                UPDATE settings
                SET company_name = ?, phone = ?, whatsapp = ?, email = ?, address = ?,
                    facebook = ?, youtube = ?, display_timezone = ?, display_locale = ?,
                    default_currency = ?, session_timeout_minutes = ?, archive_retention_days = ?,
                    seo_title_suffix = ?, seo_default_keywords = ?, seo_default_description = ?,
                    updated_at = ?
                WHERE id = 1
            `)
            .bind(
                body.company_name, body.phone, body.whatsapp, body.email, body.address,
                body.facebook, body.youtube, body.display_timezone, body.display_locale,
                body.default_currency, body.session_timeout_minutes, body.archive_retention_days,
                body.seo_title_suffix, body.seo_default_keywords, body.seo_default_description,
                now
            )
            .run();

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            action: "settings.update",
            resourceType: "settings",
            resourceId: "1",
            status: "SUCCESS",
            ipAddress,
            userAgent
        });

        return success(null, "Settings updated successfully.");
    } catch (error) {
        console.error("Update settings error:", error);
        return serverError("Failed to update settings.");
    }
}

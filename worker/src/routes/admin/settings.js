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

        const companyName = body.company_name || body.companyName || "";
        const phone = body.phone || "";
        const whatsapp = body.whatsapp || "";
        const email = body.email || "";
        const address = body.address || "";
        const facebook = body.facebook || body.facebookUrl || "";
        const youtube = body.youtube || body.youtubeUrl || "";
        const displayTimezone = body.display_timezone || body.displayTimezone || "Asia/Dhaka";
        const displayLocale = body.display_locale || body.displayLocale || "en-BD";
        const defaultCurrency = body.default_currency || body.defaultCurrency || "BDT";
        const sessionTimeoutMinutes = body.session_timeout_minutes || body.sessionTimeoutMinutes || 30;
        const archiveRetentionDays = body.archive_retention_days || body.archiveRetentionDays || 180;
        const seoTitleSuffix = body.seo_title_suffix || body.seoTitleSuffix || "";
        const seoDefaultKeywords = body.seo_default_keywords || body.seoDefaultKeywords || "";
        const seoDefaultDescription = body.seo_default_description || body.seoDefaultDescription || "";

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
                companyName, phone, whatsapp, email, address,
                facebook, youtube, displayTimezone, displayLocale,
                defaultCurrency, sessionTimeoutMinutes, archiveRetentionDays,
                seoTitleSuffix, seoDefaultKeywords, seoDefaultDescription,
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

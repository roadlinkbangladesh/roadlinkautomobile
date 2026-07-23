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

        // Contact Methods
        const showroomAddress = body.showroom_address ?? body.showroomAddress ?? body.address ?? "";
        const showroomPhone = body.showroom_phone ?? body.showroomPhone ?? body.phone ?? "";
        const showShowroom = (body.show_showroom ?? body.showShowroom ?? true) ? 1 : 0;

        const corporateAddress = body.corporate_address ?? body.corporateAddress ?? "";
        const corporatePhone = body.corporate_phone ?? body.corporatePhone ?? "";
        const showCorporate = (body.show_corporate ?? body.showCorporate ?? false) ? 1 : 0;

        const contactName = body.contact_name ?? body.contactName ?? "";
        const contactPhone = body.contact_phone ?? body.contactPhone ?? "";
        const showPrimaryContact = (body.show_primary_contact ?? body.showPrimaryContact ?? false) ? 1 : 0;

        const whatsapp = body.whatsapp ?? "";
        const showWhatsapp = (body.show_whatsapp ?? body.showWhatsapp ?? true) ? 1 : 0;

        const email = body.email ?? "";
        const showEmail = (body.show_email ?? body.showEmail ?? true) ? 1 : 0;

        // Legacy compatibility aliases
        const phone = showroomPhone || contactPhone || body.phone || "";
        const address = showroomAddress || corporateAddress || body.address || "";

        await env.DB
            .prepare(`
                UPDATE settings
                SET company_name = ?, phone = ?, whatsapp = ?, email = ?, address = ?,
                    facebook = ?, youtube = ?, display_timezone = ?, display_locale = ?,
                    default_currency = ?, session_timeout_minutes = ?, archive_retention_days = ?,
                    seo_title_suffix = ?, seo_default_keywords = ?, seo_default_description = ?,
                    showroom_address = ?, showroom_phone = ?, show_showroom = ?,
                    corporate_address = ?, corporate_phone = ?, show_corporate = ?,
                    contact_name = ?, contact_phone = ?, show_primary_contact = ?,
                    show_whatsapp = ?, show_email = ?,
                    updated_at = ?
                WHERE id = 1
            `)
            .bind(
                companyName, phone, whatsapp, email, address,
                facebook, youtube, displayTimezone, displayLocale,
                defaultCurrency, sessionTimeoutMinutes, archiveRetentionDays,
                seoTitleSuffix, seoDefaultKeywords, seoDefaultDescription,
                showroomAddress, showroomPhone, showShowroom,
                corporateAddress, corporatePhone, showCorporate,
                contactName, contactPhone, showPrimaryContact,
                showWhatsapp, showEmail,
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

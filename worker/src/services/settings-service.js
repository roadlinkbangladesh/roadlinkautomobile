import { SettingsRepository } from "../repositories/settings-repository.js";
import { deleteSupersededMedia } from "./orphan-cleanup.js";
import { validateEmail } from "../utils/validator.js";
import { logAudit } from "../utils/audit.js";
import { platformConfig } from "./platform-config.js";

export class SettingsDomainError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = "SettingsDomainError";
    this.status = status;
    this.code = code;
  }
}

export class SettingsService {
  /**
   * Get settings for admin
   */
  static async getSettings(env) {
    return await SettingsRepository.getSettings(env.DB);
  }

  /**
   * Get settings for public site
   */
  static async getPublicSettings(env) {
    return await SettingsRepository.getPublicSettings(env.DB);
  }

  /**
   * Update platform settings
   */
  static async updateSettings(env, authUser, body, meta) {
    const { ipAddress, userAgent } = meta;

    const currentSettings = await SettingsRepository.getSettings(env.DB);

    const companyName = body.company_name || body.companyName || "";
    if (!companyName.trim()) {
      throw new SettingsDomainError("Company name is required.", 422);
    }

    const email = body.email ?? "";
    if (email) {
      const emailErr = validateEmail(email);
      if (emailErr) {
        throw new SettingsDomainError(emailErr, 422);
      }
    }

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
    const showEmail = (body.show_email ?? body.showEmail ?? true) ? 1 : 0;

    // Branding assets
    const companyLogoUrl = body.company_logo_url ?? body.companyLogoUrl ?? null;
    const faviconUrl = body.favicon_url ?? body.faviconUrl ?? null;
    const stockBannerUrl = body.stock_banner_url ?? body.stockBannerUrl ?? null;

    // Website Metadata & OG assets
    const websiteTitle = body.website_title ?? body.websiteTitle ?? currentSettings?.website_title ?? companyName;
    const websiteDescription = body.website_description ?? body.websiteDescription ?? currentSettings?.website_description ?? seoDefaultDescription;
    const ogTitle = body.og_title ?? body.ogTitle ?? currentSettings?.og_title ?? "";
    const ogDescription = body.og_description ?? body.ogDescription ?? currentSettings?.og_description ?? "";
    const ogImageUrl = body.og_image_url ?? body.ogImageUrl ?? null;

    const twitterTitle = body.twitter_title ?? body.twitterTitle ?? currentSettings?.twitter_title ?? "";
    const twitterDescription = body.twitter_description ?? body.twitterDescription ?? currentSettings?.twitter_description ?? "";
    const twitterImageUrl = body.twitter_image_url ?? body.twitterImageUrl ?? null;
    let twitterUsername = body.twitter_username ?? body.twitterUsername ?? currentSettings?.twitter_username ?? "";
    if (twitterUsername) {
      twitterUsername = twitterUsername.trim();
      if (twitterUsername && !twitterUsername.startsWith("@")) {
        twitterUsername = "@" + twitterUsername;
      }
    }

    // Why Choose Us cards (JSON string array)
    let whyChooseUs = body.why_choose_us ?? body.whyChooseUs;
    if (Array.isArray(whyChooseUs) || typeof whyChooseUs === "object") {
      whyChooseUs = JSON.stringify(whyChooseUs);
    } else if (typeof whyChooseUs !== "string") {
      whyChooseUs = currentSettings?.why_choose_us || "";
    }

    // Configurable Public Website URL
    let publicWebsiteUrl = body.public_website_url ?? body.publicWebsiteUrl ?? currentSettings?.public_website_url ?? "../";
    if (publicWebsiteUrl && publicWebsiteUrl.trim()) {
      const trimmedUrl = publicWebsiteUrl.trim();
      if (trimmedUrl !== "../" && !trimmedUrl.startsWith("./") && !trimmedUrl.startsWith("/")) {
        try {
          const parsed = new URL(trimmedUrl);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("Invalid protocol");
          }
        } catch (e) {
          throw new SettingsDomainError("Public Website URL must be a valid HTTPS or HTTP URL.", 422);
        }
      }
      publicWebsiteUrl = trimmedUrl;
    }

    // Cleanup old media assets if replaced
    if (currentSettings) {
      if (companyLogoUrl && companyLogoUrl !== currentSettings.company_logo_url) {
        await deleteSupersededMedia(env, currentSettings.company_logo_url, companyLogoUrl);
      }
      if (faviconUrl && faviconUrl !== currentSettings.favicon_url) {
        await deleteSupersededMedia(env, currentSettings.favicon_url, faviconUrl);
      }
      if (stockBannerUrl && stockBannerUrl !== currentSettings.stock_banner_url) {
        await deleteSupersededMedia(env, currentSettings.stock_banner_url, stockBannerUrl);
      }
      if (ogImageUrl && ogImageUrl !== currentSettings.og_image_url) {
        await deleteSupersededMedia(env, currentSettings.og_image_url, ogImageUrl);
      }
      if (twitterImageUrl && twitterImageUrl !== currentSettings.twitter_image_url) {
        await deleteSupersededMedia(env, currentSettings.twitter_image_url, twitterImageUrl);
      }
    }

    // Featured Vehicles limit (Min: 1, Max: 9, Default: 6)
    let featuredVehiclesLimit = parseInt(body.featured_vehicles_limit ?? body.featuredVehiclesLimit ?? 6, 10);
    if (isNaN(featuredVehiclesLimit) || featuredVehiclesLimit < 1 || featuredVehiclesLimit > 9) {
      throw new SettingsDomainError("Featured vehicles limit must be an integer between 1 and 9.", 400);
    }

    const showSoldVehicles = (body.show_sold_vehicles ?? body.showSoldVehicles ?? false) ? 1 : 0;

    const phone = showroomPhone || contactPhone || body.phone || "";
    const address = showroomAddress || corporateAddress || body.address || "";

    const rawCompanySlug = body.company_slug || body.companySlug || "";
    let companySlug = rawCompanySlug.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!companySlug) {
      companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "roadlink";
    }

    const updated = await SettingsRepository.updateSettings(env.DB, {
      companyName, companySlug, phone, whatsapp, email, address,
      facebook, youtube, displayTimezone, displayLocale,
      defaultCurrency, sessionTimeoutMinutes, archiveRetentionDays,
      seoTitleSuffix, seoDefaultKeywords, seoDefaultDescription,
      showroomAddress, showroomPhone, showShowroom,
      corporateAddress, corporatePhone, showCorporate,
      contactName, contactPhone, showPrimaryContact,
      showWhatsapp, showEmail,
      companyLogoUrl, faviconUrl, stockBannerUrl, featuredVehiclesLimit, showSoldVehicles,
      whyChooseUs, websiteTitle, websiteDescription,
      ogTitle, ogDescription, ogImageUrl,
      twitterTitle, twitterDescription, twitterImageUrl, twitterUsername,
      publicWebsiteUrl
    });

    // Invalidate Platform Config in-memory cache upon settings update
    platformConfig.clearCache();

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      action: "settings.update",
      resourceType: "settings",
      resourceId: "1",
      status: "SUCCESS",
      ipAddress,
      userAgent
    });

    return updated;
  }
}

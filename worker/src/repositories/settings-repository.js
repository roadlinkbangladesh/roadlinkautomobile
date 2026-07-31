/**
 * Repository handling database access for Platform Settings.
 */
export class SettingsRepository {
  /**
   * Get full settings record for admin
   * @param {Object} db
   * @returns {Promise<Object|null>}
   */
  static async getSettings(db) {
    return await db.prepare(`SELECT * FROM settings WHERE id = 1 LIMIT 1`).first() || null;
  }

  /**
   * Get public settings record
   * @param {Object} db
   * @returns {Promise<Object|null>}
   */
  static async getPublicSettings(db) {
    return await db.prepare(`
      SELECT 
        company_name, company_slug, phone, whatsapp, email, address, 
        facebook, youtube, default_currency, seo_title_suffix, 
        seo_default_keywords, seo_default_description, 
        contact_name, contact_phone, show_primary_contact, show_whatsapp, show_email, 
        company_logo_url, favicon_url, stock_banner_url, 
        featured_vehicles_limit, show_sold_vehicles,
        why_choose_us, website_title, website_description,
        og_title, og_description, og_image_url,
        twitter_title, twitter_description, twitter_image_url,
        public_website_url
      FROM settings 
      WHERE id = 1
    `).first() || null;
  }

  /**
   * Update platform settings row (id = 1)
   * @param {Object} db
   * @param {Object} params
   */
  static async updateSettings(db, params) {
    const now = new Date().toISOString();
    await db
      .prepare(`
        UPDATE settings
        SET company_name = ?, company_slug = ?, phone = ?, whatsapp = ?, email = ?, address = ?,
            facebook = ?, youtube = ?, display_timezone = ?, display_locale = ?,
            default_currency = ?, session_timeout_minutes = ?, archive_retention_days = ?,
            seo_title_suffix = ?, seo_default_keywords = ?, seo_default_description = ?,
            showroom_address = ?, showroom_phone = ?, show_showroom = ?,
            corporate_address = ?, corporate_phone = ?, show_corporate = ?,
            contact_name = ?, contact_phone = ?, show_primary_contact = ?,
            show_whatsapp = ?, show_email = ?,
            company_logo_url = ?, favicon_url = ?, stock_banner_url = ?, featured_vehicles_limit = ?, show_sold_vehicles = ?,
            why_choose_us = ?, website_title = ?, website_description = ?,
            og_title = ?, og_description = ?, og_image_url = ?,
            twitter_title = ?, twitter_description = ?, twitter_image_url = ?,
            public_website_url = ?,
            updated_at = ?
        WHERE id = 1
      `)
      .bind(
        params.companyName, params.companySlug, params.phone, params.whatsapp, params.email, params.address,
        params.facebook, params.youtube, params.displayTimezone, params.displayLocale,
        params.defaultCurrency, params.sessionTimeoutMinutes, params.archiveRetentionDays,
        params.seoTitleSuffix, params.seoDefaultKeywords, params.seoDefaultDescription,
        params.showroomAddress, params.showroomPhone, params.showShowroom,
        params.corporateAddress, params.corporatePhone, params.showCorporate,
        params.contactName, params.contactPhone, params.showPrimaryContact,
        params.showWhatsapp, params.showEmail,
        params.companyLogoUrl, params.faviconUrl, params.stockBannerUrl, params.featuredVehiclesLimit, params.showSoldVehicles,
        params.whyChooseUs, params.websiteTitle, params.websiteDescription,
        params.ogTitle, params.ogDescription, params.ogImageUrl,
        params.twitterTitle, params.twitterDescription, params.twitterImageUrl,
        params.publicWebsiteUrl,
        now
      )
      .run();

    return await this.getSettings(db);
  }
}

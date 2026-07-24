import { success, serverError } from "../../utils/response.js";

/**
 * GET /api/v1/public/settings - Get public website settings (no authentication required)
 */
export async function getPublicSettings(request, env) {
  try {
    const settings = await env.DB.prepare(`
      SELECT 
        company_name, company_slug, phone, whatsapp, email, address, 
        facebook, youtube, default_currency, seo_title_suffix, 
        seo_default_keywords, seo_default_description, 
        contact_name, contact_phone, show_primary_contact, show_whatsapp, show_email, 
        company_logo_url, favicon_url, stock_banner_url, 
        featured_vehicles_limit, show_sold_vehicles 
      FROM settings 
      WHERE id = 1
    `).first();
    return success(settings);
  } catch (error) {
    console.error("Get public settings error:", error);
    return serverError("Failed to fetch website settings.");
  }
}

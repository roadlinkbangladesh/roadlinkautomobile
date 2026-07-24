/**
 * Platform Configuration Service (Backend-Only)
 * Provides strongly-typed platform policy configuration loaded from D1.
 * Policies are never exposed via APIs or Admin Portal UI.
 */

const DEFAULT_CONFIG = {
  archive_after_months: 12,      // Sold vehicles auto-archiving threshold
  max_vehicle_images: 15,        // Max vehicle images per vehicle
  max_image_upload_mb: 5,        // Max size for image uploads
  max_image_width: 1920,         // Target max width
  image_quality: 85,             // Target compression quality
  max_auction_sheet_mb: 20,      // Max size for PDF auction sheet
  orphan_cleanup_days: 7         // Threshold in days for unreferenced orphan files
};

class PlatformConfigService {
  constructor() {
    this._cache = null;
    this._lastFetched = 0;
    this._ttlMs = 60 * 1000; // 1 minute memory cache TTL
  }

  /**
   * Loads configuration from D1 table platform_configuration
   */
  async getConfig(env) {
    const now = Date.now();
    if (this._cache && (now - this._lastFetched < this._ttlMs)) {
      return this._cache;
    }

    const config = { ...DEFAULT_CONFIG };

    if (env && env.DB) {
      try {
        const rowsRes = await env.DB.prepare(`SELECT key, value, dataType FROM platform_configuration`).all();
        const rows = rowsRes?.results || [];

        for (const row of rows) {
          if (!row.key || row.value === undefined || row.value === null) continue;
          
          let parsedVal = row.value;
          if (row.dataType === "number") {
            const num = Number(row.value);
            if (!isNaN(num)) parsedVal = num;
          } else if (row.dataType === "boolean") {
            parsedVal = row.value === "true" || row.value === "1";
          } else if (row.dataType === "json") {
            try {
              parsedVal = JSON.parse(row.value);
            } catch (e) {
              parsedVal = row.value;
            }
          }

          config[row.key] = parsedVal;
        }
      } catch (err) {
        console.warn("[PlatformConfig] Failed to fetch from D1, utilizing fallback defaults:", err.message);
      }
    }

    // Apply strict bounds validation
    config.archive_after_months = Math.max(1, Math.min(120, Number(config.archive_after_months) || 12));
    config.max_vehicle_images = Math.max(1, Math.min(50, Number(config.max_vehicle_images) || 20));
    config.max_image_upload_mb = Math.max(1, Math.min(50, Number(config.max_image_upload_mb) || 5));
    config.max_image_width = Math.max(320, Math.min(4096, Number(config.max_image_width) || 1920));
    config.image_quality = Math.max(10, Math.min(100, Number(config.image_quality) || 85));
    config.max_auction_sheet_mb = Math.max(1, Math.min(100, Number(config.max_auction_sheet_mb) || 20));
    config.orphan_cleanup_days = Math.max(1, Math.min(365, Number(config.orphan_cleanup_days) || 7));

    this._cache = config;
    this._lastFetched = now;
    return config;
  }

  /**
   * Clears in-memory cache when updates occur
   */
  clearCache() {
    this._cache = null;
    this._lastFetched = 0;
  }
}

export const platformConfig = new PlatformConfigService();

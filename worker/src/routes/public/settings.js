import { success, serverError } from "../../utils/response.js";
import { SettingsService } from "../../services/settings-service.js";

/**
 * GET /api/v1/public/settings - Get public website settings (no authentication required)
 */
export async function getPublicSettings(request, env) {
  try {
    const settings = await SettingsService.getPublicSettings(env);
    return success(settings);
  } catch (error) {
    console.error("Get public settings error:", error);
    return serverError("Failed to fetch website settings.");
  }
}

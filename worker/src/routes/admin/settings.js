import { success, badRequest, serverError, validationError } from "../../utils/response.js";
import { authenticate } from "../../utils/auth.js";
import { getRequestMeta } from "../../utils/audit.js";
import { SettingsService, SettingsDomainError } from "../../services/settings-service.js";

function handleSettingsError(error) {
    if (error instanceof SettingsDomainError) {
        if (error.status === 422) return validationError(error.message);
        return badRequest(error.message);
    }
    console.error("Settings domain error:", error);
    return serverError(error?.message || "Internal server error.");
}

export async function getSettings(request, env) {
    const auth = await authenticate(request, env, "settings.view");
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const settings = await SettingsService.getSettings(env);
        return success(settings);
    } catch (error) {
        return handleSettingsError(error);
    }
}

export async function updateSettings(request, env) {
    const auth = await authenticate(request, env, "settings.edit");
    if (auth.errorResponse) return auth.errorResponse;

    const meta = getRequestMeta(request);

    try {
        const body = await request.json();
        await SettingsService.updateSettings(env, auth.user, body, meta);
        return success(null, "Settings updated successfully.");
    } catch (error) {
        return handleSettingsError(error);
    }
}

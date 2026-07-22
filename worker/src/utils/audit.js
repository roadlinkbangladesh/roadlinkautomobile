/**
 * Centralized, Append-Only Security Audit Logging Utility
 */

export async function logAudit(env, {
    actingUserId = null,
    actingUsername = null,
    targetUserId = null,
    targetRoleId = null,
    action,
    resourceType,
    resourceId = null,
    status = "SUCCESS",
    reason = null,
    ipAddress = null,
    userAgent = null,
    details = null
}) {
    try {
        if (!env || !env.DB) return;

        const now = new Date().toISOString();
        const detailsJson = details 
            ? (typeof details === "string" ? details : JSON.stringify(details)) 
            : null;

        await env.DB
            .prepare(`
                INSERT INTO audit_logs (
                    timestamp,
                    acting_user_id,
                    acting_username,
                    target_user_id,
                    target_role_id,
                    action,
                    resource_type,
                    resource_id,
                    status,
                    reason,
                    ip_address,
                    user_agent,
                    details,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
                now,
                actingUserId,
                actingUsername,
                targetUserId,
                targetRoleId,
                action,
                resourceType,
                resourceId ? String(resourceId) : null,
                status,
                reason,
                ipAddress,
                userAgent,
                detailsJson,
                now
            )
            .run();
    } catch (err) {
        console.error("Failed to write security audit log:", err);
    }
}

/**
 * Extracts request IP and User Agent headers safely
 */
export function getRequestMeta(request) {
    if (!request || !request.headers) {
        return { ipAddress: null, userAgent: null };
    }
    const ipAddress = request.headers.get("CF-Connecting-IP") || 
                      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                      null;
    const userAgent = request.headers.get("user-agent") || null;
    return { ipAddress, userAgent };
}

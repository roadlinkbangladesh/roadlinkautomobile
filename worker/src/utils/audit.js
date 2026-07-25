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
 * Safely extracts client IP address and User Agent header.
 * IP Resolution Priority:
 * 1. CF-Connecting-IP (Authentic client IP provided by Cloudflare edge proxy)
 * 2. X-Forwarded-For (First client IP entry in proxy chain)
 * 3. X-Real-IP (Direct reverse proxy header)
 * 4. Fallback to default local loopback IP if undetermined
 */
export function getRequestMeta(request) {
    if (!request || !request.headers) {
        return { ipAddress: "127.0.0.1", userAgent: null };
    }

    let ipAddress = request.headers.get("CF-Connecting-IP");

    if (!ipAddress) {
        const xff = request.headers.get("x-forwarded-for");
        if (xff) {
            const firstIp = xff.split(",")[0]?.trim();
            if (firstIp) ipAddress = firstIp;
        }
    }

    if (!ipAddress) {
        ipAddress = request.headers.get("x-real-ip");
    }

    if (!ipAddress) {
        ipAddress = "127.0.0.1";
    }

    const userAgent = request.headers.get("user-agent") || null;
    return { ipAddress, userAgent };
}

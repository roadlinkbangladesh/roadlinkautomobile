import { unauthorized, forbidden } from "./response.js";
import { verifyToken } from "./jwt.js";
import { logAudit, getRequestMeta } from "./audit.js";

/**
 * Mandatory Security Actions Configuration (evaluated in strict priority order)
 */
export const MANDATORY_SECURITY_ACTIONS = [
    {
        key: "PASSWORD_CHANGE",
        isPending: (user) => Boolean(user?.must_change_password)
    },
    {
        key: "MFA_ENROLLMENT",
        isPending: (user, roleRequiresMfa) => (Boolean(roleRequiresMfa) || Boolean(user?.mfa_enforced) || Boolean(user?.role_mfa_required)) && !Boolean(user?.mfa_enabled)
    }
];

export function getPendingMandatoryAction(user, roleRequiresMfa) {
    if (!user) return null;
    const mfaReq = roleRequiresMfa !== undefined ? roleRequiresMfa : (Boolean(user.role_mfa_required) || Boolean(user.mfa_enforced));
    for (const action of MANDATORY_SECURITY_ACTIONS) {
        if (action.isPending(user, mfaReq)) {
            return action.key;
        }
    }
    return null;
}

/**
 * Common Authentication & Authorization Middleware for Workers
 */
export async function authenticate(request, env, requiredPermission = null, isChangePasswordRoute = false, isMfaSetupRoute = false, isMfaVerifyRoute = false) {
    const authHeader = request.headers.get("Authorization");
    const { ipAddress, userAgent } = getRequestMeta(request);

    if (!authHeader?.startsWith("Bearer ")) {
        return { errorResponse: unauthorized("Authentication required.") };
    }

    const token = authHeader.substring(7).trim();

    const decoded = await verifyToken(token, env.JWT_SECRET);
    if (!decoded) {
        return { errorResponse: unauthorized("Invalid or expired token.") };
    }

    const isAllowedSecurityRoute = isChangePasswordRoute || isMfaSetupRoute || isMfaVerifyRoute;

    // Check token scope restrictions
    const tokenScope = decoded.scope;
    if ((tokenScope === "mandatory_security_action_pending" || tokenScope === "mfa_setup_pending" || tokenScope === "password_change_pending") && !isAllowedSecurityRoute) {
        return { errorResponse: forbidden("A mandatory security action is required before accessing other resources.", { mandatorySecurityAction: true }) };
    }
    if (tokenScope === "mfa_pending" && !isMfaVerifyRoute) {
        return { errorResponse: forbidden("MFA verification is required before accessing other resources.") };
    }

    // Retrieve active record directly from DB to verify constraints and system role attributes
    const user = await env.DB
        .prepare(`
            SELECT u.*, r.name as role_name, r.is_system_role, r.system_role_key, r.mfa_required as role_mfa_required
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = ?
            LIMIT 1
        `)
        .bind(decoded.id)
        .first();

    if (!user) {
        return { errorResponse: unauthorized("User not found.") };
    }

    // Verify token version matches current database record for immediate session revocation
    const userTokenVersion = user.token_version ?? 1;
    const decodedTokenVersion = decoded.token_version ?? 1;
    if (decodedTokenVersion !== userTokenVersion) {
        await logAudit(env, {
            actingUserId: user.id,
            actingUsername: user.username,
            action: "security.session_revoked",
            resourceType: "auth",
            status: "FAILURE",
            reason: "Session revoked due to token version mismatch",
            ipAddress,
            userAgent
        });
        return { errorResponse: unauthorized("Your session has expired or has been invalidated. Please sign in again.") };
    }

    if (user.is_active !== 1) {
        await logAudit(env, {
            actingUserId: user.id,
            actingUsername: user.username,
            action: "security.permission_denied",
            resourceType: "auth",
            status: "FAILURE",
            reason: "Account deactivated",
            ipAddress,
            userAgent
        });
        return { errorResponse: forbidden("Your account is deactivated.") };
    }

    // Attach system role boolean flag
    user.is_super_admin = (user.is_system_role === 1 && user.system_role_key === "SUPER_ADMIN") ||
        user.system_role_key === "SUPER_ADMIN" ||
        user.role_id === 1 ||
        user.role_name === "Super Administrator";

    // Retrieve role permissions
    const permissionsQuery = await env.DB
        .prepare(`
            SELECT permission_key
            FROM role_permissions
            WHERE role_id = ?
        `)
        .bind(user.role_id)
        .all();
    
    const permissions = (permissionsQuery.results || []).map(p => p.permission_key);

    // Protected endpoints must reject requests when a mandatory security action is pending,
    // unless the endpoint is specifically flagged as an allowed security route.
    const roleRequiresMfa = Boolean(user.role_mfa_required) || Boolean(user.mfa_enforced);
    const pendingMandatoryAction = getPendingMandatoryAction(user, roleRequiresMfa);

    if (pendingMandatoryAction && !isAllowedSecurityRoute) {
        await logAudit(env, {
            actingUserId: user.id,
            actingUsername: user.username,
            action: "security.mandatory_security_action_required",
            resourceType: "auth",
            status: "FAILURE",
            reason: `Mandatory security action required (${pendingMandatoryAction}) before accessing requested endpoint`,
            ipAddress,
            userAgent
        });
        return {
            errorResponse: forbidden("You must complete your mandatory security action before performing any other operations.", {
                mandatorySecurityAction: pendingMandatoryAction,
                mustChangePassword: pendingMandatoryAction === "PASSWORD_CHANGE"
            })
        };
    }

    if (requiredPermission && !user.is_super_admin && !permissions.includes(requiredPermission)) {
        await logAudit(env, {
            actingUserId: user.id,
            actingUsername: user.username,
            action: "security.permission_denied",
            resourceType: "authorization",
            status: "FAILURE",
            reason: `Missing required permission: ${requiredPermission}`,
            ipAddress,
            userAgent
        });
        return { errorResponse: forbidden("Access denied. Insufficient permissions.") };
    }

    return { user, permissions };
}

/**
 * Checks if roleA is strictly less privileged than roleB.
 * Super Administrator (system_role_key === 'SUPER_ADMIN' or is_system_role === 1)
 * is always more privileged than any other role (except itself).
 * For other roles, roleA is strictly less privileged if and only if roleA's permissions
 * are a strict subset of roleB's permissions. Non-comparable roles fail closed.
 */
export async function isStrictlyLessPrivileged(env, roleAId, roleBId) {
    const rAId = parseInt(roleAId);
    const rBId = parseInt(roleBId);

    // If same role, they are equal, not strictly less privileged
    if (rAId === rBId) return false;

    // Fetch system role details for both roles
    const roleA = await env.DB
        .prepare(`SELECT id, name, is_system_role, system_role_key FROM roles WHERE id = ? LIMIT 1`)
        .bind(rAId)
        .first();

    const roleB = await env.DB
        .prepare(`SELECT id, name, is_system_role, system_role_key FROM roles WHERE id = ? LIMIT 1`)
        .bind(rBId)
        .first();

    if (!roleA || !roleB) return false;

    const isBSuperAdmin = (roleB.is_system_role === 1 && roleB.system_role_key === "SUPER_ADMIN") ||
        roleB.system_role_key === "SUPER_ADMIN" ||
        roleB.id === 1 ||
        roleB.name === "Super Administrator";
    const isASuperAdmin = (roleA.is_system_role === 1 && roleA.system_role_key === "SUPER_ADMIN") ||
        roleA.system_role_key === "SUPER_ADMIN" ||
        roleA.id === 1 ||
        roleA.name === "Super Administrator";

    // Super Administrator is more privileged than any non-Super Administrator role
    if (isBSuperAdmin) {
        return !isASuperAdmin;
    }
    // No other role is more or equally privileged than Super Administrator
    if (isASuperAdmin) {
        return false;
    }

    const permsAQuery = await env.DB
        .prepare(`SELECT permission_key FROM role_permissions WHERE role_id = ?`)
        .bind(rAId)
        .all();
    const permsBQuery = await env.DB
        .prepare(`SELECT permission_key FROM role_permissions WHERE role_id = ?`)
        .bind(rBId)
        .all();

    const permsA = (permsAQuery.results || []).map(rp => rp.permission_key);
    const permsB = (permsBQuery.results || []).map(rp => rp.permission_key);

    // Every permission in A must be present in B (subset)
    const isSubset = permsA.every(p => permsB.includes(p));
    if (!isSubset) return false;

    // B must have strictly more permissions than A (strict subset)
    return permsB.length > permsA.length;
}

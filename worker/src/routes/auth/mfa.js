import {
    success,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    serverError
} from "../../utils/response.js";
import { authenticate, isStrictlyLessPrivileged } from "../../utils/auth.js";
import { verifyPassword } from "../../utils/password.js";
import { createToken, verifyToken } from "../../utils/jwt.js";
import { JWT } from "../../config/constants.js";
import { logAudit, getRequestMeta } from "../../utils/audit.js";
import {
    generateMfaSecret,
    verifyTotpCode,
    encryptMfaSecret,
    decryptMfaSecret,
    generateRecoveryCodes,
    hashRecoveryCode,
    buildOtpAuthUrl
} from "../../utils/mfa.js";

/**
 * POST /api/v1/auth/mfa/verify
 * Second step of MFA login authentication flow
 */
export async function verifyMfaLogin(request, env) {
    const { ipAddress, userAgent } = getRequestMeta(request);
    const clientIp = ipAddress || "127.0.0.1";

    try {
        const body = await request.json().catch(() => ({}));
        let mfaToken = body.mfa_token;

        if (!mfaToken) {
            const authHeader = request.headers.get("Authorization");
            if (authHeader && authHeader.startsWith("Bearer ")) {
                mfaToken = authHeader.substring(7).trim();
            }
        }

        const code = body.code ? String(body.code).trim() : null;
        const recoveryCode = body.recovery_code ? String(body.recovery_code).trim() : null;

        if (!mfaToken) {
            return badRequest("MFA pending token (mfa_token) is required.");
        }

        if (!code && !recoveryCode) {
            return badRequest("Verification code or recovery code is required.");
        }

        // Verify pre-auth token
        const tokenPayload = await verifyToken(mfaToken, env.JWT_SECRET);
        if (!tokenPayload || tokenPayload.scope !== "mfa_pending") {
            return unauthorized("Invalid or expired MFA session token. Please log in again.");
        }

        // Fetch user record
        const user = await env.DB
            .prepare(`
                SELECT u.id, u.username, u.display_name, u.role_id, r.name as role_name,
                       r.is_system_role, r.system_role_key, u.is_active, u.mfa_enabled,
                       u.mfa_secret_encrypted, u.must_change_password, u.token_version,
                       u.locked_until
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = ?
                LIMIT 1
            `)
            .bind(tokenPayload.id)
            .first();

        if (!user || user.is_active !== 1) {
            return unauthorized("User account is inactive or disabled.");
        }

        // Check locked until
        if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
            return forbidden("Account is temporarily locked. Please try again later.");
        }

        if (user.mfa_enabled !== 1 || !user.mfa_secret_encrypted) {
            return badRequest("Multi-Factor Authentication is not enabled for this account.");
        }

        let isVerified = false;
        let authMethod = "totp";

        if (code) {
            const plainSecret = await decryptMfaSecret(user.mfa_secret_encrypted, env.JWT_SECRET);
            if (!plainSecret) {
                return serverError("Failed to decrypt MFA credentials.");
            }
            isVerified = await verifyTotpCode(plainSecret, code, 1);
        } else if (recoveryCode) {
            authMethod = "recovery_code";
            const hashedInput = await hashRecoveryCode(recoveryCode);

            const match = await env.DB
                .prepare(`
                    SELECT id FROM mfa_recovery_codes
                    WHERE user_id = ? AND code_hash = ? AND is_used = 0
                    LIMIT 1
                `)
                .bind(user.id, hashedInput)
                .first();

            if (match) {
                isVerified = true;
                const nowIso = new Date().toISOString();
                await env.DB
                    .prepare(`UPDATE mfa_recovery_codes SET is_used = 1, used_at = ? WHERE id = ?`)
                    .bind(nowIso, match.id)
                    .run();
            }
        }

        if (!isVerified) {
            await logAudit(env, {
                actingUserId: user.id,
                actingUsername: user.username,
                action: "auth.mfa.verify.failed",
                resourceType: "auth",
                status: "FAILURE",
                reason: "Invalid TOTP code or recovery code",
                ipAddress: clientIp,
                userAgent
            });
            return unauthorized("Invalid MFA code or recovery code.");
        }

        // MFA verification succeeded -> update last used
        const nowIso = new Date().toISOString();
        await env.DB
            .prepare(`UPDATE users SET mfa_last_used_at = ?, last_login_at = ? WHERE id = ?`)
            .bind(nowIso, nowIso, user.id)
            .run();

        // Fetch permissions
        const permissionsQuery = await env.DB
            .prepare(`SELECT permission_key FROM role_permissions WHERE role_id = ?`)
            .bind(user.role_id)
            .all();
        const permissions = (permissionsQuery.results || []).map(p => p.permission_key);

        const expiresIn = tokenPayload.rememberMe
            ? JWT.REMEMBER_ME_EXPIRES_IN
            : JWT.SESSION_EXPIRES_IN;

        const token = await createToken(
            {
                id: user.id,
                username: user.username,
                role_id: user.role_id,
                token_version: user.token_version ?? 1
            },
            env.JWT_SECRET,
            expiresIn
        );

        await logAudit(env, {
            actingUserId: user.id,
            actingUsername: user.username,
            action: authMethod === "recovery_code" ? "auth.mfa.recovery_used" : "auth.mfa.verify.success",
            resourceType: "auth",
            status: "SUCCESS",
            ipAddress: clientIp,
            userAgent,
            details: { authMethod }
        });

        return success({
            token,
            mustChangePassword: user.must_change_password === 1 || user.must_change_password === true,
            user: {
                id: user.id,
                username: user.username,
                role_id: user.role_id,
                role_name: user.role_name,
                is_system_role: user.is_system_role === 1,
                system_role_key: user.system_role_key,
                display_name: user.display_name,
                mfa_enabled: true,
                permissions
            }
        });

    } catch (error) {
        console.error("MFA Verify error:", error);
        return serverError("Failed to complete MFA verification.");
    }
}

/**
 * GET /api/v1/auth/mfa/status
 * Check MFA status for authenticated user
 */
export async function getMfaStatus(request, env) {
    const auth = await authenticate(request, env);
    if (auth.errorResponse) return auth.errorResponse;

    try {
        const user = await env.DB
            .prepare(`
                SELECT u.mfa_enabled, u.mfa_enrolled_at, u.mfa_last_used_at, u.role_id,
                       r.mfa_required as role_mfa_required
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = ?
                LIMIT 1
            `)
            .bind(auth.user.id)
            .first();

        return success({
            mfa_enabled: user?.mfa_enabled === 1,
            mfa_required: user?.role_mfa_required === 1,
            mfa_enrolled_at: user?.mfa_enrolled_at || null,
            mfa_last_used_at: user?.mfa_last_used_at || null
        });
    } catch (error) {
        console.error("Get MFA status error:", error);
        return serverError("Failed to fetch MFA status.");
    }
}

/**
 * POST /api/v1/auth/mfa/setup
 * Initiate TOTP MFA provisioning (returns Base32 secret and OTPAuth URI)
 */
export async function setupMfa(request, env) {
    const auth = await authenticate(request, env);
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    try {
        // Generate new 160-bit secret
        const plainSecret = generateMfaSecret();
        const encryptedSecret = await encryptMfaSecret(plainSecret, env.JWT_SECRET);

        // Save secret temporarily on user record without enabling MFA yet
        await env.DB
            .prepare(`UPDATE users SET mfa_secret_encrypted = ?, updated_at = ? WHERE id = ?`)
            .bind(encryptedSecret, new Date().toISOString(), auth.user.id)
            .run();

        const otpauthUrl = buildOtpAuthUrl(auth.user.username, plainSecret);

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            action: "auth.mfa.setup_initiated",
            resourceType: "user",
            resourceId: String(auth.user.id),
            status: "SUCCESS",
            ipAddress,
            userAgent
        });

        return success({
            secret: plainSecret,
            otpauth_url: otpauthUrl,
            qr_code_url: otpauthUrl,
            issuer: "Roadlink Automobiles",
            account_name: auth.user.username
        });

    } catch (error) {
        console.error("Setup MFA error:", error);
        return serverError("Failed to initiate MFA setup.");
    }
}

/**
 * POST /api/v1/auth/mfa/enable
 * Confirm TOTP code and enable MFA for account
 */
export async function enableMfa(request, env) {
    const auth = await authenticate(request, env);
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    try {
        const body = await request.json().catch(() => ({}));
        const code = body.code ? String(body.code).trim() : null;

        if (!code) {
            return badRequest("6-digit verification code is required.");
        }

        const user = await env.DB
            .prepare(`SELECT mfa_secret_encrypted FROM users WHERE id = ? LIMIT 1`)
            .bind(auth.user.id)
            .first();

        if (!user || !user.mfa_secret_encrypted) {
            return badRequest("MFA setup has not been initiated. Call /api/v1/auth/mfa/setup first.");
        }

        const plainSecret = await decryptMfaSecret(user.mfa_secret_encrypted, env.JWT_SECRET);
        if (!plainSecret) {
            return serverError("Failed to decrypt MFA setup secret.");
        }

        const isValid = await verifyTotpCode(plainSecret, code, 1);
        if (!isValid) {
            await logAudit(env, {
                actingUserId: auth.user.id,
                actingUsername: auth.user.username,
                action: "auth.mfa.enable_failed",
                resourceType: "user",
                status: "FAILURE",
                reason: "Invalid verification code supplied during MFA enablement",
                ipAddress,
                userAgent
            });
            return badRequest("Invalid verification code. Please check your authenticator app and try again.");
        }

        // Generate 8 recovery codes
        const plainRecoveryCodes = generateRecoveryCodes(8);

        // Delete any existing recovery codes for user
        await env.DB
            .prepare(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`)
            .bind(auth.user.id)
            .run();

        // Store hashed recovery codes
        const nowIso = new Date().toISOString();
        for (const rawCode of plainRecoveryCodes) {
            const hashed = await hashRecoveryCode(rawCode);
            await env.DB
                .prepare(`
                    INSERT INTO mfa_recovery_codes (user_id, code_hash, is_used, created_at)
                    VALUES (?, ?, 0, ?)
                `)
                .bind(auth.user.id, hashed, nowIso)
                .run();
        }

        // Update user state to mfa_enabled = 1
        await env.DB
            .prepare(`
                UPDATE users
                SET mfa_enabled = 1, mfa_enrolled_at = ?, mfa_last_used_at = ?, updated_at = ?
                WHERE id = ?
            `)
            .bind(nowIso, nowIso, nowIso, auth.user.id)
            .run();

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            action: "auth.mfa.enabled",
            resourceType: "user",
            resourceId: String(auth.user.id),
            status: "SUCCESS",
            ipAddress,
            userAgent
        });

        // Check if token scope was mfa_setup_pending (Mandatory Setup Flow during Login)
        const authHeader = request.headers.get("Authorization");
        let isMandatorySetup = false;
        let rememberMe = false;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const rawToken = authHeader.substring(7).trim();
            const decoded = await verifyToken(rawToken, env.JWT_SECRET);
            if (decoded?.scope === "mfa_setup_pending") {
                isMandatorySetup = true;
                rememberMe = decoded.rememberMe === true;
            }
        }

        if (isMandatorySetup) {
            await logAudit(env, {
                actingUserId: auth.user.id,
                actingUsername: auth.user.username,
                action: "mfa.mandatory_enrollment_completed",
                resourceType: "user",
                resourceId: String(auth.user.id),
                status: "SUCCESS",
                ipAddress,
                userAgent
            });

            const userWithRole = await env.DB
                .prepare(`
                    SELECT u.id, u.username, u.display_name, u.role_id, u.token_version, u.must_change_password,
                           r.name as role_name, r.is_system_role, r.system_role_key
                    FROM users u
                    LEFT JOIN roles r ON u.role_id = r.id
                    WHERE u.id = ?
                    LIMIT 1
                `)
                .bind(auth.user.id)
                .first();

            const permissionsQuery = await env.DB
                .prepare(`SELECT permission_key FROM role_permissions WHERE role_id = ?`)
                .bind(auth.user.role_id)
                .all();
            const permissions = (permissionsQuery.results || []).map(p => p.permission_key);

            const expiresIn = rememberMe
                ? JWT.REMEMBER_ME_EXPIRES_IN
                : JWT.SESSION_EXPIRES_IN;

            const token = await createToken(
                {
                    id: auth.user.id,
                    username: auth.user.username,
                    role_id: auth.user.role_id,
                    token_version: userWithRole?.token_version ?? 1
                },
                env.JWT_SECRET,
                expiresIn
            );

            return success({
                token,
                mustChangePassword: userWithRole?.must_change_password === 1 || userWithRole?.must_change_password === true,
                recovery_codes: plainRecoveryCodes,
                user: {
                    id: auth.user.id,
                    username: auth.user.username,
                    role_id: auth.user.role_id,
                    role_name: userWithRole?.role_name,
                    is_system_role: userWithRole?.is_system_role === 1,
                    system_role_key: userWithRole?.system_role_key,
                    display_name: auth.user.display_name,
                    mfa_enabled: true,
                    permissions
                },
                message: "Mandatory Multi-Factor Authentication enrollment completed successfully."
            });
        }

        return success({
            recovery_codes: plainRecoveryCodes,
            message: "Multi-Factor Authentication has been successfully enabled."
        });

    } catch (error) {
        console.error("Enable MFA error:", error);
        return serverError("Failed to enable MFA.");
    }
}

/**
 * POST /api/v1/auth/mfa/disable
 * Disable MFA with password and TOTP/recovery verification
 */
export async function disableMfa(request, env) {
    const auth = await authenticate(request, env);
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    try {
        const body = await request.json().catch(() => ({}));
        const password = body.password;
        const code = body.code ? String(body.code).trim() : null;
        const recoveryCode = body.recovery_code ? String(body.recovery_code).trim() : null;

        if (!password) {
            return badRequest("Current password is required to disable MFA.");
        }

        if (!code && !recoveryCode) {
            return badRequest("Verification code or recovery code is required to disable MFA.");
        }

        const user = await env.DB
            .prepare(`SELECT password_hash, mfa_enabled, mfa_secret_encrypted FROM users WHERE id = ? LIMIT 1`)
            .bind(auth.user.id)
            .first();

        if (!user || user.mfa_enabled !== 1) {
            return badRequest("MFA is not enabled on this account.");
        }

        // Verify password
        const isPasswordValid = await verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            await logAudit(env, {
                actingUserId: auth.user.id,
                actingUsername: auth.user.username,
                action: "auth.mfa.disable_failed",
                resourceType: "user",
                status: "FAILURE",
                reason: "Incorrect password supplied during MFA disable request",
                ipAddress,
                userAgent
            });
            return badRequest("Incorrect password.");
        }

        let isCodeValid = false;
        if (code) {
            const plainSecret = await decryptMfaSecret(user.mfa_secret_encrypted, env.JWT_SECRET);
            if (plainSecret) {
                isCodeValid = await verifyTotpCode(plainSecret, code, 1);
            }
        } else if (recoveryCode) {
            const hashed = await hashRecoveryCode(recoveryCode);
            const match = await env.DB
                .prepare(`SELECT id FROM mfa_recovery_codes WHERE user_id = ? AND code_hash = ? AND is_used = 0 LIMIT 1`)
                .bind(auth.user.id, hashed)
                .first();
            if (match) isCodeValid = true;
        }

        if (!isCodeValid) {
            await logAudit(env, {
                actingUserId: auth.user.id,
                actingUsername: auth.user.username,
                action: "auth.mfa.disable_failed",
                resourceType: "user",
                status: "FAILURE",
                reason: "Invalid verification code or recovery code during MFA disable request",
                ipAddress,
                userAgent
            });
            return badRequest("Invalid verification code or recovery code.");
        }

        // Disable MFA
        const nowIso = new Date().toISOString();
        await env.DB
            .prepare(`
                UPDATE users
                SET mfa_enabled = 0, mfa_secret_encrypted = NULL, mfa_enrolled_at = NULL, updated_at = ?
                WHERE id = ?
            `)
            .bind(nowIso, auth.user.id)
            .run();

        await env.DB
            .prepare(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`)
            .bind(auth.user.id)
            .run();

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            action: "mfa.disabled",
            resourceType: "user",
            resourceId: String(auth.user.id),
            status: "SUCCESS",
            ipAddress,
            userAgent
        });

        return success(null, "Multi-Factor Authentication disabled successfully.");

    } catch (error) {
        console.error("Disable MFA error:", error);
        return serverError("Failed to disable MFA.");
    }
}

/**
 * POST /api/v1/admin/users/:id/reset-mfa
 * Administrative MFA Reset for a targeted user
 */
export async function resetUserMfa(request, env, ctx, params) {
    const auth = await authenticate(request, env, ["users.manage", "mfa.manage"]);
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    const targetId = parseInt(params.id);
    if (isNaN(targetId)) {
        return badRequest("Invalid user ID.");
    }

    try {
        const targetUser = await env.DB
            .prepare(`SELECT id, username, role_id, mfa_enabled FROM users WHERE id = ? LIMIT 1`)
            .bind(targetId)
            .first();

        if (!targetUser) {
            return notFound("User not found.");
        }

        // Delegated Administrator check
        if (!auth.user.is_super_admin) {
            if (targetId !== auth.user.id && !(await isStrictlyLessPrivileged(env, targetUser.role_id, auth.user.role_id))) {
                await logAudit(env, {
                    actingUserId: auth.user.id,
                    actingUsername: auth.user.username,
                    targetUserId: targetId,
                    action: "security.privilege_escalation_attempt",
                    resourceType: "user",
                    status: "FAILURE",
                    reason: "Attempted administrative MFA reset on equal or higher privileged user",
                    ipAddress,
                    userAgent
                });
                return forbidden("Access denied. You can only reset MFA for users who are strictly less privileged than your own role.");
            }
        }

        const nowIso = new Date().toISOString();
        try {
            await env.DB
                .prepare(`
                    UPDATE users
                    SET mfa_enabled = 0,
                        mfa_enforced = 0,
                        mfa_secret_encrypted = NULL,
                        mfa_enrolled_at = NULL,
                        token_version = token_version + 1,
                        updated_at = ?
                    WHERE id = ?
                `)
                .bind(nowIso, targetId)
                .run();
        } catch (err) {
            await env.DB
                .prepare(`
                    UPDATE users
                    SET mfa_enabled = 0,
                        mfa_secret_encrypted = NULL,
                        mfa_enrolled_at = NULL,
                        token_version = token_version + 1,
                        updated_at = ?
                    WHERE id = ?
                `)
                .bind(nowIso, targetId)
                .run();
        }

        await env.DB
            .prepare(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`)
            .bind(targetId)
            .run();

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetUserId: targetId,
            action: "mfa.reset",
            resourceType: "user",
            resourceId: String(targetId),
            status: "SUCCESS",
            ipAddress,
            userAgent,
            details: { targetUsername: targetUser.username }
        });

        return success({ id: targetId, username: targetUser.username }, "MFA reset successfully for user.");

    } catch (error) {
        console.error("Reset user MFA error:", error);
        return serverError("Failed to reset user MFA.");
    }
}

/**
 * POST /api/v1/admin/users/:id/enforce-mfa
 * Administrative MFA Enforcement for a targeted user
 */
export async function enforceUserMfa(request, env, ctx, params) {
    const auth = await authenticate(request, env, ["users.manage", "mfa.manage"]);
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    const targetId = parseInt(params.id);
    if (isNaN(targetId)) {
        return badRequest("Invalid user ID.");
    }

    try {
        const targetUser = await env.DB
            .prepare(`SELECT id, username, role_id, mfa_enabled FROM users WHERE id = ? LIMIT 1`)
            .bind(targetId)
            .first();

        if (!targetUser) {
            return notFound("User not found.");
        }

        if (!auth.user.is_super_admin) {
            if (targetId !== auth.user.id && !(await isStrictlyLessPrivileged(env, targetUser.role_id, auth.user.role_id))) {
                await logAudit(env, {
                    actingUserId: auth.user.id,
                    actingUsername: auth.user.username,
                    targetUserId: targetId,
                    action: "security.privilege_escalation_attempt",
                    resourceType: "user",
                    status: "FAILURE",
                    reason: "Attempted administrative MFA enforcement on equal or higher privileged user",
                    ipAddress,
                    userAgent
                });
                return forbidden("Access denied. You cannot modify a user with equal or higher privileges.");
            }
        }

        const nowIso = new Date().toISOString();

        try {
            await env.DB.prepare(`UPDATE users SET mfa_enforced = 1, updated_at = ? WHERE id = ?`).bind(nowIso, targetId).run();
        } catch (e) {
            try {
                await env.DB.prepare(`ALTER TABLE users ADD COLUMN mfa_enforced INTEGER DEFAULT 0`).run();
                await env.DB.prepare(`UPDATE users SET mfa_enforced = 1, updated_at = ? WHERE id = ?`).bind(nowIso, targetId).run();
            } catch (err) {
                console.error("Failed to enforce MFA column:", err);
            }
        }

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            targetUserId: targetId,
            action: "admin.user.mfa_enforced",
            resourceType: "user",
            resourceId: String(targetId),
            status: "SUCCESS",
            ipAddress,
            userAgent,
            details: { targetUsername: targetUser.username }
        });

        return success({ id: targetId, username: targetUser.username }, `MFA requirement enforced for user @${targetUser.username}.`);

    } catch (error) {
        console.error("Enforce user MFA error:", error);
        return serverError("Failed to enforce MFA for user.");
    }
}

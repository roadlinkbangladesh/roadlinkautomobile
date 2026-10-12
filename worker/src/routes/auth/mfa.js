import {
    success,
    badRequest,
    unauthorized,
    forbidden,
    tooManyRequests,
    notFound,
    serverError
} from "../../utils/response.js";
import { authenticate, isStrictlyLessPrivileged } from "../../utils/auth.js";
import { verifyPassword } from "../../utils/password.js";
import { createToken, verifyToken, validateJwtSecret } from "../../utils/jwt.js";
import { JWT } from "../../config/constants.js";
import { logAudit, getRequestMeta } from "../../utils/audit.js";
import { platformConfig } from "../../services/platform-config.js";
import {
    generateMfaSecret,
    verifyTotpCode,
    encryptMfaSecret,
    decryptMfaSecret,
    generateRecoveryCodes,
    hashRecoveryCode,
    verifyRecoveryCode,
    buildOtpAuthUrl,
    getMfaEncryptionSecret
} from "../../utils/mfa.js";

/**
 * POST /api/v1/auth/mfa/verify
 * Second step of MFA login authentication flow
 */
export async function verifyMfaLogin(request, env) {
    const { ipAddress, userAgent } = getRequestMeta(request);
    const clientIp = ipAddress || "127.0.0.1";

    let mfaEncryptionKey;
    try {
        validateJwtSecret(env?.JWT_SECRET);
        mfaEncryptionKey = getMfaEncryptionSecret(env);
    } catch {
        return serverError("Security configuration error: JWT_SECRET or MFA encryption secret is not configured properly.");
    }

    try {
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();

        // Check IP lockout state
        const config = await platformConfig.getConfig(env);
        const maxIpAttempts = config.max_ip_failed_attempts || 15;
        const ipLockoutMinutes = config.ip_lockout_duration_minutes || config.lockout_duration_minutes || 15;
        const ipLockoutMs = ipLockoutMinutes * 60 * 1000;

        const maxAccountAttempts = config.max_failed_login_attempts || 5;
        const accountLockoutMinutes = config.account_lockout_duration_minutes || config.lockout_duration_minutes || 15;
        const accountLockoutMs = accountLockoutMinutes * 60 * 1000;

        const ipRecord = await env.DB
            .prepare(`SELECT failed_attempts, locked_until FROM login_security WHERE ip_address = ?`)
            .bind(clientIp)
            .first();

        if (ipRecord && ipRecord.locked_until) {
            const lockedUntilTime = new Date(ipRecord.locked_until).getTime();
            if (lockedUntilTime > nowMs) {
                const remainingSeconds = Math.max(1, Math.ceil((lockedUntilTime - nowMs) / 1000));
                return tooManyRequests("Too many unsuccessful attempts. Please try again later.", remainingSeconds);
            }
        }

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
            return badRequest("MFA pending token (mfa_token) is required.", { code: "BAD_REQUEST" });
        }

        if (!code && !recoveryCode) {
            return badRequest("Verification code or recovery code is required.", { code: "BAD_REQUEST" });
        }

        // Verify pre-auth token
        const tokenPayload = await verifyToken(mfaToken, env.JWT_SECRET);
        if (!tokenPayload || tokenPayload.scope !== "mfa_pending") {
            return unauthorized("Your MFA verification session has expired. Please sign in again.", { code: "MFA_CHALLENGE_EXPIRED" });
        }

        // Fetch user record
        const user = await env.DB
            .prepare(`
                SELECT u.id, u.username, u.display_name, u.role_id, r.name as role_name,
                       r.is_system_role, r.system_role_key, u.is_active, u.mfa_enabled,
                       u.mfa_secret_encrypted, u.mfa_last_used_at, u.must_change_password, u.token_version,
                       u.failed_login_attempts, u.locked_until
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = ?
                LIMIT 1
            `)
            .bind(tokenPayload.id)
            .first();

        if (!user || user.is_active !== 1) {
            return unauthorized("User account is inactive or disabled.", { code: "ACCOUNT_DISABLED" });
        }

        // Check token version
        const userTokenVersion = user.token_version ?? 1;
        const tokenVersion = tokenPayload.token_version ?? 1;
        if (tokenVersion !== userTokenVersion) {
            return unauthorized("Session token has been invalidated. Please log in again.", { code: "SESSION_INVALIDATED" });
        }

        // Check locked until
        if (user.locked_until && new Date(user.locked_until).getTime() > nowMs) {
            return forbidden("Account is temporarily locked due to too many failed attempts. Please try again later.", { code: "ACCOUNT_LOCKED" });
        }

        if (user.mfa_enabled !== 1 || !user.mfa_secret_encrypted) {
            return unauthorized("Your MFA verification session has expired. Please sign in again.", { code: "MFA_CHALLENGE_EXPIRED" });
        }

        let isVerified = false;
        let authMethod = "totp";

        if (code) {
            const plainSecret = await decryptMfaSecret(user.mfa_secret_encrypted, mfaEncryptionKey);
            if (!plainSecret) {
                return serverError("Failed to decrypt MFA credentials.");
            }
            // Verify TOTP code with replay protection against user.mfa_last_used_at
            isVerified = await verifyTotpCode(plainSecret, code, 1, user.mfa_last_used_at);

            if (isVerified) {
                // Atomically consume pre-auth challenge and increment token_version
                const updateChallengeRes = await env.DB
                    .prepare(`
                        UPDATE users
                        SET mfa_last_used_at = ?,
                            last_login_at = ?,
                            token_version = token_version + 1,
                            failed_login_attempts = 0,
                            locked_until = NULL,
                            updated_at = ?
                        WHERE id = ? AND token_version = ? AND is_active = 1
                    `)
                    .bind(nowIso, nowIso, nowIso, user.id, tokenVersion)
                    .run();

                if (updateChallengeRes?.meta?.changes !== 1) {
                    return unauthorized("Your MFA verification session has expired. Please sign in again.", { code: "MFA_CHALLENGE_EXPIRED" });
                }
            }
        } else if (recoveryCode) {
            authMethod = "recovery_code";
            
            // Retrieve unused recovery codes for this user
            const candidates = await env.DB
                .prepare(`
                    SELECT id, code_hash FROM mfa_recovery_codes
                    WHERE user_id = ? AND is_used = 0
                `)
                .bind(user.id)
                .all();

            let matchingId = null;
            for (const row of (candidates.results || [])) {
                if (await verifyRecoveryCode(recoveryCode, row.code_hash)) {
                    matchingId = row.id;
                    break;
                }
            }

            if (matchingId) {
                // Atomically consume recovery code AND increment token_version in a single batch
                const batchRes = await env.DB.batch([
                    env.DB.prepare(`
                        UPDATE mfa_recovery_codes
                        SET is_used = 1, used_at = ?
                        WHERE id = ? AND user_id = ? AND is_used = 0
                    `).bind(nowIso, matchingId, user.id),
                    env.DB.prepare(`
                        UPDATE users
                        SET mfa_last_used_at = ?,
                            last_login_at = ?,
                            token_version = token_version + 1,
                            failed_login_attempts = 0,
                            locked_until = NULL,
                            updated_at = ?
                        WHERE id = ? AND token_version = ? AND is_active = 1
                    `).bind(nowIso, nowIso, nowIso, user.id, tokenVersion)
                ]);

                if (batchRes?.[0]?.meta?.changes === 1 && batchRes?.[1]?.meta?.changes === 1) {
                    isVerified = true;
                } else {
                    isVerified = false;
                }
            }
        }

        if (!isVerified) {
            const ipLockedUntilIso = new Date(nowMs + ipLockoutMs).toISOString();
            const accountLockedUntilIso = new Date(nowMs + accountLockoutMs).toISOString();

            // Update IP lockout counter atomically
            await env.DB.prepare(`
                INSERT INTO login_security (ip_address, failed_attempts, last_attempt_at, locked_until)
                VALUES (?, 1, ?, CASE WHEN 1 >= ? THEN ? ELSE NULL END)
                ON CONFLICT(ip_address) DO UPDATE SET
                    failed_attempts = CASE
                        WHEN login_security.locked_until IS NOT NULL AND login_security.locked_until <= excluded.last_attempt_at THEN 1
                        ELSE login_security.failed_attempts + 1
                    END,
                    last_attempt_at = excluded.last_attempt_at,
                    locked_until = CASE
                        WHEN (CASE WHEN login_security.locked_until IS NOT NULL AND login_security.locked_until <= excluded.last_attempt_at THEN 1 ELSE login_security.failed_attempts + 1 END) >= ? THEN ?
                        ELSE NULL
                    END
            `).bind(clientIp, nowIso, maxIpAttempts, ipLockedUntilIso, maxIpAttempts, ipLockedUntilIso).run();

            // Atomic conditional update of user failed attempts
            await env.DB.prepare(`
                UPDATE users
                SET failed_login_attempts = CASE
                        WHEN locked_until IS NOT NULL AND locked_until <= ? THEN 1
                        ELSE failed_login_attempts + 1
                    END,
                    last_failed_login_at = ?,
                    locked_until = CASE
                        WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until <= ? THEN 1 ELSE failed_login_attempts + 1 END) >= ? THEN ?
                        ELSE NULL
                    END,
                    updated_at = ?
                WHERE id = ?
            `).bind(nowIso, nowIso, nowIso, maxAccountAttempts, accountLockedUntilIso, nowIso, user.id).run();

            const updatedUser = await env.DB.prepare(`SELECT failed_login_attempts, locked_until FROM users WHERE id = ?`).bind(user.id).first();
            const accountWillLock = Boolean(updatedUser?.locked_until && new Date(updatedUser.locked_until).getTime() > nowMs);
            const finalAccountAttempts = updatedUser?.failed_login_attempts || 0;

            const updatedIp = await env.DB.prepare(`SELECT failed_attempts, locked_until FROM login_security WHERE ip_address = ?`).bind(clientIp).first();
            const ipWillLock = Boolean(updatedIp?.locked_until && new Date(updatedIp.locked_until).getTime() > nowMs);

            if (accountWillLock || ipWillLock) {
                await logAudit(env, {
                    actingUserId: user.id,
                    actingUsername: user.username,
                    action: "login.lockout.account",
                    resourceType: "auth",
                    status: "FAILURE",
                    reason: `Account/IP locked out after failed MFA attempts`,
                    ipAddress: clientIp,
                    userAgent
                });

                const lockMs = ipWillLock ? ipLockoutMs : accountLockoutMs;
                const retryAfter = Math.max(1, Math.ceil(lockMs / 1000));
                return tooManyRequests("Too many unsuccessful sign-in attempts. Please try again later.", retryAfter);
            }

            await logAudit(env, {
                actingUserId: user.id,
                actingUsername: user.username,
                action: "auth.mfa.verify.failed",
                resourceType: "auth",
                status: "FAILURE",
                reason: `Invalid TOTP code or recovery code (attempt ${finalAccountAttempts}/${maxAccountAttempts})`,
                ipAddress: clientIp,
                userAgent
            });

            return badRequest("Invalid verification code or recovery code.", {
                code: "INVALID_MFA_CODE",
                attempts_remaining: Math.max(0, maxAccountAttempts - finalAccountAttempts)
            });
        }

        // On successful MFA verification, reset IP failure record
        await env.DB.prepare(`
            UPDATE login_security
            SET failed_attempts = 0,
                last_attempt_at = ?,
                locked_until = NULL
            WHERE ip_address = ?
        `).bind(nowIso, clientIp).run();

        const nextTokenVersion = tokenVersion + 1;

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
                token_version: nextTokenVersion
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
    const auth = await authenticate(request, env, null, false, true, false);
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
 * Initiate TOTP MFA provisioning (returns Base32 secret, setup token, and OTPAuth URI)
 */
export async function setupMfa(request, env) {
    const auth = await authenticate(request, env, null, false, true, false);
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    let mfaEncryptionKey;
    try {
        validateJwtSecret(env?.JWT_SECRET);
        mfaEncryptionKey = getMfaEncryptionSecret(env);
    } catch {
        return serverError("Security configuration error: JWT_SECRET or MFA encryption secret is not configured properly.");
    }

    try {
        // Generate new 160-bit secret
        const plainSecret = generateMfaSecret();
        const encryptedSecret = await encryptMfaSecret(plainSecret, mfaEncryptionKey);

        // Issue a temporary setup context token containing the encrypted secret
        // Do NOT permanently store in DB until verification!
        const setupToken = await createToken(
            {
                id: auth.user.id,
                username: auth.user.username,
                encrypted_secret: encryptedSecret,
                scope: "mfa_setup_pending",
                token_version: auth.user.token_version ?? 1
            },
            env.JWT_SECRET,
            600 // 10 minutes setup validity
        );

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
            setup_token: setupToken,
            issuer: "Automobile Dealership",
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
    const auth = await authenticate(request, env, null, false, true, false);
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    let mfaEncryptionKey;
    try {
        validateJwtSecret(env?.JWT_SECRET);
        mfaEncryptionKey = getMfaEncryptionSecret(env);
    } catch {
        return serverError("Security configuration error: JWT_SECRET or MFA encryption secret is not configured properly.");
    }

    try {
        const body = await request.json().catch(() => ({}));
        const code = body.code ? String(body.code).trim() : null;

        if (!code) {
            return badRequest("6-digit verification code is required.");
        }

        // Retrieve encrypted secret from temporary setup token
        let encryptedSecret = null;
        let decodedToken = null;
        
        // 1. Try reading setup token from body or Authorization header
        const rawSetupToken = body.setup_token || (request.headers.get("Authorization")?.startsWith("Bearer ") ? request.headers.get("Authorization").substring(7).trim() : null);

        if (rawSetupToken) {
            decodedToken = await verifyToken(rawSetupToken, env.JWT_SECRET);
            if (
                decodedToken &&
                decodedToken.encrypted_secret &&
                decodedToken.scope === "mfa_setup_pending" &&
                decodedToken.id === auth.user.id &&
                (decodedToken.token_version ?? 1) === (auth.user.token_version ?? 1)
            ) {
                encryptedSecret = decodedToken.encrypted_secret;
            }
        }

        if (!encryptedSecret) {
            return badRequest("MFA setup session has expired or is invalid. Please initiate MFA setup again.");
        }

        const plainSecret = await decryptMfaSecret(encryptedSecret, mfaEncryptionKey);
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

        // Prepare atomic batch execution
        const nowIso = new Date().toISOString();
        const statements = [
            env.DB.prepare(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`).bind(auth.user.id)
        ];

        for (const rawCode of plainRecoveryCodes) {
            const hashed = await hashRecoveryCode(rawCode);
            statements.push(
                env.DB.prepare(`
                    INSERT INTO mfa_recovery_codes (user_id, code_hash, is_used, created_at)
                    VALUES (?, ?, 0, ?)
                `).bind(auth.user.id, hashed, nowIso)
            );
        }

        // Atomically update user state: store encrypted secret, enable MFA, and increment token_version to invalidate pre-MFA sessions!
        statements.push(
            env.DB.prepare(`
                UPDATE users
                SET mfa_secret_encrypted = ?, mfa_enabled = 1, mfa_enrolled_at = ?, mfa_last_used_at = ?, token_version = token_version + 1, updated_at = ?
                WHERE id = ?
            `).bind(encryptedSecret, nowIso, nowIso, nowIso, auth.user.id)
        );

        await env.DB.batch(statements);

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
        const isMandatorySetup = decodedToken?.scope === "mfa_setup_pending";

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

            // Immediately terminate temporary authentication session - do NOT issue full session token!
            return success({
                requires_login: true,
                mfa_enrolled: true,
                recovery_codes: plainRecoveryCodes,
                message: "Mandatory Multi-Factor Authentication enrollment completed successfully. Please sign in again."
            });
        }

        // Issue fresh session token with the incremented token_version
        const nextTokenVersion = (auth.user.token_version ?? 1) + 1;
        const freshToken = await createToken(
            {
                id: auth.user.id,
                username: auth.user.username,
                role_id: auth.user.role_id,
                token_version: nextTokenVersion
            },
            env.JWT_SECRET,
            JWT.SESSION_EXPIRES_IN
        );

        return success({
            token: freshToken,
            mfa_enrolled: true,
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

    let mfaEncryptionKey;
    try {
        validateJwtSecret(env?.JWT_SECRET);
        mfaEncryptionKey = getMfaEncryptionSecret(env);
    } catch {
        return serverError("Security configuration error: JWT_SECRET or MFA encryption secret is not configured properly.");
    }

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
            .prepare(`
                SELECT u.password_hash, u.mfa_enabled, u.mfa_secret_encrypted, u.token_version, u.mfa_enforced,
                       r.mfa_required as role_mfa_required
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = ?
                LIMIT 1
            `)
            .bind(auth.user.id)
            .first();

        if (!user || user.mfa_enabled !== 1) {
            return badRequest("MFA is not enabled on this account.");
        }

        if (user.role_mfa_required === 1 || user.mfa_enforced === 1) {
            return forbidden("Multi-Factor Authentication is required for your role or account and cannot be disabled.");
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
            const plainSecret = await decryptMfaSecret(user.mfa_secret_encrypted, mfaEncryptionKey);
            if (plainSecret) {
                isCodeValid = await verifyTotpCode(plainSecret, code, 1);
            }
        } else if (recoveryCode) {
            const candidates = await env.DB
                .prepare(`SELECT id, code_hash FROM mfa_recovery_codes WHERE user_id = ? AND is_used = 0`)
                .bind(auth.user.id)
                .all();

            for (const row of (candidates.results || [])) {
                if (await verifyRecoveryCode(recoveryCode, row.code_hash)) {
                    isCodeValid = true;
                    break;
                }
            }
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

        // Disable MFA atomically: clear settings, delete recovery codes, and increment token_version to invalidate all existing sessions!
        const nowIso = new Date().toISOString();
        const statements = [
            env.DB.prepare(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`).bind(auth.user.id),
            env.DB.prepare(`
                UPDATE users
                SET mfa_enabled = 0, mfa_secret_encrypted = NULL, mfa_enrolled_at = NULL, token_version = token_version + 1, updated_at = ?
                WHERE id = ?
            `).bind(nowIso, auth.user.id)
        ];
        await env.DB.batch(statements);

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

        const nextTokenVersion = (user.token_version ?? 1) + 1;
        const freshToken = await createToken(
            {
                id: auth.user.id,
                username: auth.user.username,
                role_id: auth.user.role_id,
                token_version: nextTokenVersion
            },
            env.JWT_SECRET,
            JWT.SESSION_EXPIRES_IN
        );

        return success({ token: freshToken }, "Multi-Factor Authentication disabled successfully.");

    } catch (error) {
        console.error("Disable MFA error:", error);
        return serverError("Failed to disable MFA.");
    }
}

/**
 * POST /api/v1/auth/mfa/recovery-codes/regenerate
 * Regenerate recovery codes for user with MFA enabled
 */
export async function regenerateRecoveryCodes(request, env) {
    const auth = await authenticate(request, env);
    if (auth.errorResponse) return auth.errorResponse;

    const { ipAddress, userAgent } = getRequestMeta(request);

    try {
        validateJwtSecret(env?.JWT_SECRET);
    } catch {
        return serverError("Security configuration error: JWT_SECRET is not configured properly.");
    }

    try {
        const body = await request.json().catch(() => ({}));
        const password = body.password;

        if (!password) {
            return badRequest("Current password is required to regenerate recovery codes.");
        }

        const user = await env.DB
            .prepare(`SELECT password_hash, mfa_enabled, token_version FROM users WHERE id = ? LIMIT 1`)
            .bind(auth.user.id)
            .first();

        if (!user || user.mfa_enabled !== 1) {
            return badRequest("MFA is not enabled on this account.");
        }

        const isPasswordValid = await verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            await logAudit(env, {
                actingUserId: auth.user.id,
                actingUsername: auth.user.username,
                action: "auth.mfa.recovery_regenerate_failed",
                resourceType: "user",
                status: "FAILURE",
                reason: "Incorrect password supplied during recovery code regeneration",
                ipAddress,
                userAgent
            });
            return badRequest("Incorrect password.");
        }

        // Generate 8 new recovery codes
        const plainRecoveryCodes = generateRecoveryCodes(8);
        const nowIso = new Date().toISOString();

        const statements = [
            env.DB.prepare(`DELETE FROM mfa_recovery_codes WHERE user_id = ?`).bind(auth.user.id)
        ];

        for (const rawCode of plainRecoveryCodes) {
            const hashed = await hashRecoveryCode(rawCode);
            statements.push(
                env.DB.prepare(`
                    INSERT INTO mfa_recovery_codes (user_id, code_hash, is_used, created_at)
                    VALUES (?, ?, 0, ?)
                `).bind(auth.user.id, hashed, nowIso)
            );
        }

        // Invalidate prior sessions when recovery codes are regenerated (security best practice)
        statements.push(
            env.DB.prepare(`UPDATE users SET token_version = token_version + 1, updated_at = ? WHERE id = ?`).bind(nowIso, auth.user.id)
        );

        await env.DB.batch(statements);

        const nextTokenVersion = (user.token_version ?? 1) + 1;
        const freshToken = await createToken(
            {
                id: auth.user.id,
                username: auth.user.username,
                role_id: auth.user.role_id,
                token_version: nextTokenVersion
            },
            env.JWT_SECRET,
            JWT.SESSION_EXPIRES_IN
        );

        await logAudit(env, {
            actingUserId: auth.user.id,
            actingUsername: auth.user.username,
            action: "auth.mfa.recovery_codes_regenerated",
            resourceType: "user",
            resourceId: String(auth.user.id),
            status: "SUCCESS",
            ipAddress,
            userAgent
        });

        return success({
            recovery_codes: plainRecoveryCodes,
            token: freshToken,
            message: "Recovery codes regenerated successfully. Existing sessions have been updated."
        });

    } catch (error) {
        console.error("Regenerate recovery codes error:", error);
        return serverError("Failed to regenerate recovery codes.");
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

    if (targetId === auth.user.id) {
        return badRequest("You cannot administratively reset your own MFA. Please use the MFA settings page.");
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

    if (targetId === auth.user.id) {
        return badRequest("You cannot administratively enforce MFA on your own account.");
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
            await env.DB.prepare(`UPDATE users SET mfa_enforced = 1, token_version = token_version + 1, updated_at = ? WHERE id = ?`).bind(nowIso, targetId).run();
        } catch (e) {
            try {
                await env.DB.prepare(`ALTER TABLE users ADD COLUMN mfa_enforced INTEGER DEFAULT 0`).run();
                await env.DB.prepare(`UPDATE users SET mfa_enforced = 1, token_version = token_version + 1, updated_at = ? WHERE id = ?`).bind(nowIso, targetId).run();
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

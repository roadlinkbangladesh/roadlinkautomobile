import { badRequest, unauthorized, forbidden, tooManyRequests, serverError, success } from "../../utils/response.js";
import { verifyPassword } from "../../utils/password.js";
import { createToken } from "../../utils/jwt.js";
import { JWT } from "../../config/constants.js";
import { logAudit, getRequestMeta } from "../../utils/audit.js";
import { platformConfig } from "../../services/platform-config.js";

// Dummy PBKDF2 hash used to prevent timing side-channel attacks during username enumeration attempts
const DUMMY_HASH = "pbkdf2$sha-256$100000$32$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function login(request, env) {
    const { ipAddress, userAgent } = getRequestMeta(request);
    const clientIp = ipAddress || "unknown_ip";

    try {
        const body = await request.json();
        
        const username = body.username?.trim();
        const password = body.password;
        const rememberMe = body.rememberMe === true;
        
        if (!username || !password) {
            return badRequest("Username and password are required.");
        }

        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();

        // 1. Fetch platform settings for brute force thresholds
        const config = await platformConfig.getConfig(env);
        const maxAccountAttempts = config.max_failed_login_attempts || 5;
        const accountLockoutMinutes = config.account_lockout_duration_minutes || config.lockout_duration_minutes || 15;
        const accountLockoutMs = accountLockoutMinutes * 60 * 1000;

        const maxIpAttempts = config.max_ip_failed_attempts || 15;
        const ipLockoutMinutes = config.ip_lockout_duration_minutes || config.lockout_duration_minutes || 15;
        const ipLockoutMs = ipLockoutMinutes * 60 * 1000;

        // 2. Check IP security state from login_security table
        const ipRecord = await env.DB
            .prepare(`SELECT * FROM login_security WHERE ip_address = ?`)
            .bind(clientIp)
            .first();

        let isIpLocked = false;
        let isIpLockExpired = false;
        let ipRemainingMs = 0;

        if (ipRecord && ipRecord.locked_until) {
            const lockedUntilTime = new Date(ipRecord.locked_until).getTime();
            if (lockedUntilTime > nowMs) {
                isIpLocked = true;
                ipRemainingMs = lockedUntilTime - nowMs;
            } else {
                isIpLockExpired = true;
            }
        }

        // 3. Fetch user by username (case-insensitive lookup)
        const user = await env.DB
            .prepare(`
                SELECT u.*, r.name as role_name, r.is_system_role, r.system_role_key
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE LOWER(u.username) = LOWER(?)
                LIMIT 1
            `)
            .bind(username)
            .first();

        let isAccountLocked = false;
        let isAccountLockExpired = false;
        let accountRemainingMs = 0;

        if (user && user.locked_until) {
            const lockedUntilTime = new Date(user.locked_until).getTime();
            if (lockedUntilTime > nowMs) {
                isAccountLocked = true;
                accountRemainingMs = lockedUntilTime - nowMs;
            } else {
                isAccountLockExpired = true;
            }
        }

        // Handle expired IP lock
        if (isIpLockExpired) {
            await env.DB
                .prepare(`UPDATE login_security SET failed_attempts = 0, locked_until = NULL WHERE ip_address = ?`)
                .bind(clientIp)
                .run();
            
            await logAudit(env, {
                actingUsername: username,
                action: "login.unlock.auto",
                resourceType: "auth",
                status: "SUCCESS",
                reason: "IP lockout duration expired",
                ipAddress: clientIp,
                userAgent
            });
        }

        // Handle expired Account lock
        if (isAccountLockExpired && user) {
            await env.DB
                .prepare(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`)
                .bind(user.id)
                .run();
            
            await logAudit(env, {
                actingUserId: user.id,
                actingUsername: user.username,
                targetUserId: user.id,
                action: "login.unlock.auto",
                resourceType: "auth",
                status: "SUCCESS",
                reason: "Account lockout duration expired",
                ipAddress: clientIp,
                userAgent
            });
        }

        // 4. Enforce Lockout Check (Step 2)
        // If either IP or Account is currently locked out, reject immediately with HTTP 429 and Retry-After header
        if (isIpLocked || isAccountLocked) {
            const remainingMs = Math.max(ipRemainingMs, accountRemainingMs);
            const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

            await logAudit(env, {
                actingUserId: user?.id || null,
                actingUsername: user?.username || username,
                targetUserId: user?.id || null,
                action: isAccountLocked ? "login.lockout.account" : "login.lockout.ip",
                resourceType: "auth",
                status: "BLOCKED",
                reason: isAccountLocked ? "Account temporarily locked" : "IP temporarily locked",
                ipAddress: clientIp,
                userAgent
            });

            return tooManyRequests("Too many unsuccessful sign-in attempts. Please try again later.", retryAfterSeconds);
        }

        // 5. Validate Password (Step 3)
        // Constant-time execution: run PBKDF2 calculation even if user doesn't exist
        const validPassword = user
            ? await verifyPassword(password, user.password_hash)
            : await verifyPassword(password, DUMMY_HASH);

        // Failure handling (either user non-existent or password wrong)
        if (!user || !validPassword) {
            // Update IP failure counter
            const currentIpAttempts = (ipRecord && !isIpLockExpired) ? (ipRecord.failed_attempts || 0) : 0;
            const newIpAttempts = currentIpAttempts + 1;
            const ipWillLock = newIpAttempts >= maxIpAttempts;
            const ipLockedUntilIso = ipWillLock ? new Date(nowMs + ipLockoutMs).toISOString() : null;

            await env.DB.prepare(`
                INSERT INTO login_security (ip_address, failed_attempts, last_attempt_at, locked_until)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(ip_address) DO UPDATE SET
                    failed_attempts = excluded.failed_attempts,
                    last_attempt_at = excluded.last_attempt_at,
                    locked_until = excluded.locked_until
            `).bind(clientIp, newIpAttempts, nowIso, ipLockedUntilIso).run();

            if (ipWillLock) {
                await logAudit(env, {
                    actingUsername: username,
                    action: "login.lockout.ip",
                    resourceType: "auth",
                    status: "FAILURE",
                    reason: `IP locked for ${ipLockoutMinutes} minutes after ${newIpAttempts} failed attempts`,
                    ipAddress: clientIp,
                    userAgent
                });
            }

            // Update Account failure counter if user exists
            let accountWillLock = false;
            if (user) {
                const currentAccountAttempts = (!isAccountLockExpired) ? (user.failed_login_attempts || 0) : 0;
                const newAccountAttempts = currentAccountAttempts + 1;
                accountWillLock = newAccountAttempts >= maxAccountAttempts;
                const accountLockedUntilIso = accountWillLock ? new Date(nowMs + accountLockoutMs).toISOString() : null;

                await env.DB.prepare(`
                    UPDATE users
                    SET failed_login_attempts = ?,
                        last_failed_login_at = ?,
                        locked_until = ?,
                        updated_at = ?
                    WHERE id = ?
                `).bind(newAccountAttempts, nowIso, accountLockedUntilIso, nowIso, user.id).run();

                if (accountWillLock) {
                    await logAudit(env, {
                        actingUserId: user.id,
                        actingUsername: user.username,
                        targetUserId: user.id,
                        action: "login.lockout.account",
                        resourceType: "auth",
                        status: "FAILURE",
                        reason: `Account locked for ${accountLockoutMinutes} minutes after ${newAccountAttempts} failed attempts`,
                        ipAddress: clientIp,
                        userAgent
                    });
                }
            }

            // Log general login failure audit record
            await logAudit(env, {
                actingUserId: user?.id || null,
                actingUsername: user?.username || username,
                targetUserId: user?.id || null,
                action: "login.failure",
                resourceType: "auth",
                status: "FAILURE",
                reason: user ? "Incorrect password" : "User not found",
                ipAddress: clientIp,
                userAgent
            });

            if (ipWillLock || accountWillLock) {
                const lockMs = ipWillLock ? ipLockoutMs : accountLockoutMs;
                const retryAfter = Math.max(1, Math.ceil(lockMs / 1000));
                return tooManyRequests("Too many unsuccessful sign-in attempts. Please try again later.", retryAfter);
            }

            return unauthorized("Invalid username or password.");
        }

        // Account Status Check
        if (user.is_active !== 1) {
            await logAudit(env, {
                actingUserId: user.id,
                actingUsername: user.username,
                action: "login.failure",
                resourceType: "auth",
                status: "FAILURE",
                reason: "User account deactivated",
                ipAddress: clientIp,
                userAgent
            });
            return forbidden("Your account is deactivated.");
        }

        // 6. On Successful Authentication (Step 4)
        // Reset failed attempt counters and lock timers for both user and IP
        await env.DB.prepare(`
            UPDATE users
            SET failed_login_attempts = 0,
                last_failed_login_at = NULL,
                locked_until = NULL,
                last_login_at = ?,
                updated_at = ?
            WHERE id = ?
        `).bind(nowIso, nowIso, user.id).run();

        await env.DB.prepare(`
            UPDATE login_security
            SET failed_attempts = 0,
                last_attempt_at = ?,
                locked_until = NULL
            WHERE ip_address = ?
        `).bind(nowIso, clientIp).run();

        // Clean up stale login_security records older than 24 hours
        try {
            await env.DB.prepare(`
                DELETE FROM login_security
                WHERE last_attempt_at < datetime('now', '-1 day') AND locked_until IS NULL
            `).run();
        } catch (e) {
            // Non-blocking cleanup
        }

        // Check if Multi-Factor Authentication is enabled for user
        if (user.mfa_enabled === 1) {
            const mfaToken = await createToken(
                {
                    id: user.id,
                    username: user.username,
                    scope: "mfa_pending",
                    rememberMe
                },
                env.JWT_SECRET,
                300 // 5 minutes pre-auth validity
            );

            await logAudit(env, {
                actingUserId: user.id,
                actingUsername: user.username,
                action: "auth.mfa.pending",
                resourceType: "auth",
                status: "SUCCESS",
                ipAddress: clientIp,
                userAgent,
                details: { message: "Primary credentials verified; awaiting second factor" }
            });

            return success({
                mfa_required: true,
                mfa_token: mfaToken,
                user: {
                    id: user.id,
                    username: user.username,
                    display_name: user.display_name
                }
            });
        }

        // Determine token lifetime based on Remember Me selection
        const expiresIn = rememberMe
            ? JWT.REMEMBER_ME_EXPIRES_IN
            : JWT.SESSION_EXPIRES_IN;
        
        // Fetch user permissions
        const permissionsQuery = await env.DB
            .prepare(`
                SELECT permission_key
                FROM role_permissions
                WHERE role_id = ?
            `)
            .bind(user.role_id)
            .all();
        const permissions = (permissionsQuery.results || []).map(p => p.permission_key);

        // Generate JWT with session token_version
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
        
        // Log successful login audit record
        await logAudit(env, {
            actingUserId: user.id,
            actingUsername: user.username,
            action: "login.success",
            resourceType: "auth",
            status: "SUCCESS",
            ipAddress: clientIp,
            userAgent,
            details: { rememberMe }
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
                permissions: permissions
            }
        });

    } catch (error) {
        console.error("Login error:", error);
        return serverError();
    }
}

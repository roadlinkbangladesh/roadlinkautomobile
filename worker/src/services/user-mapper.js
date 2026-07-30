/**
 * Data Mapper for User entity and API responses
 */

/**
 * Maps raw user DB record to API response DTO
 * @param {Object} user
 * @param {Object} options
 * @returns {Object}
 */
export function mapUserToDTO(user, options = {}) {
  if (!user) return null;

  const nowMs = Date.now();
  const isLocked = user.locked_until ? (new Date(user.locked_until).getTime() > nowMs) : false;
  const mfaRequired = user.role_mfa_required === 1 || user.mfa_enforced === 1;

  const dto = {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role_id: user.role_id,
    role_name: user.role_name,
    is_system_role: user.is_system_role,
    system_role_key: user.system_role_key,
    is_active: user.is_active === 1,
    must_change_password: user.must_change_password === 1,
    failed_login_attempts: user.failed_login_attempts || 0,
    last_failed_login_at: user.last_failed_login_at || null,
    locked_until: user.locked_until || null,
    is_locked: isLocked,
    mfa_enabled: user.mfa_enabled === 1,
    mfa_required: mfaRequired,
    mfa_enforced: mfaRequired,
    mfa_enrolled_at: user.mfa_enrolled_at || null,
    mfa_last_used_at: user.mfa_last_used_at || null,
    created_at: user.created_at,
    updated_at: user.updated_at
  };

  if (options.recoveryCount !== undefined) {
    dto.recovery_codes_remaining = options.recoveryCount;
  }

  if (options.permissions) {
    dto.permissions = options.permissions;
  }

  return dto;
}

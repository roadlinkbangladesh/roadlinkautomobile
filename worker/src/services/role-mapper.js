/**
 * Data Mapper for Role entity and API responses
 */

/**
 * Maps raw role record and counts/permissions to DTO
 * @param {Object} role
 * @param {Object} options
 * @returns {Object}
 */
export function mapRoleToDTO(role, options = {}) {
  if (!role) return null;

  const isSystemRole = role.is_system_role === 1 || role.system_role_key === "SUPER_ADMIN";

  const dto = {
    id: role.id,
    name: role.name,
    description: role.description,
    is_system_role: isSystemRole,
    system_role_key: role.system_role_key || null,
    mfa_required: role.mfa_required === 1,
    created_at: role.created_at,
    updated_at: role.updated_at
  };

  if (options.permissions_count !== undefined) {
    dto.permissions_count = options.permissions_count;
  }

  if (options.users_count !== undefined) {
    dto.users_count = options.users_count;
  }

  if (options.permissions !== undefined) {
    dto.permissions = options.permissions;
  }

  return dto;
}

/**
 * Repository handling database access and persistence operations for the Role domain.
 */
export class RoleRepository {
  /**
   * Find all roles ordered by ID ASC
   * @param {Object} db - D1 Database binding
   * @returns {Promise<Array>}
   */
  static async findAll(db) {
    const res = await db.prepare(`SELECT * FROM roles ORDER BY id ASC`).all();
    return res?.results || [];
  }

  /**
   * Find single role by ID
   * @param {Object} db
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(db, id) {
    return await db.prepare(`SELECT * FROM roles WHERE id = ? LIMIT 1`).bind(id).first() || null;
  }

  /**
   * Find role by name (case-insensitive)
   * @param {Object} db
   * @param {string} name
   * @param {number|null} excludeId
   * @returns {Promise<Object|null>}
   */
  static async findByName(db, name, excludeId = null) {
    if (excludeId) {
      return await db
        .prepare(`SELECT id FROM roles WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1`)
        .bind(name, excludeId)
        .first() || null;
    }
    return await db
      .prepare(`SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1`)
      .bind(name)
      .first() || null;
  }

  /**
   * Find all permission keys for a role
   * @param {Object} db
   * @param {number} roleId
   * @returns {Promise<Array<string>>}
   */
  static async findPermissionsByRoleId(db, roleId) {
    const res = await db
      .prepare(`SELECT permission_key FROM role_permissions WHERE role_id = ?`)
      .bind(roleId)
      .all();
    return (res?.results || []).map(p => p.permission_key);
  }

  /**
   * Get total permissions count for a role
   * @param {Object} db
   * @param {number} roleId
   * @returns {Promise<number>}
   */
  static async getPermissionsCount(db, roleId) {
    const res = await db
      .prepare(`SELECT count(*) as count FROM role_permissions WHERE role_id = ?`)
      .bind(roleId)
      .first();
    return res?.count || 0;
  }

  /**
   * Get total assigned users count for a role
   * @param {Object} db
   * @param {number} roleId
   * @returns {Promise<number>}
   */
  static async getUsersCount(db, roleId) {
    const res = await db
      .prepare(`SELECT count(*) as count FROM users WHERE role_id = ?`)
      .bind(roleId)
      .first();
    return res?.count || 0;
  }

  /**
   * Create a new role record
   * @param {Object} db
   * @param {Object} param1
   * @returns {Promise<Object>} Created role row
   */
  static async createRole(db, { name, description, mfaRequired }) {
    const now = new Date().toISOString();
    await db
      .prepare(`
        INSERT INTO roles (name, description, is_system_role, mfa_required, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?, ?)
      `)
      .bind(name, description, mfaRequired ? 1 : 0, now, now)
      .run();

    return await this.findByName(db, name);
  }

  /**
   * Update role details
   * @param {Object} db
   * @param {number} id
   * @param {Object} param2
   * @returns {Promise<Object>} Updated role row
   */
  static async updateRole(db, id, { name, description, mfaRequired }) {
    const now = new Date().toISOString();
    await db
      .prepare(`
        UPDATE roles
        SET name = ?, description = ?, mfa_required = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(name, description, mfaRequired ? 1 : 0, now, id)
      .run();

    return await this.findById(db, id);
  }

  /**
   * Delete role record
   * @param {Object} db
   * @param {number} id
   */
  static async deleteRole(db, id) {
    await db.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).bind(id).run();
    await db.prepare(`DELETE FROM roles WHERE id = ?`).bind(id).run();
  }

  /**
   * Sync permissions for a role
   * @param {Object} db
   * @param {number} roleId
   * @param {Array<string>} permissionKeys
   * @param {Array<string>} validSystemKeys
   */
  static async setRolePermissions(db, roleId, permissionKeys, validSystemKeys) {
    await db.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).bind(roleId).run();

    for (const perm of permissionKeys) {
      if (validSystemKeys.includes(perm)) {
        await db
          .prepare(`INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES (?, ?)`)
          .bind(roleId, perm)
          .run();
      }
    }
  }

  /**
   * Revoke active sessions for all users in a role
   * @param {Object} db
   * @param {number} roleId
   */
  static async invalidateUserTokensByRoleId(db, roleId) {
    await db
      .prepare(`UPDATE users SET token_version = token_version + 1 WHERE role_id = ?`)
      .bind(roleId)
      .run();
  }
}

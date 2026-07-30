/**
 * Repository handling database access and persistence operations for the User domain.
 */
export class UserRepository {
  /**
   * Find all user records joined with roles
   * @param {Object} db - D1 Database binding
   * @returns {Promise<Array>}
   */
  static async findAll(db) {
    let users;
    try {
      users = await db
        .prepare(`
          SELECT u.id, u.username, u.display_name, u.role_id, r.name as role_name, r.is_system_role, r.system_role_key, r.mfa_required as role_mfa_required, u.is_active, u.last_login_at, u.created_at, u.updated_at, u.must_change_password, u.failed_login_attempts, u.last_failed_login_at, u.locked_until, u.mfa_enabled, u.mfa_enrolled_at, u.mfa_last_used_at, u.mfa_enforced
          FROM users u
          LEFT JOIN roles r ON u.role_id = r.id
          ORDER BY u.id ASC
        `)
        .all();
    } catch (e) {
      users = await db
        .prepare(`
          SELECT u.id, u.username, u.display_name, u.role_id, r.name as role_name, r.is_system_role, r.system_role_key, r.mfa_required as role_mfa_required, u.is_active, u.last_login_at, u.created_at, u.updated_at, u.must_change_password, u.failed_login_attempts, u.last_failed_login_at, u.locked_until, u.mfa_enabled, u.mfa_enrolled_at
          FROM users u
          LEFT JOIN roles r ON u.role_id = r.id
          ORDER BY u.id ASC
        `)
        .all();
    }
    return users?.results || [];
  }

  /**
   * Find user by ID joined with role details
   * @param {Object} db - D1 Database binding
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  static async findById(db, id) {
    let user;
    try {
      user = await db
        .prepare(`
          SELECT u.id, u.username, u.display_name, u.role_id, r.name as role_name, r.is_system_role, r.system_role_key, r.mfa_required as role_mfa_required, u.is_active, u.last_login_at, u.created_at, u.updated_at, u.must_change_password, u.failed_login_attempts, u.last_failed_login_at, u.locked_until, u.mfa_enabled, u.mfa_enrolled_at, u.mfa_last_used_at, u.mfa_enforced, u.password_hash
          FROM users u
          LEFT JOIN roles r ON u.role_id = r.id
          WHERE u.id = ?
          LIMIT 1
        `)
        .bind(id)
        .first();
    } catch (e) {
      user = await db
        .prepare(`
          SELECT u.id, u.username, u.display_name, u.role_id, r.name as role_name, r.is_system_role, r.system_role_key, r.mfa_required as role_mfa_required, u.is_active, u.last_login_at, u.created_at, u.updated_at, u.must_change_password, u.failed_login_attempts, u.last_failed_login_at, u.locked_until, u.mfa_enabled, u.mfa_enrolled_at, u.password_hash
          FROM users u
          LEFT JOIN roles r ON u.role_id = r.id
          WHERE u.id = ?
          LIMIT 1
        `)
        .bind(id)
        .first();
    }
    return user || null;
  }

  /**
   * Find raw user by username (case-insensitive)
   * @param {Object} db
   * @param {string} username
   * @returns {Promise<Object|null>}
   */
  static async findByUsername(db, username) {
    return await db
      .prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`)
      .bind(username)
      .first() || null;
  }

  /**
   * Count unused MFA recovery codes for a user
   * @param {Object} db
   * @param {number} userId
   * @returns {Promise<number>}
   */
  static async getMfaRecoveryCount(db, userId) {
    const res = await db
      .prepare(`SELECT count(*) as count FROM mfa_recovery_codes WHERE user_id = ? AND is_used = 0`)
      .bind(userId)
      .first();
    return res?.count || 0;
  }

  /**
   * Create a new user record
   * @param {Object} db
   * @param {Object} userData
   * @returns {Promise<Object>} Created user row
   */
  static async create(db, { username, passwordHash, displayName, roleId, roleName, isActive }) {
    const now = new Date().toISOString();
    const roleSlug = (roleName || "").toLowerCase();
    const legacyRole = (roleSlug === "admin" || roleSlug === "super administrator") ? "admin" : "manager";

    try {
      await db
        .prepare(`
          INSERT INTO users (username, password_hash, display_name, role_id, is_active, must_change_password, token_version, failed_login_attempts, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
        `)
        .bind(username, passwordHash, displayName, roleId, isActive ? 1 : 0, 1, now, now)
        .run();
    } catch (insertErr) {
      if (insertErr && insertErr.message && (
        insertErr.message.includes("users.role") || 
        insertErr.message.includes("NOT NULL constraint failed") ||
        insertErr.message.includes("CHECK constraint failed")
      )) {
        await db
          .prepare(`
            INSERT INTO users (username, password_hash, display_name, role_id, role, is_active, must_change_password, token_version, failed_login_attempts, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
          `)
          .bind(username, passwordHash, displayName, roleId, legacyRole, isActive ? 1 : 0, 1, now, now)
          .run();
      } else {
        throw insertErr;
      }
    }

    return await this.findByUsername(db, username);
  }

  /**
   * Update dynamic fields for a user
   * @param {Object} db
   * @param {number} id
   * @param {Object} fields
   */
  static async update(db, id, fields) {
    const updatedFields = [];
    const bindings = [];

    if (fields.displayName !== undefined) {
      updatedFields.push("display_name = ?");
      bindings.push(fields.displayName);
    }
    if (fields.roleId !== undefined) {
      updatedFields.push("role_id = ?");
      bindings.push(fields.roleId);
    }
    if (fields.isActive !== undefined) {
      updatedFields.push("is_active = ?");
      bindings.push(fields.isActive ? 1 : 0);
    }
    if (fields.incrementTokenVersion) {
      updatedFields.push("token_version = token_version + 1");
    }

    if (updatedFields.length === 0) return null;

    const now = new Date().toISOString();
    updatedFields.push("updated_at = ?");
    bindings.push(now);

    bindings.push(id);

    const query = `UPDATE users SET ${updatedFields.join(", ")} WHERE id = ?`;
    await db.prepare(query).bind(...bindings).run();

    return await this.findById(db, id);
  }

  /**
   * Delete user by ID
   * @param {Object} db
   * @param {number} id
   */
  static async delete(db, id) {
    await db.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
  }

  /**
   * Update password hash and options
   * @param {Object} db
   * @param {number} userId
   * @param {string} passwordHash
   * @param {boolean} mustChangePassword
   */
  static async updatePassword(db, userId, passwordHash, mustChangePassword = true) {
    const now = new Date().toISOString();
    await db
      .prepare(`
        UPDATE users
        SET password_hash = ?, must_change_password = ?, token_version = token_version + 1, updated_at = ?
        WHERE id = ?
      `)
      .bind(passwordHash, mustChangePassword ? 1 : 0, now, userId)
      .run();
  }

  /**
   * Unlock user account and reset failed login attempts
   * @param {Object} db
   * @param {number} userId
   */
  static async unlockUser(db, userId) {
    const nowIso = new Date().toISOString();
    await db
      .prepare(`
        UPDATE users
        SET failed_login_attempts = 0,
            last_failed_login_at = NULL,
            locked_until = NULL,
            updated_at = ?
        WHERE id = ?
      `)
      .bind(nowIso, userId)
      .run();
  }
}

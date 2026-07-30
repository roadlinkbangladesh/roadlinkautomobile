import { UserRepository } from "../repositories/user-repository.js";
import { mapUserToDTO } from "./user-mapper.js";
import { isStrictlyLessPrivileged } from "../utils/auth.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { validatePasswordComplexity } from "../utils/password-validator.js";
import { wouldCauseSuperAdminLockout } from "../utils/lockout.js";
import { logAudit } from "../utils/audit.js";

export class UserDomainError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = "UserDomainError";
    this.status = status;
    this.code = code;
  }
}

export class UserService {
  /**
   * List users visible to acting user
   */
  static async listUsers(env, authUser) {
    const results = await UserRepository.findAll(env.DB);

    let viewableUsers = results;
    if (!authUser.is_super_admin) {
      const filtered = [];
      for (const u of results) {
        if (u.id === authUser.id || (await isStrictlyLessPrivileged(env, u.role_id, authUser.role_id))) {
          filtered.push(u);
        }
      }
      viewableUsers = filtered;
    }

    return viewableUsers.map(u => mapUserToDTO(u));
  }

  /**
   * Get single user by ID
   */
  static async getUserById(env, authUser, id) {
    const user = await UserRepository.findById(env.DB, id);
    if (!user) {
      throw new UserDomainError("User not found.", 404);
    }

    if (!authUser.is_super_admin) {
      if (id !== authUser.id && !(await isStrictlyLessPrivileged(env, user.role_id, authUser.role_id))) {
        throw new UserDomainError("Access denied. You do not have permission to view this user's details.", 403);
      }
    }

    const recoveryCount = await UserRepository.getMfaRecoveryCount(env.DB, id);
    return mapUserToDTO(user, { recoveryCount });
  }

  /**
   * Create new user
   */
  static async createUser(env, authUser, body, meta) {
    const { ipAddress, userAgent } = meta;
    const username = body.username?.trim();
    const displayName = body.display_name?.trim();
    const roleId = parseInt(body.role_id, 10);
    const isActive = body.is_active === undefined ? true : Boolean(body.is_active);

    if (!username || !displayName || isNaN(roleId)) {
      throw new UserDomainError("All fields (username, display_name, role_id) are required.", 400);
    }

    const roleExists = await env.DB
      .prepare(`SELECT id, name, is_system_role, system_role_key FROM roles WHERE id = ? LIMIT 1`)
      .bind(roleId)
      .first();

    if (!roleExists) {
      throw new UserDomainError("Invalid role. Selected role does not exist.", 400);
    }

    if (!authUser.is_super_admin) {
      if (!(await isStrictlyLessPrivileged(env, roleId, authUser.role_id))) {
        await logAudit(env, {
          actingUserId: authUser.id,
          actingUsername: authUser.username,
          targetRoleId: roleId,
          action: "security.privilege_escalation_attempt",
          resourceType: "user",
          status: "FAILURE",
          reason: "Attempted to assign role with equal or higher privilege",
          ipAddress,
          userAgent
        });
        throw new UserDomainError("You can only assign roles that are strictly less privileged than your own.", 403);
      }
    }

    const existing = await UserRepository.findByUsername(env.DB, username);
    if (existing) {
      throw new UserDomainError("Username is already taken.", 409);
    }

    const charsUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const charsLower = "abcdefghijkmnopqrstuvwxyz";
    const charsNumbers = "23456789";
    const charsSpecial = "!@#$%^*()_+-=";

    let tempPassword = "Tmp!";
    const allChars = charsUpper + charsLower + charsNumbers + charsSpecial;
    const randomValues = new Uint32Array(8);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < 8; i++) {
      tempPassword += allChars.charAt(randomValues[i] % allChars.length);
    }

    const complexityCheck = validatePasswordComplexity(tempPassword);
    if (!complexityCheck.isValid) {
      tempPassword = "ResetPass123!";
    }

    const passwordHash = await hashPassword(tempPassword);
    const createdUser = await UserRepository.create(env.DB, {
      username,
      passwordHash,
      displayName,
      roleId,
      roleName: roleExists.name,
      isActive
    });

    if (!createdUser) {
      throw new Error("Failed to fetch newly created user record.");
    }

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      targetUserId: createdUser.id,
      targetRoleId: roleId,
      action: "user.create",
      resourceType: "user",
      resourceId: createdUser.id,
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: { username, displayName, roleId, roleName: roleExists.name, isActive }
    });

    return {
      user: mapUserToDTO({ ...createdUser, role_name: roleExists.name }),
      temporaryPassword: tempPassword
    };
  }

  /**
   * Update existing user
   */
  static async updateUser(env, authUser, id, body, meta) {
    const { ipAddress, userAgent } = meta;

    const user = await UserRepository.findById(env.DB, id);
    if (!user) {
      throw new UserDomainError("User not found.", 404);
    }

    const displayName = body.display_name?.trim();
    const roleId = body.role_id === undefined ? undefined : parseInt(body.role_id, 10);
    const isActive = body.is_active;

    if (id === authUser.id) {
      if (isActive !== undefined && !isActive) {
        throw new UserDomainError("You cannot deactivate your own account.", 400);
      }
      if (roleId !== undefined && roleId !== authUser.role_id) {
        throw new UserDomainError("You cannot change your own role.", 400);
      }
    }

    if (!authUser.is_super_admin) {
      if (!(await isStrictlyLessPrivileged(env, user.role_id, authUser.role_id))) {
        await logAudit(env, {
          actingUserId: authUser.id,
          actingUsername: authUser.username,
          targetUserId: id,
          action: "security.privilege_escalation_attempt",
          resourceType: "user",
          status: "FAILURE",
          reason: "Attempted to modify user account of equal or higher privilege",
          ipAddress,
          userAgent
        });
        throw new UserDomainError("Access denied. You can only modify user accounts that are strictly less privileged than your own.", 403);
      }

      if (roleId !== undefined && !(await isStrictlyLessPrivileged(env, roleId, authUser.role_id))) {
        await logAudit(env, {
          actingUserId: authUser.id,
          actingUsername: authUser.username,
          targetUserId: id,
          targetRoleId: roleId,
          action: "security.privilege_escalation_attempt",
          resourceType: "user",
          status: "FAILURE",
          reason: "Attempted to assign role of equal or higher privilege",
          ipAddress,
          userAgent
        });
        throw new UserDomainError("You can only assign roles that are strictly less privileged than your own.", 403);
      }
    }

    const causesLockout = await wouldCauseSuperAdminLockout(env, id, isActive, roleId);
    if (causesLockout) {
      await logAudit(env, {
        actingUserId: authUser.id,
        actingUsername: authUser.username,
        targetUserId: id,
        action: "user.update",
        resourceType: "user",
        status: "FAILURE",
        reason: "Administrative Lockout Prevention: Operation would leave zero active Super Administrators.",
        ipAddress,
        userAgent
      });
      throw new UserDomainError("Cannot deactivate or reassign the last active Super Administrator. At least one active Super Administrator account must exist.", 400);
    }

    if (roleId !== undefined) {
      const roleExists = await env.DB
        .prepare(`SELECT id FROM roles WHERE id = ? LIMIT 1`)
        .bind(roleId)
        .first();
      if (!roleExists) {
        throw new UserDomainError("Invalid role. Selected role does not exist.", 400);
      }
    }

    const updatedUser = await UserRepository.update(env.DB, id, {
      displayName,
      roleId,
      isActive,
      incrementTokenVersion: (isActive !== undefined || roleId !== undefined)
    });

    if (!updatedUser) {
      throw new UserDomainError("No editable fields provided.", 400);
    }

    let auditAction = "user.update";
    if (isActive !== undefined && Boolean(user.is_active) !== Boolean(isActive)) {
      auditAction = isActive ? "user.activate" : "user.deactivate";
    } else if (roleId !== undefined && user.role_id !== roleId) {
      auditAction = "role.assignment";
    }

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      targetUserId: id,
      targetRoleId: roleId !== undefined ? roleId : user.role_id,
      action: auditAction,
      resourceType: "user",
      resourceId: id,
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: { displayName, roleId, isActive }
    });

    return mapUserToDTO(updatedUser);
  }

  /**
   * Delete user
   */
  static async deleteUser(env, authUser, id, meta) {
    const { ipAddress, userAgent } = meta;

    if (id === authUser.id) {
      throw new UserDomainError("You cannot delete your own account.", 400);
    }

    const user = await UserRepository.findById(env.DB, id);
    if (!user) {
      throw new UserDomainError("User not found.", 404);
    }

    if (!authUser.is_super_admin) {
      if (!(await isStrictlyLessPrivileged(env, user.role_id, authUser.role_id))) {
        await logAudit(env, {
          actingUserId: authUser.id,
          actingUsername: authUser.username,
          targetUserId: id,
          action: "security.privilege_escalation_attempt",
          resourceType: "user",
          status: "FAILURE",
          reason: "Attempted to delete user account of equal or higher privilege",
          ipAddress,
          userAgent
        });
        throw new UserDomainError("Access denied. You can only delete user accounts that are strictly less privileged than your own.", 403);
      }
    }

    const causesLockout = await wouldCauseSuperAdminLockout(env, id);
    if (causesLockout) {
      await logAudit(env, {
        actingUserId: authUser.id,
        actingUsername: authUser.username,
        targetUserId: id,
        action: "user.delete",
        resourceType: "user",
        status: "FAILURE",
        reason: "Administrative Lockout Prevention: Cannot delete the last active Super Administrator account.",
        ipAddress,
        userAgent
      });
      throw new UserDomainError("Cannot delete the last active Super Administrator account. At least one active Super Administrator must remain.", 400);
    }

    await UserRepository.delete(env.DB, id);

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      targetUserId: id,
      action: "user.delete",
      resourceType: "user",
      resourceId: id,
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: { deletedUsername: user.username }
    });
  }

  /**
   * Reset user password
   */
  static async resetPassword(env, authUser, id, meta) {
    const { ipAddress, userAgent } = meta;

    if (id === authUser.id) {
      throw new UserDomainError("You cannot reset your own password. Please use the Change Password page.", 400);
    }

    const user = await UserRepository.findById(env.DB, id);
    if (!user) {
      throw new UserDomainError("User not found.", 404);
    }

    if (!authUser.is_super_admin) {
      if (!(await isStrictlyLessPrivileged(env, user.role_id, authUser.role_id))) {
        await logAudit(env, {
          actingUserId: authUser.id,
          actingUsername: authUser.username,
          targetUserId: id,
          action: "security.privilege_escalation_attempt",
          resourceType: "user",
          status: "FAILURE",
          reason: "Attempted password reset on user of equal or higher privilege",
          ipAddress,
          userAgent
        });
        throw new UserDomainError("Access denied. You can only reset passwords for users who are strictly less privileged than your own role.", 403);
      }
    }

    const charsUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const charsLower = "abcdefghijkmnopqrstuvwxyz";
    const charsNumbers = "23456789";
    const charsSpecial = "!@#$%^*()_+-=";

    let tempPassword = "Tmp!";
    const allChars = charsUpper + charsLower + charsNumbers + charsSpecial;
    const randomValues = new Uint32Array(8);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < 8; i++) {
      tempPassword += allChars.charAt(randomValues[i] % allChars.length);
    }

    const complexityCheck = validatePasswordComplexity(tempPassword);
    if (!complexityCheck.isValid) {
      tempPassword = "ResetPass123!";
    }

    const passwordHash = await hashPassword(tempPassword);
    await UserRepository.updatePassword(env.DB, id, passwordHash, true);

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      targetUserId: id,
      action: "user.password_reset",
      resourceType: "user",
      resourceId: id,
      status: "SUCCESS",
      ipAddress,
      userAgent
    });

    return { temporaryPassword: tempPassword };
  }

  /**
   * Self password change
   */
  static async changePassword(env, authUser, currentPassword, newPassword, meta) {
    const { ipAddress, userAgent } = meta;

    if (!currentPassword || !newPassword) {
      throw new UserDomainError("Current password and new password are required.", 400);
    }

    const storedUser = await UserRepository.findById(env.DB, authUser.id);
    if (!storedUser) {
      throw new UserDomainError("User not found.", 404);
    }

    const isCurrentValid = await verifyPassword(currentPassword, storedUser.password_hash);
    if (!isCurrentValid) {
      await logAudit(env, {
        actingUserId: authUser.id,
        actingUsername: authUser.username,
        targetUserId: authUser.id,
        action: "user.password_change",
        resourceType: "user",
        status: "FAILURE",
        reason: "Incorrect current password",
        ipAddress,
        userAgent
      });
      throw new UserDomainError("Incorrect current password.", 400);
    }

    if (currentPassword === newPassword) {
      throw new UserDomainError("New password cannot be the same as the current password.", 400);
    }

    const complexityCheck = validatePasswordComplexity(newPassword);
    if (!complexityCheck.isValid) {
      throw new UserDomainError(complexityCheck.message, 400);
    }

    const newHash = await hashPassword(newPassword);
    await UserRepository.updatePassword(env.DB, authUser.id, newHash, false);

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      targetUserId: authUser.id,
      action: "user.password_change",
      resourceType: "user",
      resourceId: authUser.id,
      status: "SUCCESS",
      ipAddress,
      userAgent
    });

    return { requires_login: true };
  }

  /**
   * Get user profile
   */
  static async getProfile(env, authUser, authPermissions) {
    const user = await UserRepository.findById(env.DB, authUser.id);
    if (!user) {
      throw new UserDomainError("User not found.", 404);
    }
    return mapUserToDTO(user, { permissions: authPermissions });
  }

  /**
   * Update profile display name
   */
  static async updateProfile(env, authUser, displayName, meta) {
    const { ipAddress, userAgent } = meta;

    if (!displayName?.trim()) {
      throw new UserDomainError("Display name is required.", 400);
    }

    const updatedUser = await UserRepository.update(env.DB, authUser.id, {
      displayName: displayName.trim()
    });

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      targetUserId: authUser.id,
      action: "user.profile_update",
      resourceType: "user",
      resourceId: authUser.id,
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: { displayName: displayName.trim() }
    });

    return mapUserToDTO(updatedUser);
  }

  /**
   * Unlock user account
   */
  static async unlockUser(env, authUser, id, meta) {
    const { ipAddress, userAgent } = meta;

    const user = await UserRepository.findById(env.DB, id);
    if (!user) {
      throw new UserDomainError("User not found.", 404);
    }

    if (!authUser.is_super_admin) {
      if (id !== authUser.id && !(await isStrictlyLessPrivileged(env, user.role_id, authUser.role_id))) {
        throw new UserDomainError("Access denied. You do not have permission to unlock this user's account.", 403);
      }
    }

    const nowMs = Date.now();
    const isLocked = user.locked_until ? (new Date(user.locked_until).getTime() > nowMs) : false;

    await UserRepository.unlockUser(env.DB, id);

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      targetUserId: user.id,
      targetRoleId: user.role_id,
      action: "login.unlock.admin",
      resourceType: "user",
      resourceId: String(user.id),
      status: "SUCCESS",
      reason: "Administrator manually unlocked user account",
      ipAddress: ipAddress || "127.0.0.1",
      userAgent,
      details: {
        unlocked_by: authUser.username,
        target_username: user.username,
        was_locked: isLocked,
        previous_failed_attempts: user.failed_login_attempts || 0
      }
    });

    return {
      id: user.id,
      username: user.username,
      is_locked: false,
      failed_login_attempts: 0,
      locked_until: null
    };
  }
}

import { RoleRepository } from "../repositories/role-repository.js";
import { mapRoleToDTO } from "./role-mapper.js";
import { isStrictlyLessPrivileged } from "../utils/auth.js";
import { logAudit } from "../utils/audit.js";

export const SYSTEM_PERMISSIONS = [
  { key: "dashboard.view", group: "Dashboard", description: "View dashboard widgets and charts" },
  { key: "vehicles.view", group: "Vehicles", description: "View vehicles inventory" },
  { key: "vehicles.create", group: "Vehicles", description: "Add new vehicles" },
  { key: "vehicles.edit", group: "Vehicles", description: "Edit vehicle details" },
  { key: "vehicles.delete", group: "Vehicles", description: "Delete vehicles" },
  { key: "vehicles.publish", group: "Vehicles", description: "Publish or unpublish vehicles" },
  { key: "settings.view", group: "Settings", description: "View system settings" },
  { key: "settings.edit", group: "Settings", description: "Modify system settings" },
  { key: "locations.manage", group: "Locations", description: "Manage business locations and contact numbers" },
  { key: "users.manage", group: "Users", description: "Manage administrative users" },
  { key: "mfa.manage", group: "Users", description: "Manage user Multi-Factor Authentication (reset and enforce MFA)" },
  { key: "roles.manage", group: "Roles", description: "Manage roles and permissions" },
  { key: "reports.accounting.view", group: "Reports", description: "View future accounting reports" },
  { key: "audit.view", group: "Audit Logs", description: "View security audit logs" }
];

export class RoleDomainError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = "RoleDomainError";
    this.status = status;
    this.code = code;
  }
}

export class RoleService {
  /**
   * List system permissions
   */
  static listPermissions() {
    return SYSTEM_PERMISSIONS;
  }

  /**
   * List viewable roles for acting user
   */
  static async listRoles(env, authUser) {
    const list = await RoleRepository.findAll(env.DB);

    let viewableRoles = list;
    if (!authUser.is_super_admin) {
      const filtered = [];
      for (const r of list) {
        if (await isStrictlyLessPrivileged(env, r.id, authUser.role_id)) {
          filtered.push(r);
        }
      }
      viewableRoles = filtered;
    }

    const enriched = [];
    for (const role of viewableRoles) {
      const permissions_count = await RoleRepository.getPermissionsCount(env.DB, role.id);
      const users_count = await RoleRepository.getUsersCount(env.DB, role.id);
      enriched.push(mapRoleToDTO(role, { permissions_count, users_count }));
    }

    return enriched;
  }

  /**
   * Get single role by ID
   */
  static async getRole(env, authUser, id) {
    if (!authUser.is_super_admin && !(await isStrictlyLessPrivileged(env, id, authUser.role_id))) {
      throw new RoleDomainError("Access denied. You do not have permission to view this role.", 403);
    }

    const role = await RoleRepository.findById(env.DB, id);
    if (!role) {
      throw new RoleDomainError("Role not found.", 404);
    }

    const permissions = await RoleRepository.findPermissionsByRoleId(env.DB, id);
    return mapRoleToDTO(role, { permissions });
  }

  /**
   * Create role
   */
  static async createRole(env, authUser, body, meta, authPermissions = []) {
    const { ipAddress, userAgent } = meta;
    const name = body.name?.trim();
    const description = body.description?.trim();
    const permissions = body.permissions || [];
    const mfaRequired = body.mfa_required === true || body.mfa_required === 1 || body.mfa_required === "1";

    if (!name) {
      throw new RoleDomainError("Role name is required.", 400);
    }

    if (!authUser.is_super_admin && Array.isArray(permissions)) {
      const unpossessed = permissions.filter(p => !authPermissions.includes(p));
      if (unpossessed.length > 0) {
        await logAudit(env, {
          actingUserId: authUser.id,
          actingUsername: authUser.username,
          action: "security.privilege_escalation_attempt",
          resourceType: "role",
          status: "FAILURE",
          reason: "Attempted to grant permissions not possessed by caller",
          ipAddress,
          userAgent
        });
        throw new RoleDomainError("Access denied. You cannot grant permissions that your own role does not possess.", 403);
      }
    }

    const existing = await RoleRepository.findByName(env.DB, name);
    if (existing) {
      throw new RoleDomainError("A role with this name already exists.", 409);
    }

    const createdRole = await RoleRepository.createRole(env.DB, {
      name,
      description,
      mfaRequired
    });

    const validKeys = SYSTEM_PERMISSIONS.map(p => p.key);
    await RoleRepository.setRolePermissions(env.DB, createdRole.id, permissions, validKeys);

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      targetRoleId: createdRole.id,
      action: "role.create",
      resourceType: "role",
      resourceId: createdRole.id,
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: { name, permissions, mfa_required: mfaRequired }
    });

    if (mfaRequired) {
      await logAudit(env, {
        actingUserId: authUser.id,
        actingUsername: authUser.username,
        targetRoleId: createdRole.id,
        action: "role.mfa_policy_enabled",
        resourceType: "role",
        resourceId: createdRole.id,
        status: "SUCCESS",
        ipAddress,
        userAgent,
        details: { roleName: name }
      });
    }

    return mapRoleToDTO(createdRole, { permissions });
  }

  /**
   * Update role
   */
  static async updateRole(env, authUser, id, body, meta, authPermissions = []) {
    const { ipAddress, userAgent } = meta;

    if (!authUser.is_super_admin && !(await isStrictlyLessPrivileged(env, id, authUser.role_id))) {
      await logAudit(env, {
        actingUserId: authUser.id,
        actingUsername: authUser.username,
        targetRoleId: id,
        action: "security.privilege_escalation_attempt",
        resourceType: "role",
        status: "FAILURE",
        reason: "Attempted to modify role of equal or higher privilege",
        ipAddress,
        userAgent
      });
      throw new RoleDomainError("Access denied. You can only modify roles that are strictly less privileged than your own role.", 403);
    }

    const role = await RoleRepository.findById(env.DB, id);
    if (!role) {
      throw new RoleDomainError("Role not found.", 404);
    }

    const name = body.name?.trim();
    const description = body.description?.trim();
    const permissions = body.permissions;
    const oldMfaRequired = role.mfa_required === 1;
    let newMfaRequired = oldMfaRequired;

    if (body.mfa_required !== undefined) {
      newMfaRequired = body.mfa_required === true || body.mfa_required === 1 || body.mfa_required === "1";
    }

    if (!name) {
      throw new RoleDomainError("Role name is required.", 400);
    }

    if (!authUser.is_super_admin && Array.isArray(permissions)) {
      const unpossessed = permissions.filter(p => !authPermissions.includes(p));
      if (unpossessed.length > 0) {
        await logAudit(env, {
          actingUserId: authUser.id,
          actingUsername: authUser.username,
          targetRoleId: id,
          action: "security.privilege_escalation_attempt",
          resourceType: "role",
          status: "FAILURE",
          reason: "Attempted to grant unpossessed permissions",
          ipAddress,
          userAgent
        });
        throw new RoleDomainError("Access denied. You cannot grant permissions that your own role does not possess.", 403);
      }
    }

    const existing = await RoleRepository.findByName(env.DB, name, id);
    if (existing) {
      throw new RoleDomainError("Another role with this name already exists.", 409);
    }

    const updatedRole = await RoleRepository.updateRole(env.DB, id, {
      name,
      description,
      mfaRequired: newMfaRequired
    });

    if (oldMfaRequired !== newMfaRequired) {
      const policyAction = newMfaRequired ? "role.mfa_policy_enabled" : "role.mfa_policy_disabled";
      await logAudit(env, {
        actingUserId: authUser.id,
        actingUsername: authUser.username,
        targetRoleId: id,
        action: policyAction,
        resourceType: "role",
        resourceId: id,
        status: "SUCCESS",
        ipAddress,
        userAgent,
        details: { roleName: name, mfa_required: newMfaRequired }
      });

      await RoleRepository.invalidateUserTokensByRoleId(env.DB, id);
    }

    let updatedPermissions = permissions;
    if (permissions !== undefined) {
      const validKeys = SYSTEM_PERMISSIONS.map(p => p.key);
      await RoleRepository.setRolePermissions(env.DB, id, permissions, validKeys);
      await RoleRepository.invalidateUserTokensByRoleId(env.DB, id);
    } else {
      updatedPermissions = await RoleRepository.findPermissionsByRoleId(env.DB, id);
    }

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      targetRoleId: id,
      action: "role.update",
      resourceType: "role",
      resourceId: id,
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: { name, description, permissions }
    });

    return mapRoleToDTO(updatedRole, { permissions: updatedPermissions });
  }

  /**
   * Delete role
   */
  static async deleteRole(env, authUser, id, meta) {
    const { ipAddress, userAgent } = meta;

    const role = await RoleRepository.findById(env.DB, id);
    if (!role) {
      throw new RoleDomainError("Role not found.", 404);
    }

    if (role.is_system_role === 1 || role.system_role_key === "SUPER_ADMIN") {
      await logAudit(env, {
        actingUserId: authUser.id,
        actingUsername: authUser.username,
        targetRoleId: id,
        action: "role.delete",
        resourceType: "role",
        status: "FAILURE",
        reason: "System roles cannot be deleted.",
        ipAddress,
        userAgent
      });
      throw new RoleDomainError("System roles (such as Super Administrator) are immutable and cannot be deleted.", 400);
    }

    if (!authUser.is_super_admin && !(await isStrictlyLessPrivileged(env, id, authUser.role_id))) {
      await logAudit(env, {
        actingUserId: authUser.id,
        actingUsername: authUser.username,
        targetRoleId: id,
        action: "security.privilege_escalation_attempt",
        resourceType: "role",
        status: "FAILURE",
        reason: "Attempted to delete role of equal or higher privilege",
        ipAddress,
        userAgent
      });
      throw new RoleDomainError("Access denied. You can only delete roles that are strictly less privileged than your own role.", 403);
    }

    const userCount = await RoleRepository.getUsersCount(env.DB, id);
    if (userCount > 0) {
      throw new RoleDomainError("The role cannot be deleted because it is currently assigned to one or more users.", 400);
    }

    await RoleRepository.deleteRole(env.DB, id);

    await logAudit(env, {
      actingUserId: authUser.id,
      actingUsername: authUser.username,
      targetRoleId: id,
      action: "role.delete",
      resourceType: "role",
      resourceId: id,
      status: "SUCCESS",
      ipAddress,
      userAgent,
      details: { deletedRoleName: role.name }
    });
  }
}

/**
 * Administrative Lockout Prevention Utility
 */

/**
 * Checks if performing an action (delete, deactivate, or role re-assignment)
 * on targetUserId would leave zero active Super Administrators in the system.
 */
export async function wouldCauseSuperAdminLockout(env, targetUserId, newIsActive = null, newRoleId = null) {
    if (!env || !env.DB) return false;

    // Fetch target user's current role and status
    const targetUser = await env.DB
        .prepare(`
            SELECT u.id, u.is_active, r.id as role_id, r.is_system_role, r.system_role_key
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = ?
            LIMIT 1
        `)
        .bind(targetUserId)
        .first();

    if (!targetUser) return false;

    const isTargetSuperAdmin = (targetUser.is_active === 1 || targetUser.is_active === true) && 
        (targetUser.is_system_role === 1 || targetUser.system_role_key === "SUPER_ADMIN");

    // If target user is not currently an active Super Admin, lockout is not at risk from this operation
    if (!isTargetSuperAdmin) return false;

    // Evaluate if the intended operation revokes their Super Admin status
    let WillRemainSuperAdmin = true;

    if (newIsActive !== null && (newIsActive === 0 || newIsActive === false || newIsActive === "0")) {
        WillRemainSuperAdmin = false;
    }

    if (newRoleId !== null && parseInt(newRoleId) !== targetUser.role_id) {
        // Check if the new role is ALSO a Super Admin role
        const newRole = await env.DB
            .prepare(`SELECT is_system_role, system_role_key FROM roles WHERE id = ? LIMIT 1`)
            .bind(newRoleId)
            .first();

        if (!newRole || (newRole.is_system_role !== 1 && newRole.system_role_key !== "SUPER_ADMIN")) {
            WillRemainSuperAdmin = false;
        }
    }

    // If the operation is deletion (newIsActive === null && newRoleId === null), WillRemainSuperAdmin is false
    if (newIsActive === null && newRoleId === null) {
        WillRemainSuperAdmin = false;
    }

    // If they will remain active Super Admin, no lockout occurs
    if (WillRemainSuperAdmin) return false;

    // Otherwise, count remaining active Super Administrators excluding targetUserId
    const activeSuperAdminsCount = await env.DB
        .prepare(`
            SELECT COUNT(*) as count
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.is_active = 1
              AND (r.is_system_role = 1 OR r.system_role_key = 'SUPER_ADMIN')
              AND u.id != ?
        `)
        .bind(targetUserId)
        .first();

    const remainingCount = activeSuperAdminsCount?.count || 0;
    
    // Lockout occurs if 0 active Super Admins will remain
    return remainingCount < 1;
}

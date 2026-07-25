-- Migration 0016: Ensure Super Administrator role flags are correctly set
PRAGMA foreign_keys = ON;

UPDATE roles 
SET is_system_role = 1, 
    system_role_key = 'SUPER_ADMIN',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1 OR LOWER(name) = 'super administrator' OR system_role_key = 'SUPER_ADMIN';

-- Ensure non-Super Admin roles (like 'Admin' or 'Manager') are NOT marked as system roles
UPDATE roles
SET is_system_role = 0,
    system_role_key = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE id != 1 AND LOWER(name) != 'super administrator' AND (system_role_key IS NULL OR system_role_key != 'SUPER_ADMIN');

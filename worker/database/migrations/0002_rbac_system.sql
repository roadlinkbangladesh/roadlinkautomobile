-- =============================================================================
-- Roadlink Automobiles
-- Cloudflare D1 Database Migration: 0002_rbac_system.sql
-- Description: Sets up the RBAC roles and permissions tables,
--              seeds initial permissions and roles, and migrates
--              existing users to reference role_id.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Create Role Permissions Table (Option A)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_key TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_key),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 3. Seed Roles
INSERT OR IGNORE INTO roles (id, name, description, created_at, updated_at) VALUES 
(1, 'Super Administrator', 'Super Administrator with full access to all system modules, settings, user, and role management.', '2026-07-20T18:00:00.000Z', '2026-07-20T18:00:00.000Z'),
(2, 'Manager', 'Store Manager with operational permissions to manage vehicles and view dashboard and settings.', '2026-07-20T18:00:00.000Z', '2026-07-20T18:00:00.000Z');

-- 4. Seed Permissions for Super Administrator
INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES 
(1, 'dashboard.view'),
(1, 'vehicles.view'),
(1, 'vehicles.create'),
(1, 'vehicles.edit'),
(1, 'vehicles.delete'),
(1, 'vehicles.publish'),
(1, 'settings.view'),
(1, 'settings.edit'),
(1, 'users.manage'),
(1, 'roles.manage'),
(1, 'reports.accounting.view');

-- 5. Seed Permissions for Manager
INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES 
(2, 'dashboard.view'),
(2, 'vehicles.view'),
(2, 'vehicles.create'),
(2, 'vehicles.edit'),
(2, 'vehicles.publish'),
(2, 'settings.view');

-- 6. Add role_id Column to Users
ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id);

-- 7. Migrate Existing Users
UPDATE users SET role_id = 1 WHERE role = 'admin';
UPDATE users SET role_id = 2 WHERE role = 'manager';

-- 8. Default fallback for users without matching roles
UPDATE users SET role_id = 2 WHERE role_id IS NULL;

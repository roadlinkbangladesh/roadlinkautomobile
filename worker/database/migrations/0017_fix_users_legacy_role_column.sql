-- Migration: 0017_fix_users_legacy_role_column.sql
-- Description: Rebuild users table to drop obsolete legacy 'role' column and CHECK(role IN ('admin', 'manager')) constraints.
-- This ensures full support for custom RBAC roles without SQLite CHECK constraint failures on user creation.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS _users_clean (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1)),
    token_version INTEGER NOT NULL DEFAULT 1,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    last_failed_login_at TEXT,
    locked_until TEXT
);

INSERT OR IGNORE INTO _users_clean (
    id, username, password_hash, display_name, role_id, is_active, last_login_at, created_at, updated_at, must_change_password, token_version, failed_login_attempts, last_failed_login_at, locked_until
)
SELECT 
    id, username, password_hash, display_name, COALESCE(role_id, 1), is_active, last_login_at, created_at, updated_at, COALESCE(must_change_password, 0), COALESCE(token_version, 1), COALESCE(failed_login_attempts, 0), last_failed_login_at, locked_until
FROM users;

DROP TABLE IF EXISTS users;

ALTER TABLE _users_clean RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_locked ON users(locked_until);

PRAGMA foreign_keys = ON;

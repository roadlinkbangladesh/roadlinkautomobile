-- =============================================================================
-- Migration 0019: Add Multi-Factor Authentication (MFA / TOTP) Support
-- =============================================================================

-- 1. Add MFA state columns to users table
ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0 CHECK(mfa_enabled IN (0,1));
ALTER TABLE users ADD COLUMN mfa_secret_encrypted TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN mfa_enrolled_at TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN mfa_last_used_at TEXT DEFAULT NULL;

-- 2. Create mfa_recovery_codes table for hashed single-use recovery codes
CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    is_used INTEGER NOT NULL DEFAULT 0 CHECK(is_used IN (0,1)),
    used_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_user ON mfa_recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_unused ON mfa_recovery_codes(user_id, is_used);

-- 3. Add permission for MFA enforcement and management to system roles
INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
SELECT id, 'mfa.manage' FROM roles WHERE name = 'Super Admin' OR name = 'Super Administrator' OR system_role_key = 'SUPER_ADMIN';

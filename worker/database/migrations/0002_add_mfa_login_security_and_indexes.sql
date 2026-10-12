-- Migration: 0002_add_mfa_login_security_and_indexes.sql
-- Description: Applies schema enhancements to Cloudflare D1 production database:
--   1. Creates mfa_recovery_codes table for backup MFA codes
--   2. Adds MFA and security columns to users table
--   3. Adds mfa_required to roles table
--   4. Adds show_sold_vehicles to settings table (if not already added)
--   5. Adds composite indexes for query performance

-- 1. Create mfa_recovery_codes table
CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  is_used INTEGER NOT NULL DEFAULT 0 CHECK(is_used IN (0,1)),
  used_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes for MFA recovery codes
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_unused ON mfa_recovery_codes(user_id, is_used);
CREATE INDEX IF NOT EXISTS idx_mfa_recovery_user ON mfa_recovery_codes(user_id);

-- 3. Composite indexes for high-frequency inventory queries
CREATE INDEX IF NOT EXISTS idx_vehicles_published_status ON vehicles(is_published, status, archived_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_featured ON vehicles(is_featured, archived_at, featured_position);
CREATE INDEX IF NOT EXISTS idx_vehicle_status_archived ON vehicles(status, archived_at);

-- 4. User security & MFA columns (SQLite ALTER TABLE)
-- Note: If these columns already exist in your D1 database, D1 will report duplicate column errors.
-- Run individual ALTER TABLE statements as needed:
-- ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN last_failed_login_at TEXT;
-- ALTER TABLE users ADD COLUMN locked_until TEXT;
-- ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0 CHECK(mfa_enabled IN (0,1));
-- ALTER TABLE users ADD COLUMN mfa_enforced INTEGER NOT NULL DEFAULT 0 CHECK(mfa_enforced IN (0,1));
-- ALTER TABLE users ADD COLUMN mfa_secret_encrypted TEXT DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN mfa_enrolled_at TEXT DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN mfa_last_used_at TEXT DEFAULT NULL;
-- ALTER TABLE roles ADD COLUMN mfa_required INTEGER DEFAULT 0 CHECK(mfa_required IN (0,1));
-- ALTER TABLE settings ADD COLUMN show_sold_vehicles INTEGER NOT NULL DEFAULT 0;

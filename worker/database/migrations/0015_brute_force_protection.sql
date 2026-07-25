-- Migration 0015: Brute-Force Protection & Progressive Account Lockout

-- 1. Extend users table with lockout tracking fields
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_failed_login_at TEXT;
ALTER TABLE users ADD COLUMN locked_until TEXT;

-- 2. Create login_security table for IP-based lockout tracking
CREATE TABLE IF NOT EXISTS login_security (
    ip_address TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT NOT NULL,
    locked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_security_locked ON login_security(locked_until);

-- 3. Register brute force protection settings in platform_configuration
INSERT OR IGNORE INTO platform_configuration (key, value, dataType, description, updatedAt)
VALUES 
('max_failed_login_attempts', '5', 'number', 'Maximum failed login attempts allowed before temporary lockout', CURRENT_TIMESTAMP),
('lockout_duration_minutes', '30', 'number', 'Lockout duration in minutes after exceeding max failed login attempts', CURRENT_TIMESTAMP);

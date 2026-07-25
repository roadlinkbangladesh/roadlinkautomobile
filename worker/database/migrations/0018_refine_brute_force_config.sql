-- Migration 0018: Separate Account and IP Lockout Configuration Settings

INSERT OR REPLACE INTO platform_configuration (key, value, dataType, description, updatedAt)
VALUES 
('max_failed_login_attempts', '5', 'number', 'Maximum failed login attempts allowed before account lockout', CURRENT_TIMESTAMP),
('account_lockout_duration_minutes', '15', 'number', 'Account lockout duration in minutes', CURRENT_TIMESTAMP),
('max_ip_failed_attempts', '15', 'number', 'Maximum failed attempts from a single IP before IP lockout', CURRENT_TIMESTAMP),
('ip_lockout_duration_minutes', '15', 'number', 'IP lockout duration in minutes', CURRENT_TIMESTAMP),
('lockout_duration_minutes', '15', 'number', 'Legacy fallback lockout duration in minutes', CURRENT_TIMESTAMP);

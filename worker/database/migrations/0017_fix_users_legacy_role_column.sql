-- Migration: 0017_fix_users_legacy_role_column.sql
-- Description: Drop legacy 'role' column from users table if present from earlier non-RBAC schemas
-- so that user insertions succeed without NOT NULL constraint failures on users.role.

ALTER TABLE users DROP COLUMN role;

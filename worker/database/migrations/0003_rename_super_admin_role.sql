-- =============================================================================
-- Roadlink Automobiles
-- Cloudflare D1 Database Migration: 0003_rename_super_admin_role.sql
-- Description: Renames Role 1 from 'Admin' to 'Super Administrator'
-- =============================================================================

PRAGMA foreign_keys = ON;

UPDATE roles SET name = 'Super Administrator', updated_at = CURRENT_TIMESTAMP WHERE id = 1;

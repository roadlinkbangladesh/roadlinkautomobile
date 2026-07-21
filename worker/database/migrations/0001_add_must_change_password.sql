-- =============================================================================
-- Migration: Add must_change_password column to users table
-- Target Platform: SQLite / Cloudflare D1
-- =============================================================================

-- SQLite / D1 allows adding a new column using ALTER TABLE.
-- SQLite does not have a native BOOLEAN type, so we use INTEGER with a CHECK constraint (0 or 1).
-- The default value is set to 0 (representing FALSE).

ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1));

-- =============================================================================
-- Migration 0020: Add Role-Based MFA Security Policy
-- =============================================================================

-- Add mfa_required policy column to roles table
ALTER TABLE roles ADD COLUMN mfa_required INTEGER DEFAULT 0 CHECK(mfa_required IN (0,1));

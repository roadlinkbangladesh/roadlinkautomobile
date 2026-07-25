-- Migration 0014: Session Token Versioning for Immediate Session Revocation
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;

-- Migration 0012: Add stock_banner_url column to settings
ALTER TABLE settings ADD COLUMN stock_banner_url TEXT;

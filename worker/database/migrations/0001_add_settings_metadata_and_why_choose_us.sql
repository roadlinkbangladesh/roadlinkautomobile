-- Migration: 0001_add_settings_metadata_and_why_choose_us.sql
-- Add website metadata, OG/Twitter social sharing, Why Choose Us, and public website URL columns to settings table

ALTER TABLE settings ADD COLUMN why_choose_us TEXT;
ALTER TABLE settings ADD COLUMN website_title TEXT;
ALTER TABLE settings ADD COLUMN website_description TEXT;
ALTER TABLE settings ADD COLUMN og_title TEXT;
ALTER TABLE settings ADD COLUMN og_description TEXT;
ALTER TABLE settings ADD COLUMN og_image_url TEXT;
ALTER TABLE settings ADD COLUMN twitter_title TEXT;
ALTER TABLE settings ADD COLUMN twitter_description TEXT;
ALTER TABLE settings ADD COLUMN twitter_image_url TEXT;
ALTER TABLE settings ADD COLUMN public_website_url TEXT DEFAULT '../';

-- Migration 0008: Company Slug & Media Storage Hierarchy Normalization

-- 1. Ensure company_slug exists in settings table
ALTER TABLE settings ADD COLUMN company_slug TEXT DEFAULT 'roadlink';

-- 2. Populate company_slug for existing default row if missing
UPDATE settings
SET company_slug = 'roadlink'
WHERE id = 1 AND (company_slug IS NULL OR TRIM(company_slug) = '');

-- 3. Normalize vehicle_images table to store ONLY object keys (strip absolute or relative API prefixes)
UPDATE vehicle_images
SET image_url = REPLACE(REPLACE(REPLACE(image_url, 'https://roadlinkautomobile.pages.dev/api/v1/public/files/', ''), '/api/v1/public/files/', ''), '/api/v1/public/images/', '')
WHERE image_url LIKE '%/api/v1/public/%';

-- 4. Normalize vehicles table auction_sheet_url to store ONLY object keys
UPDATE vehicles
SET auction_sheet_url = REPLACE(REPLACE(REPLACE(auction_sheet_url, 'https://roadlinkautomobile.pages.dev/api/v1/public/files/', ''), '/api/v1/public/files/', ''), '/api/v1/public/images/', '')
WHERE auction_sheet_url LIKE '%/api/v1/public/%';

-- Migration 0006: Generalize file storage by cleaning up absolute/prefixed URLs to clean object keys

-- Strip legacy API path prefixes from vehicle_images.image_url
UPDATE vehicle_images
SET image_url = REPLACE(image_url, '/api/v1/public/images/', '')
WHERE image_url LIKE '/api/v1/public/images/%';

UPDATE vehicle_images
SET image_url = REPLACE(image_url, '/api/v1/public/files/', '')
WHERE image_url LIKE '/api/v1/public/files/%';

-- Strip legacy API path prefixes from vehicles.auction_sheet_url
UPDATE vehicles
SET auction_sheet_url = REPLACE(auction_sheet_url, '/api/v1/public/images/', '')
WHERE auction_sheet_url LIKE '/api/v1/public/images/%';

UPDATE vehicles
SET auction_sheet_url = REPLACE(auction_sheet_url, '/api/v1/public/files/', '')
WHERE auction_sheet_url LIKE '/api/v1/public/files/%';

-- Disable auction_sheet_available if auction_sheet_url is empty
UPDATE vehicles
SET auction_sheet_available = 0
WHERE auction_sheet_url IS NULL OR TRIM(auction_sheet_url) = '';

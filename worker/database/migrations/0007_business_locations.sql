-- Migration 0007: Dedicated Business Locations Domain Model & Phone Numbers

-- 1. Create business_locations table
CREATE TABLE IF NOT EXISTS business_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    address TEXT NOT NULL,
    map_url TEXT,
    is_visible INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT DEFAULT NULL
);

-- 2. Create business_location_phones table
CREATE TABLE IF NOT EXISTS business_location_phones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_slug ON business_locations(slug);
CREATE INDEX IF NOT EXISTS idx_locations_visible_order ON business_locations(is_visible, display_order);
CREATE INDEX IF NOT EXISTS idx_location_phones_loc_order ON business_location_phones(location_id, display_order);

-- 3. Data Migration from existing Settings table if present
INSERT OR IGNORE INTO business_locations (
    id, slug, title, address, map_url, is_visible, is_default, display_order, created_at, updated_at
)
SELECT 
    1,
    'main-showroom',
    'Main Showroom',
    COALESCE(showroom_address, address, '169 (Level 2), Fakirerpool, Dhaka 1000, Bangladesh'),
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3652.336495143309!2d90.4143438!3d23.7354316!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755b85ee8d98d8d%3A0xc6cbfa8480db60b!2sFakirerpool%2C%20Dhaka%201000!5e0!3m2!1sen!2sbd!4v1715629124110!5m2!1sen!2sbd',
    COALESCE(show_showroom, 1),
    1,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM settings WHERE id = 1 AND (showroom_address IS NOT NULL OR address IS NOT NULL);

-- Migrate Showroom phone number
INSERT OR IGNORE INTO business_location_phones (location_id, phone_number, display_order)
SELECT 
    1,
    COALESCE(showroom_phone, phone, '+880 1311-503840'),
    1
FROM settings WHERE id = 1 AND (showroom_phone IS NOT NULL OR phone IS NOT NULL);

-- Migrate Corporate Office if corporate_address exists in settings and is non-empty
INSERT OR IGNORE INTO business_locations (
    slug, title, address, map_url, is_visible, is_default, display_order, created_at, updated_at
)
SELECT 
    'corporate-office',
    'Corporate Office',
    corporate_address,
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3652.0234!2d90.4021!3d23.7932!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755c7a0f1234567%3A0x9876543210abcdef!2sBanani%2C%20Dhaka%201213!5e0!3m2!1sen!2sbd!4v1620000000000',
    COALESCE(show_corporate, 0),
    0,
    2,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM settings WHERE id = 1 AND corporate_address IS NOT NULL AND TRIM(corporate_address) != '';

-- Migrate Corporate phone
INSERT OR IGNORE INTO business_location_phones (location_id, phone_number, display_order)
SELECT 
    (SELECT id FROM business_locations WHERE slug = 'corporate-office'),
    corporate_phone,
    1
FROM settings WHERE id = 1 AND corporate_address IS NOT NULL AND TRIM(corporate_address) != '' AND corporate_phone IS NOT NULL AND TRIM(corporate_phone) != '';

-- Fallback check: Ensure at least 1 default location exists
INSERT OR IGNORE INTO business_locations (
    id, slug, title, address, map_url, is_visible, is_default, display_order, created_at, updated_at
)
VALUES (
    1,
    'main-showroom',
    'Main Showroom',
    '169 (Level 2), Fakirerpool, Dhaka 1000, Bangladesh',
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3652.336495143309!2d90.4143438!3d23.7354316!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755b85ee8d98d8d%3A0xc6cbfa8480db60b!2sFakirerpool%2C%20Dhaka%201000!5e0!3m2!1sen!2sbd!4v1715629124110!5m2!1sen!2sbd',
    1,
    1,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO business_location_phones (location_id, phone_number, display_order)
SELECT 1, '+880 1311-503840', 1
WHERE NOT EXISTS (SELECT 1 FROM business_location_phones WHERE location_id = 1);

-- 4. Grant locations permission to admin roles
INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES (1, 'locations.manage'), (2, 'locations.manage');

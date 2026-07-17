-- =============================================================================
-- Roadlink Automobiles
-- Cloudflare D1 Seed Data
-- Version: 1.0.0
--
-- Execute after schema.sql
--
-- This script inserts:
--   • Initial application settings
--   • Initial administrator account
--
-- NOTE:
-- Replace PASSWORD_NOT_SET with a valid Argon2 password hash before first login.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- =============================================================================
-- SETTINGS
-- =============================================================================

INSERT OR IGNORE INTO settings (

    id,

    company_name,

    phone,
    whatsapp,
    email,

    address,

    facebook,
    youtube,

    seo_title_suffix,
    seo_default_keywords,
    seo_default_description,

    display_timezone,
    display_locale,

    default_currency,

    session_timeout_minutes,
    archive_retention_days,

    created_at,
    updated_at

)
VALUES (

    1,

    'Roadlink Automobiles',

    '+880 1311-503840',
    '8801311503840',
    'roadlinkbangladesh@gmail.com',

    '169 (Level 2), Fakirerpool, Dhaka 1000',

    'https://www.facebook.com/roadlinkautomobiles',
    'https://www.youtube.com/@roadlinkautomobiles9168',

    'Roadlink Automobiles',

    'Japanese cars, reconditioned cars, Dhaka car importer, Toyota Axio, Honda Vezel, Nissan X-Trail, Roadlink Automobiles Bangladesh',

    'Roadlink Automobiles - Importer and seller of high-quality reconditioned Japanese vehicles in Dhaka, Bangladesh. Explore our verified auction stock.',

    'Asia/Dhaka',

    'en-BD',

    'BDT',

    30,

    180,

    CURRENT_TIMESTAMP,

    CURRENT_TIMESTAMP

);

-- =============================================================================
-- DEFAULT ADMINISTRATOR
-- =============================================================================

INSERT OR IGNORE INTO users (

    username,

    password_hash,

    display_name,

    role,

    is_active,

    last_login_at,

    created_at,

    updated_at

)
VALUES (

    'admin',

    'PASSWORD_NOT_SET',

    'Administrator',

    'admin',

    1,

    NULL,

    CURRENT_TIMESTAMP,

    CURRENT_TIMESTAMP

);

-- =============================================================================
-- END
-- =============================================================================

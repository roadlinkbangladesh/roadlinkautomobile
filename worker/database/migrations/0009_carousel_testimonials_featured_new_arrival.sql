-- Migration 0009: Carousel Slides, Testimonials, Branding, Featured & New Arrival Settings

-- 1. Create Carousel Slides Table
CREATE TABLE IF NOT EXISTS carousel_slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT NOT NULL,
    heading TEXT NOT NULL,
    subheading TEXT,
    badge_text TEXT,
    display_order INTEGER NOT NULL DEFAULT 1,
    is_visible INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Create Testimonials Table
CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rating INTEGER NOT NULL DEFAULT 5,
    testimonial_text TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 1,
    is_visible INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 3. Add Company Branding & Featured Vehicles settings to settings table
ALTER TABLE settings ADD COLUMN company_logo_url TEXT;
ALTER TABLE settings ADD COLUMN favicon_url TEXT;
ALTER TABLE settings ADD COLUMN featured_vehicles_limit INTEGER NOT NULL DEFAULT 6;
ALTER TABLE settings ADD COLUMN show_sold_vehicles INTEGER NOT NULL DEFAULT 0;

-- 4. Add featured_position and is_new_arrival to vehicles table
ALTER TABLE vehicles ADD COLUMN featured_position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN is_new_arrival INTEGER NOT NULL DEFAULT 0;

-- 5. Seed initial default hero carousel slide if empty
INSERT INTO carousel_slides (image_url, heading, subheading, badge_text, display_order, is_visible, created_at, updated_at)
SELECT 'uploads/roadlink/carousel/hero_bg.jpg', 'PREMIUM JAPANESE AUTOMOBILES', 'Discover Bangladesh''s most trusted collection of reconditioned cars with genuine auction sheets and mileage verification.', 'JAPAN DIRECT IMPORTS', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM carousel_slides);

-- 6. Seed initial testimonials if empty
INSERT INTO testimonials (rating, testimonial_text, customer_name, display_order, is_visible, created_at, updated_at)
SELECT 5, 'Bought my Toyota Prius from Roadlink. The auction sheet was 100% genuine and verified on Japanese auction database. Highly professional team!', 'Tanvir Ahmed' || CHAR(10) || 'Business Executive', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM testimonials);

INSERT INTO testimonials (rating, testimonial_text, customer_name, display_order, is_visible, created_at, updated_at)
SELECT 5, 'Excellent service and complete transparency. They handled the customs clearance and registration seamlessly. Highly recommended!', 'Sarah Khan' || CHAR(10) || 'Architect', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM testimonials);

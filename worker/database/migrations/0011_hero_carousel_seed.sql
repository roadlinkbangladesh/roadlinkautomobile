-- Migration 0011: Seed Hero Carousel with exact public portal hero content

UPDATE carousel_slides
SET image_url = 'assets/hero.jpg',
    heading = 'Your Gateway to Premium <span>Japanese Cars</span> in Bangladesh',
    subheading = 'Roadlink Automobiles is Bangladesh''s premier importer and seller of premium Japanese reconditioned vehicles. We handpick, rigorously inspect, and deliver high-performance, showroom-condition vehicles with guaranteed auction grades and transparent mileage sheets.',
    badge_text = 'Verified Imports Direct From Japan'
WHERE id = 1;

INSERT INTO carousel_slides (image_url, heading, subheading, badge_text, display_order, is_visible, created_at, updated_at)
SELECT 'assets/hero.jpg', 'Your Gateway to Premium <span>Japanese Cars</span> in Bangladesh', 'Roadlink Automobiles is Bangladesh''s premier importer and seller of premium Japanese reconditioned vehicles. We handpick, rigorously inspect, and deliver high-performance, showroom-condition vehicles with guaranteed auction grades and transparent mileage sheets.', 'Verified Imports Direct From Japan', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM carousel_slides);

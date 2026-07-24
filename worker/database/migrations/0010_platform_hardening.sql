-- Migration 0010: Platform Hardening - Platform Configuration & Audit Logs Enhancements

-- 1. Create Platform Configuration Table
CREATE TABLE IF NOT EXISTS platform_configuration (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    dataType TEXT NOT NULL CHECK(dataType IN ('number', 'string', 'boolean', 'json')),
    description TEXT,
    updatedAt TEXT NOT NULL
);

-- 2. Seed Default Platform Policies (Backend-Only, Non-Exposed)
INSERT OR IGNORE INTO platform_configuration (key, value, dataType, description, updatedAt)
VALUES 
('archive_after_months', '12', 'number', 'Number of months after which sold vehicles are automatically archived', CURRENT_TIMESTAMP),
('max_vehicle_images', '20', 'number', 'Maximum number of images allowed per vehicle', CURRENT_TIMESTAMP),
('max_image_upload_mb', '5', 'number', 'Maximum allowed image file size in Megabytes', CURRENT_TIMESTAMP),
('max_image_width', '1920', 'number', 'Maximum target width for uploaded vehicle images in pixels', CURRENT_TIMESTAMP),
('image_quality', '85', 'number', 'Default target compression quality percentage for images', CURRENT_TIMESTAMP),
('max_auction_sheet_mb', '20', 'number', 'Maximum allowed PDF auction sheet file size in Megabytes', CURRENT_TIMESTAMP),
('orphan_cleanup_days', '7', 'number', 'Number of days unreferenced files remain in storage before permanent deletion', CURRENT_TIMESTAMP);

-- 3. Ensure vehicles table supports draft, available, incoming, reserved, sold, archived statuses
-- Note: SQLite does not restrict existing text status unless constrained. Indexing on status & archived_at
CREATE INDEX IF NOT EXISTS idx_vehicle_status_archived ON vehicles(status, archived_at);

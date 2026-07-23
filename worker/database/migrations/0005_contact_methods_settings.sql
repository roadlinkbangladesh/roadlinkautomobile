-- Migration 0005: Add multi-presence contact methods and visibility toggles to settings

ALTER TABLE settings ADD COLUMN showroom_address TEXT;
ALTER TABLE settings ADD COLUMN showroom_phone TEXT;
ALTER TABLE settings ADD COLUMN show_showroom INTEGER NOT NULL DEFAULT 1;

ALTER TABLE settings ADD COLUMN corporate_address TEXT;
ALTER TABLE settings ADD COLUMN corporate_phone TEXT;
ALTER TABLE settings ADD COLUMN show_corporate INTEGER NOT NULL DEFAULT 0;

ALTER TABLE settings ADD COLUMN contact_name TEXT;
ALTER TABLE settings ADD COLUMN contact_phone TEXT;
ALTER TABLE settings ADD COLUMN show_primary_contact INTEGER NOT NULL DEFAULT 0;

ALTER TABLE settings ADD COLUMN show_whatsapp INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN show_email INTEGER NOT NULL DEFAULT 1;

-- Backfill initial contact defaults if missing
UPDATE settings
SET showroom_address = COALESCE(showroom_address, address, '169 (Level 2), Fakirerpool, Dhaka 1000, Bangladesh'),
    showroom_phone = COALESCE(showroom_phone, phone, '+8801711223344'),
    corporate_address = COALESCE(corporate_address, 'House 42, Road 11, Block D, Banani, Dhaka 1213, Bangladesh'),
    corporate_phone = COALESCE(corporate_phone, '+8801711998877'),
    contact_name = COALESCE(contact_name, 'Sales Helpline / Managing Officer'),
    contact_phone = COALESCE(contact_phone, COALESCE(phone, '+8801711223344'))
WHERE id = 1;

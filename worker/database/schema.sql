-- =============================================================================
-- Roadlink Automobiles
-- Cloudflare D1 Database Schema
-- Version: 1.0.0
-- Canonical schema. All timestamps stored in UTC (ISO-8601).
-- =============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system_role INTEGER NOT NULL DEFAULT 0 CHECK(is_system_role IN (0,1)),
    system_role_key TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_key TEXT NOT NULL,
    PRIMARY KEY(role_id, permission_key),
    FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

CREATE TABLE IF NOT EXISTS settings (

    id INTEGER PRIMARY KEY CHECK(id = 1),
    company_name TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    facebook TEXT,
    youtube TEXT,
    display_timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    display_locale TEXT NOT NULL DEFAULT 'en-BD',
    default_currency TEXT NOT NULL DEFAULT 'BDT',
    session_timeout_minutes INTEGER NOT NULL DEFAULT 30 CHECK(session_timeout_minutes BETWEEN 5 AND 1440),
    archive_retention_days INTEGER NOT NULL DEFAULT 180 CHECK(archive_retention_days BETWEEN 1 AND 3650),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    seo_title_suffix TEXT,
    seo_default_keywords TEXT,
    seo_default_description TEXT,
    showroom_address TEXT,
    showroom_phone TEXT,
    show_showroom INTEGER NOT NULL DEFAULT 1 CHECK(show_showroom IN (0,1)),
    corporate_address TEXT,
    corporate_phone TEXT,
    show_corporate INTEGER NOT NULL DEFAULT 0 CHECK(show_corporate IN (0,1)),
    contact_name TEXT,
    contact_phone TEXT,
    show_primary_contact INTEGER NOT NULL DEFAULT 0 CHECK(show_primary_contact IN (0,1)),
    show_whatsapp INTEGER NOT NULL DEFAULT 1 CHECK(show_whatsapp IN (0,1)),
    show_email INTEGER NOT NULL DEFAULT 1 CHECK(show_email IN (0,1))
);

CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    stock_number TEXT NOT NULL UNIQUE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL CHECK(year >= 2010),
    status TEXT NOT NULL CHECK(status IN ('available','incoming','reserved','sold')),
    is_published INTEGER NOT NULL DEFAULT 0 CHECK(is_published IN (0,1)),
    is_featured INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0,1)),
    display_order INTEGER NOT NULL DEFAULT 0,
    grade TEXT,
    auction_grade TEXT,
    mileage INTEGER CHECK(mileage>=0),
    engine_cc INTEGER CHECK(engine_cc>=0),
    transmission TEXT,
    fuel TEXT,
    drive TEXT,
    body_type TEXT,
    exterior_color TEXT,
    interior_color TEXT,
    seats INTEGER CHECK(seats BETWEEN 1 AND 20),
    doors INTEGER CHECK(doors BETWEEN 1 AND 10),
    chassis_number TEXT,
    registration TEXT,
    steering TEXT,
    accident_history TEXT,
    purchase_price INTEGER CHECK(purchase_price>=0),
    price INTEGER NOT NULL CHECK(price>=0),
    currency TEXT NOT NULL DEFAULT 'BDT',
    negotiable INTEGER NOT NULL DEFAULT 0 CHECK(negotiable IN (0,1)),
    short_description TEXT,
    description TEXT,
    features TEXT,
    auction_sheet_available INTEGER NOT NULL DEFAULT 0 CHECK(auction_sheet_available IN (0,1)),
    auction_sheet_url TEXT,
    youtube_url TEXT,
    arrival_date TEXT,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicle_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_make ON vehicles(make);
CREATE INDEX IF NOT EXISTS idx_vehicle_year ON vehicles(year);
CREATE INDEX IF NOT EXISTS idx_vehicle_published ON vehicles(is_published);
CREATE INDEX IF NOT EXISTS idx_vehicle_featured ON vehicles(is_featured);
CREATE INDEX IF NOT EXISTS idx_vehicle_archived ON vehicles(archived_at);
CREATE INDEX IF NOT EXISTS idx_vehicle_display_order ON vehicles(display_order);
CREATE INDEX IF NOT EXISTS idx_vehicle_stock ON vehicles(stock_number);

CREATE TABLE IF NOT EXISTS vehicle_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    image_type TEXT NOT NULL CHECK(image_type IN ('exterior','interior','auction')),
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle ON vehicle_images(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_images_order ON vehicle_images(vehicle_id,display_order);
CREATE INDEX IF NOT EXISTS idx_vehicle_images_type ON vehicle_images(image_type);

CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    description TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity,entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    acting_user_id INTEGER,
    acting_username TEXT,
    target_user_id INTEGER,
    target_role_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    status TEXT NOT NULL,
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_acting_user ON audit_logs(acting_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);


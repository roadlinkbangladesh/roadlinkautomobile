-- =============================================================================
-- Roadlink Automobiles
-- Cloudflare D1 Production Database Schema Baseline
-- Authoritative Source of Truth: docs/sqlite_master_20260729.txt
-- =============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE activity_logs ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id INTEGER, description TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL );

CREATE TABLE audit_logs ( id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL, acting_user_id INTEGER, acting_username TEXT, target_user_id INTEGER, target_role_id INTEGER, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, status TEXT NOT NULL, reason TEXT, ip_address TEXT, user_agent TEXT, details TEXT, created_at TEXT NOT NULL );

CREATE TABLE business_location_phones ( id INTEGER PRIMARY KEY AUTOINCREMENT, location_id INTEGER NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE, phone_number TEXT NOT NULL, display_order INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );

CREATE TABLE business_locations ( id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, address TEXT NOT NULL, map_url TEXT, is_visible INTEGER NOT NULL DEFAULT 1, is_default INTEGER NOT NULL DEFAULT 0, display_order INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TEXT DEFAULT NULL , map_embed_url TEXT);

CREATE TABLE carousel_slides ( id INTEGER PRIMARY KEY AUTOINCREMENT, image_url TEXT NOT NULL, heading TEXT NOT NULL, subheading TEXT, badge_text TEXT, display_order INTEGER NOT NULL DEFAULT 1, is_visible INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL );

CREATE TABLE login_security ( ip_address TEXT PRIMARY KEY, failed_attempts INTEGER NOT NULL DEFAULT 0, last_attempt_at TEXT NOT NULL, locked_until TEXT );

CREATE TABLE mfa_recovery_codes ( id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, code_hash TEXT NOT NULL, is_used INTEGER NOT NULL DEFAULT 0 CHECK(is_used IN (0,1)), used_at TEXT DEFAULT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );

CREATE TABLE platform_configuration ( key TEXT PRIMARY KEY, value TEXT NOT NULL, dataType TEXT NOT NULL CHECK(dataType IN ('number', 'string', 'boolean', 'json')), description TEXT, updatedAt TEXT NOT NULL );

CREATE TABLE role_permissions ( role_id INTEGER NOT NULL, permission_key TEXT NOT NULL, PRIMARY KEY (role_id, permission_key), FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE );

CREATE TABLE roles ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL , is_system_role INTEGER DEFAULT 0 NOT NULL, system_role_key TEXT, mfa_required INTEGER DEFAULT 0 CHECK(mfa_required IN (0,1)));

CREATE TABLE settings ( id INTEGER PRIMARY KEY CHECK(id = 1), company_name TEXT NOT NULL, phone TEXT, whatsapp TEXT, email TEXT, address TEXT, facebook TEXT, youtube TEXT, display_timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka', display_locale TEXT NOT NULL DEFAULT 'en-BD', default_currency TEXT NOT NULL DEFAULT 'BDT', session_timeout_minutes INTEGER NOT NULL DEFAULT 30 CHECK(session_timeout_minutes BETWEEN 5 AND 1440), archive_retention_days INTEGER NOT NULL DEFAULT 180 CHECK(archive_retention_days BETWEEN 1 AND 3650), created_at TEXT NOT NULL, updated_at TEXT NOT NULL , seo_title_suffix TEXT, seo_default_keywords TEXT, seo_default_description TEXT, showroom_address TEXT, showroom_phone TEXT, show_showroom INTEGER NOT NULL DEFAULT 1, corporate_address TEXT, corporate_phone TEXT, show_corporate INTEGER NOT NULL DEFAULT 0, contact_name TEXT, contact_phone TEXT, show_primary_contact INTEGER NOT NULL DEFAULT 0, show_whatsapp INTEGER NOT NULL DEFAULT 1, show_email INTEGER NOT NULL DEFAULT 1, company_slug TEXT DEFAULT 'roadlink', company_logo_url TEXT, favicon_url TEXT, featured_vehicles_limit INTEGER NOT NULL DEFAULT 6, show_sold_vehicles INTEGER NOT NULL DEFAULT 0, stock_banner_url TEXT, why_choose_us TEXT, website_title TEXT, website_description TEXT, og_title TEXT, og_description TEXT, og_image_url TEXT, twitter_title TEXT, twitter_description TEXT, twitter_image_url TEXT, twitter_username TEXT, public_website_url TEXT DEFAULT '../');

CREATE TABLE testimonials ( id INTEGER PRIMARY KEY AUTOINCREMENT, rating INTEGER NOT NULL DEFAULT 5, testimonial_text TEXT NOT NULL, customer_name TEXT NOT NULL, display_order INTEGER NOT NULL DEFAULT 1, is_visible INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL );

CREATE TABLE users ( id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','manager')), is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL , must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1)), role_id INTEGER REFERENCES roles(id), token_version INTEGER NOT NULL DEFAULT 1, failed_login_attempts INTEGER NOT NULL DEFAULT 0, last_failed_login_at TEXT, locked_until TEXT, mfa_enabled INTEGER NOT NULL DEFAULT 0 CHECK(mfa_enabled IN (0,1)), mfa_secret_encrypted TEXT DEFAULT NULL, mfa_enrolled_at TEXT DEFAULT NULL, mfa_last_used_at TEXT DEFAULT NULL);

CREATE TABLE vehicle_images ( id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL, image_type TEXT NOT NULL CHECK(image_type IN ('exterior','interior','auction')), image_url TEXT NOT NULL, display_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE );

CREATE TABLE vehicles ( id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, stock_number TEXT NOT NULL UNIQUE, make TEXT NOT NULL, model TEXT NOT NULL, year INTEGER NOT NULL CHECK(year >= 2010), status TEXT NOT NULL CHECK(status IN ('available','incoming','reserved','sold')), is_published INTEGER NOT NULL DEFAULT 0 CHECK(is_published IN (0,1)), is_featured INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0,1)), display_order INTEGER NOT NULL DEFAULT 0, grade TEXT, auction_grade TEXT, mileage INTEGER CHECK(mileage>=0), engine_cc INTEGER CHECK(engine_cc>=0), transmission TEXT, fuel TEXT, drive TEXT, body_type TEXT, exterior_color TEXT, interior_color TEXT, seats INTEGER CHECK(seats BETWEEN 1 AND 20), doors INTEGER CHECK(doors BETWEEN 1 AND 10), chassis_number TEXT, registration TEXT, steering TEXT, accident_history TEXT, purchase_price INTEGER CHECK(purchase_price>=0), price INTEGER NOT NULL CHECK(price>=0), currency TEXT NOT NULL DEFAULT 'BDT', negotiable INTEGER NOT NULL DEFAULT 0 CHECK(negotiable IN (0,1)), short_description TEXT, description TEXT, features TEXT, auction_sheet_available INTEGER NOT NULL DEFAULT 0 CHECK(auction_sheet_available IN (0,1)), youtube_url TEXT, arrival_date TEXT, archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL , auction_sheet_url TEXT, featured_position INTEGER NOT NULL DEFAULT 0, is_new_arrival INTEGER NOT NULL DEFAULT 0);

CREATE INDEX idx_activity_created ON activity_logs(created_at);
CREATE INDEX idx_activity_entity ON activity_logs(entity,entity_id);
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_audit_logs_acting_user ON audit_logs(acting_user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_location_phones_loc_order ON business_location_phones(location_id, display_order);
CREATE INDEX idx_locations_slug ON business_locations(slug);
CREATE INDEX idx_locations_visible_order ON business_locations(is_visible, display_order);
CREATE INDEX idx_login_security_locked ON login_security(locked_until);
CREATE INDEX idx_mfa_recovery_unused ON mfa_recovery_codes(user_id, is_used);
CREATE INDEX idx_mfa_recovery_user ON mfa_recovery_codes(user_id);
CREATE UNIQUE INDEX idx_roles_system_role_key ON roles(system_role_key) WHERE system_role_key IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_vehicle_archived ON vehicles(archived_at);
CREATE INDEX idx_vehicle_display_order ON vehicles(display_order);
CREATE INDEX idx_vehicle_featured ON vehicles(is_featured);
CREATE INDEX idx_vehicle_images_order ON vehicle_images(vehicle_id,display_order);
CREATE INDEX idx_vehicle_images_type ON vehicle_images(image_type);
CREATE INDEX idx_vehicle_images_vehicle ON vehicle_images(vehicle_id);
CREATE INDEX idx_vehicle_make ON vehicles(make);
CREATE INDEX idx_vehicle_published ON vehicles(is_published);
CREATE INDEX idx_vehicle_status ON vehicles(status);
CREATE INDEX idx_vehicle_status_archived ON vehicles(status, archived_at);
CREATE INDEX idx_vehicle_stock ON vehicles(stock_number);
CREATE INDEX idx_vehicle_year ON vehicles(year);
CREATE INDEX IF NOT EXISTS idx_vehicles_published_status ON vehicles(is_published, status, archived_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_featured ON vehicles(is_featured, archived_at, featured_position);

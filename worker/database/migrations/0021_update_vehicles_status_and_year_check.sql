-- Migration 0021: Update vehicles table CHECK constraints to support draft & archived statuses and older vehicle years (>= 1900)

PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS _vehicles_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    stock_number TEXT NOT NULL UNIQUE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL CHECK(year >= 1900),
    status TEXT NOT NULL CHECK(status IN ('draft','available','incoming','reserved','sold','archived')),
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
    updated_at TEXT NOT NULL,
    featured_position INTEGER NOT NULL DEFAULT 0,
    is_new_arrival INTEGER NOT NULL DEFAULT 0
);

INSERT INTO _vehicles_new (
    id, slug, stock_number, make, model, year, status, is_published, is_featured, display_order,
    grade, auction_grade, mileage, engine_cc, transmission, fuel, drive, body_type,
    exterior_color, interior_color, seats, doors, chassis_number, registration, steering,
    accident_history, purchase_price, price, currency, negotiable, short_description, description,
    features, auction_sheet_available, auction_sheet_url, youtube_url, arrival_date,
    archived_at, created_at, updated_at, featured_position, is_new_arrival
)
SELECT
    id, slug, stock_number, make, model, year, status, is_published, is_featured, display_order,
    grade, auction_grade, mileage, engine_cc, transmission, fuel, drive, body_type,
    exterior_color, interior_color, seats, doors, chassis_number, registration, steering,
    accident_history, purchase_price, price, currency, negotiable, short_description, description,
    features, auction_sheet_available, auction_sheet_url, youtube_url, arrival_date,
    archived_at, created_at, updated_at, featured_position, is_new_arrival
FROM vehicles;

DROP TABLE vehicles;
ALTER TABLE _vehicles_new RENAME TO vehicles;

CREATE INDEX IF NOT EXISTS idx_vehicle_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_make ON vehicles(make);
CREATE INDEX IF NOT EXISTS idx_vehicle_year ON vehicles(year);
CREATE INDEX IF NOT EXISTS idx_vehicle_published ON vehicles(is_published);
CREATE INDEX IF NOT EXISTS idx_vehicle_featured ON vehicles(is_featured);
CREATE INDEX IF NOT EXISTS idx_vehicle_archived ON vehicles(archived_at);
CREATE INDEX IF NOT EXISTS idx_vehicle_display_order ON vehicles(display_order);
CREATE INDEX IF NOT EXISTS idx_vehicle_stock ON vehicles(stock_number);
CREATE INDEX IF NOT EXISTS idx_vehicle_status_archived ON vehicles(status, archived_at);

PRAGMA foreign_keys=ON;

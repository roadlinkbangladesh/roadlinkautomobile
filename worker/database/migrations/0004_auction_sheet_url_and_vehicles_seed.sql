-- =============================================================================
-- Roadlink Automobiles
-- Cloudflare D1 Database Migration: 0004_auction_sheet_url_and_vehicles_seed.sql
-- Description: Adds auction_sheet_url column to vehicles table (if missing)
--              and seeds full vehicles inventory & vehicle images dataset.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- =============================================================================
-- 1. SCHEMA MIGRATIONS
-- =============================================================================

-- Add auction_sheet_url column to vehicles table
-- SQLite / D1 will execute this ALTER TABLE statement.
ALTER TABLE vehicles ADD COLUMN auction_sheet_url TEXT;

-- =============================================================================
-- 2. VEHICLES SEED DATASET
-- =============================================================================

INSERT OR IGNORE INTO vehicles (
    id, slug, stock_number, make, model, year, status, is_published, is_featured,
    display_order, grade, auction_grade, mileage, engine_cc, transmission,
    fuel, drive, body_type, exterior_color, interior_color, seats, doors,
    chassis_number, registration, steering, accident_history, purchase_price,
    price, currency, negotiable, short_description, description, features,
    auction_sheet_available, auction_sheet_url, youtube_url, arrival_date,
    created_at, updated_at
) VALUES 
(
    1,
    'toyota-corolla-axio-hybrid-2019',
    'RL-8821',
    'Toyota',
    'Corolla Axio Hybrid',
    2019,
    'available',
    1, 1, 10,
    '4.5 / A', '4.5',
    32500, 1500,
    'Automatic', 'Hybrid', '2WD', 'Sedan',
    'Pearl White', 'Beige',
    5, 4,
    'NKE165-7128934', '2023', 'Right Hand', 'None',
    1650000, 2150000, 'BDT', 0,
    'Impeccably clean and highly efficient hybrid sedan with genuine auction certification.',
    'An exceptionally clean, fuel-efficient hybrid sedan directly imported from Nagoya. Features pre-crash active safety systems, lane departure alerts, original Japanese multimedia system, keyless entry, and pristine beige fabric seats. Excellent ground clearance and highly resilient suspension tuned for local roads.',
    '["Pre-Crash Safety","Lane Assist","Keyless Entry","Back Camera","EV Mode"]',
    1, 'https://roadlinkautomobiles.com/sheets/axio-auction-sheet.pdf', 'https://www.youtube.com/watch?v=7uK3j5SgYTo', '',
    '2026-06-10T10:00:00Z', '2026-07-01T12:00:00Z'
),
(
    2,
    'honda-vezel-hybrid-z-2020',
    'RL-7650',
    'Honda',
    'Vezel Hybrid Z',
    2020,
    'incoming',
    1, 1, 20,
    '5.0 / S', '5.0',
    28200, 1500,
    'Automatic', 'Hybrid', '2WD', 'SUV',
    'Crystal Black', 'Black Leather',
    5, 5,
    'RU3-1309821', 'Unregistered', 'Right Hand', 'None',
    2600000, 3400000, 'BDT', 1,
    'Top-grade Honda crossover equipped with premium leather interior and Honda SENSING.',
    'Top-tier premium crossover featuring Honda SENSING suite of driver aids. Equipped with half-leather black seats, dynamic LED sequential steering headlights, heated driver/passenger seats, genuine alloy wheels, and a spacious cockpit layout. Handpicked with an impeccable auction history.',
    '["Honda SENSING","Half Leather Seats","Heated Seats","LED Headlights","Cruise Control"]',
    1, 'https://roadlinkautomobiles.com/sheets/vezel-auction-sheet.pdf', 'https://www.youtube.com/watch?v=7uK3j5SgYTo', '2026-08-15',
    '2026-06-15T11:30:00Z', '2026-07-02T10:15:00Z'
),
(
    3,
    'nissan-xtrail-hybrid-2019',
    'RL-5491',
    'Nissan',
    'X-Trail Hybrid 4WD',
    2019,
    'incoming',
    1, 1, 30,
    '4.0 / B', '4.0',
    41000, 2000,
    'Automatic', 'Hybrid', '4WD', 'SUV',
    'Metallic Grey', 'Black Leather',
    5, 5,
    'HNT32-045112', 'Unregistered', 'Right Hand', 'None',
    3300000, 4250000, 'BDT', 0,
    'Rugged yet ultra-refined 4WD SUV with modern smart hybrid efficiency.',
    'Rugged yet ultra-refined 4WD SUV with modern smart hybrid efficiency. Features a panoramic dual sunroof, 360-degree Intelligent Around View Monitor, power automatic tailgate, premium leather upholstery, and active chassis controls. Ideal for cross-district road trips and executive city driving.',
    '["Panoramic Sunroof","360 Camera","Power Tailgate","4WD Lock","Leather Trim"]',
    1, 'https://roadlinkautomobiles.com/sheets/xtrail-auction-sheet.pdf', 'https://www.youtube.com/watch?v=7uK3j5SgYTo', 'Mid August 2026',
    '2026-06-18T08:45:00Z', '2026-07-03T14:20:00Z'
),
(
    4,
    'toyota-harrier-progress-2020',
    'RL-9011',
    'Toyota',
    'Harrier Progress Metal & Leather',
    2020,
    'reserved',
    1, 1, 40,
    '4.5 / A', '4.5',
    24500, 2000,
    'Automatic', 'Petrol', '2WD', 'SUV',
    'Pearl White', 'Redwood Leather',
    5, 5,
    'ZSU60-0198234', 'Unregistered', 'Right Hand', 'None',
    5400000, 6800000, 'BDT', 0,
    'Ultra-luxury Japanese SUV with pristine redwood leather interior and premium audio.',
    'The gold standard of luxury Japanese crossovers. The Harrier Progress edition features premium Redwood leather seats, a panoramic view monitor, advanced Pre-collision system, JBL surround sound system, and sequential indicators. Sourced for discerning buyers who demand executive class style.',
    '["JBL Sound System","Redwood Leather","Panoramic View","Radar Cruise Control","Power Seats"]',
    1, 'https://roadlinkautomobiles.com/sheets/harrier-auction-sheet.pdf', 'https://www.youtube.com/watch?v=7uK3j5SgYTo', '',
    '2026-06-20T14:10:00Z', '2026-07-04T16:30:00Z'
),
(
    5,
    'toyota-premio-f-ex-package-2018',
    'RL-1102',
    'Toyota',
    'Premio F EX Package',
    2018,
    'available',
    1, 0, 50,
    '4.5 / B', '4.5',
    48000, 1500,
    'Automatic', 'Petrol', '2WD', 'Sedan',
    'Wine Red', 'Beige Velvet',
    5, 4,
    'NZT260-312904', '2022', 'Right Hand', 'None',
    2450000, 3150000, 'BDT', 1,
    'Elegant executive sedan in rare Wine Red with luxurious woodgrain interior trim.',
    'Highly sought-after executive sedan in Bangladesh. The Premio F EX features a rich woodgrain finish, optical dashboard meter, power driver seat, auto-retractable mirrors, and full beige interior with velvet fabric seats. Meticulously maintained and directly imported.',
    '["Woodgrain Trim","Power Seat","Push Start","Idle Stop","Pre-Collision Braking"]',
    1, '', '', '',
    '2026-06-25T09:15:00Z', '2026-07-05T11:45:00Z'
),
(
    6,
    'honda-grace-ex-hybrid-2019',
    'RL-3345',
    'Honda',
    'Grace Hybrid EX',
    2019,
    'sold',
    1, 0, 60,
    '4.0 / B', '4.0',
    52000, 1500,
    'Automatic', 'Hybrid', '2WD', 'Sedan',
    'Pearl White', 'Dark Grey Leather',
    5, 4,
    'GM4-1200938', '2023', 'Right Hand', 'None',
    1500000, 1950000, 'BDT', 0,
    'Ultra fuel-efficient premium hybrid sedan with Honda sensing safety systems.',
    'The Honda Grace is the ultimate hybrid sedan for fuel economy and family comfort. EX package includes half leather seats, paddle shifters, original Honda multi-system, cruise control, and modern safety active radars. Recently sold to a client in Dhaka.',
    '["Half Leather","Paddle Shifters","Cruise Control","LED Fog Lights","Rear AC Vents"]',
    1, '', '', '',
    '2026-06-28T07:20:00Z', '2026-07-06T18:10:00Z'
),
(
    7,
    'toyota-voxy-zs-kirameki-2020',
    'RL-6632',
    'Toyota',
    'Voxy ZS Kirameki II Hybrid',
    2020,
    'available',
    1, 1, 70,
    '4.5 / A', '4.5',
    39000, 1800,
    'Automatic', 'Hybrid', '2WD', 'Van',
    'Dark Purple Metallic', 'Black Fabric',
    7, 5,
    'ZWR80G-0182736', 'Unregistered', 'Right Hand', 'None',
    3450000, 4350000, 'BDT', 1,
    'Luxurious 7-seater hybrid minivan featuring dual auto sliding doors and dynamic bodykit.',
    'The ideal premium family carrier. The Voxy ZS Kirameki II Hybrid has a luxurious 7-seater cabin with captain seats, dual-side power sliding doors, 3-zone climate control, pre-crash automatic safety system, and rear ceiling entertainment screen. Dynamic exterior chrome elements.',
    '["Dual Sliding Doors","7 Captain Seats","Rear Screen","Tri-Zone AC","Kirameki Body Kit"]',
    1, '', '', '',
    '2026-07-01T10:30:00Z', '2026-07-07T09:20:00Z'
),
(
    8,
    'nissan-leaf-g-62kwh-2021',
    'RL-4420',
    'Nissan',
    'Leaf G 62kWh e-Plus',
    2021,
    'incoming',
    1, 0, 80,
    '5.0 / A', '5.0',
    12500, 0,
    'Automatic', 'Electric', '2WD', 'Hatchback',
    'Aurora Flare Blue', 'Light Grey Premium',
    5, 5,
    'ZE1-098234', 'Unregistered', 'Right Hand', 'None',
    2850000, 3650000, 'BDT', 1,
    '100% electric hatchback with 62kWh extended range battery and smart e-Pedal.',
    'Future of driving in Dhaka. The Leaf G e-Plus features the 62kWh high-capacity battery for up to 385km of range, Nissan ProPILOT driver assist, e-Pedal system, dynamic intelligent cruise control, and leather heated seats and steering. Zero emissions, zero road-tax penalties.',
    '["62kWh Battery","ProPILOT Assist","e-Pedal","Heated Seats & Steering","360 Camera"]',
    1, '', '', '2026-09-02',
    '2026-07-03T11:45:00Z', '2026-07-08T15:10:00Z'
),
(
    9,
    'mazda-cx5-xd-exclusive-2019',
    'RL-7788',
    'Mazda',
    'CX-5 XD L-Package',
    2019,
    'available',
    1, 0, 90,
    '4.5 / B', '4.5',
    36000, 2200,
    'Automatic', 'Diesel', '4WD', 'SUV',
    'Soul Red Crystal', 'White Nappa Leather',
    5, 5,
    'KF2P-301928', '2023', 'Right Hand', 'None',
    3100000, 3950000, 'BDT', 0,
    'Award-winning design, dynamic diesel 4WD SUV with custom Nappa leather seats.',
    'The CX-5 XD L-Package is powered by a high-torque SkyActiv-D 2.2L clean diesel engine. Stunner in signature Soul Red Crystal. Equipped with pure white Nappa leather heated/ventilated seats, Bose premium audio, heads-up display, and active blind-spot radars.',
    '["Bose Sound","Nappa Leather","Heads-Up Display","Clean Diesel","SkyActiv-D 4WD"]',
    1, '', '', '',
    '2026-07-05T14:30:00Z', '2026-07-09T10:15:00Z'
),
(
    10,
    'subaru-levorg-sti-sport-2020',
    'RL-2204',
    'Subaru',
    'Levorg STI Sport AWD',
    2020,
    'available',
    1, 1, 100,
    '5.0 / S', '5.0',
    18500, 1800,
    'Automatic', 'Petrol', 'AWD', 'Wagon',
    'WR Blue Pearl', 'Bordeaux Leather',
    5, 5,
    'VN5-004129', 'Unregistered', 'Right Hand', 'None',
    3900000, 4900000, 'BDT', 0,
    'High-performance symmetrical AWD sport wagon tuned by STI in prestige WR Blue.',
    'For driving enthusiasts who require absolute space. The Levorg STI Sport combines Subaru Symmetrical AWD safety with STI sports-tuned Bilstein dampening suspension, dynamic direct-injection turbo engine, EyeSight safety suite, and deep Bordeaux red leather bucket seats. Exceptional control and luxury styling.',
    '["Symmetrical AWD","STI Sport Suspension","EyeSight Safety","Bordeaux Leather","STI Alloys"]',
    1, '', '', '',
    '2026-07-06T16:00:00Z', '2026-07-10T12:00:00Z'
),
(
    11,
    'toyota-aqua-g-led-2018',
    'RL-8822',
    'Toyota',
    'Aqua G LED Soft Leather',
    2018,
    'available',
    1, 0, 110,
    '4.0 / B', '4.0',
    55000, 1500,
    'Automatic', 'Hybrid', '2WD', 'Hatchback',
    'Silver Metallic', 'Black Leatherette',
    5, 5,
    'NHP10-2109834', '2022', 'Right Hand', 'None',
    1300000, 1680000, 'BDT', 1,
    'Ultra-maneuverable and incredibly reliable hybrid hatchback, ideal for daily city commuting.',
    'Highly sought after for daily commutes in Dhaka. Features standard Toyota Safety Sense, soft synthetic leather interior, premium smart infotainment screen, dynamic steering wheel controls, and durable chassis. Superb fuel economy of up to 28 km/L.',
    '["LED Headlights","Safety Sense","Leather Seats","Smart Keyless Entry","Climate Control AC"]',
    1, '', '', '',
    '2026-07-07T08:15:00Z', '2026-07-11T13:40:00Z'
),
(
    12,
    'honda-fit-ness-hybrid-2020',
    'RL-5503',
    'Honda',
    'Fit Hybrid NESS Package',
    2020,
    'available',
    1, 0, 120,
    '4.5 / A', '4.5',
    22000, 1500,
    'Automatic', 'Hybrid', '2WD', 'Hatchback',
    'Lime White Bi-Color', 'Waterproof NESS Seats',
    5, 5,
    'GR3-1002938', 'Unregistered', 'Right Hand', 'None',
    1450000, 1880000, 'BDT', 1,
    'Sporty, dynamic hybrid hatchback in modern duo-tone styling with waterproof interior.',
    'A fun-loving daily companion. The Honda Fit NESS Package offers dual-color exterior accents, water-repellent sports upholstery, 16-inch custom alloy wheels, full digital dashboard cluster, and the robust Honda SENSING suite. High utility Magic Seats configuration.',
    '["NESS Sport Alloys","Water-Repellent Seats","Duo-Tone Accent","Honda SENSING","Smart Entry"]',
    1, '', '', '',
    '2026-07-08T12:00:00Z', '2026-07-12T10:00:00Z'
);

-- =============================================================================
-- 3. VEHICLE IMAGES SEED DATASET
-- =============================================================================

INSERT OR IGNORE INTO vehicle_images (vehicle_id, image_type, image_url, display_order, created_at) VALUES
-- Vehicle 1
(1, 'exterior', 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=800', 1, '2026-06-10T10:00:00Z'),
(1, 'exterior', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800', 2, '2026-06-10T10:00:00Z'),
(1, 'exterior', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=800', 3, '2026-06-10T10:00:00Z'),
(1, 'interior', 'https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=800', 1, '2026-06-10T10:00:00Z'),
(1, 'interior', 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=800', 2, '2026-06-10T10:00:00Z'),

-- Vehicle 2
(2, 'exterior', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=800', 1, '2026-06-15T11:30:00Z'),
(2, 'exterior', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800', 2, '2026-06-15T11:30:00Z'),
(2, 'exterior', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=800', 3, '2026-06-15T11:30:00Z'),
(2, 'interior', 'https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=800', 1, '2026-06-15T11:30:00Z'),
(2, 'interior', 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=800', 2, '2026-06-15T11:30:00Z'),

-- Vehicle 3
(3, 'exterior', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=800', 1, '2026-06-18T08:45:00Z'),
(3, 'exterior', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800', 2, '2026-06-18T08:45:00Z'),
(3, 'exterior', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=800', 3, '2026-06-18T08:45:00Z'),
(3, 'interior', 'https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=800', 1, '2026-06-18T08:45:00Z'),
(3, 'interior', 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=800', 2, '2026-06-18T08:45:00Z'),

-- Vehicle 4
(4, 'exterior', 'https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=800', 1, '2026-06-20T14:10:00Z'),
(4, 'exterior', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800', 2, '2026-06-20T14:10:00Z'),
(4, 'exterior', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=800', 3, '2026-06-20T14:10:00Z'),
(4, 'interior', 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=800', 1, '2026-06-20T14:10:00Z'),
(4, 'interior', 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=800', 2, '2026-06-20T14:10:00Z'),

-- Vehicle 5
(5, 'exterior', 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?q=80&w=800', 1, '2026-06-25T09:15:00Z'),

-- Vehicle 6
(6, 'exterior', 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=800', 1, '2026-06-28T07:20:00Z'),

-- Vehicle 7
(7, 'exterior', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=800', 1, '2026-07-01T10:30:00Z'),

-- Vehicle 8
(8, 'exterior', 'https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=800', 1, '2026-07-03T11:45:00Z'),

-- Vehicle 9
(9, 'exterior', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=800', 1, '2026-07-05T14:30:00Z'),

-- Vehicle 10
(10, 'exterior', 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=800', 1, '2026-07-06T16:00:00Z'),

-- Vehicle 11
(11, 'exterior', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=800', 1, '2026-07-07T08:15:00Z'),

-- Vehicle 12
(12, 'exterior', 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=800', 1, '2026-07-08T12:00:00Z');

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

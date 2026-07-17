# Roadlink Automobiles
## Technical Architecture Specification

**Document Version:** 1.0  
**Project Status:** Public Website (Phase 1)  
**Document Type:** Technical Architecture Specification  
**Last Updated:** July 2026

---

# 1. Purpose

This document defines the technical architecture, development standards, and implementation principles of the Roadlink Automobiles website.

It serves as the primary technical reference for future development and ensures that all new features follow a consistent architecture.

This document intentionally focuses on architecture rather than implementation details. Technologies may evolve over time, but the architectural principles described here should remain stable.

---

# 2. Project Overview

Roadlink Automobiles is a professional showroom website for imported Japanese reconditioned vehicles.

The website has two major objectives:

- Present vehicles professionally to potential buyers.
- Provide a foundation for a future inventory management system.

The project is designed to evolve gradually:

Phase 1

- Static public website
- Mock inventory
- SEO optimized pages

Phase 2

- Administration interface
- Vehicle management
- Media management

Phase 3

- REST API
- Database
- Authentication
- Analytics

The frontend architecture has been intentionally designed so that Phase 3 can replace the mock data layer without requiring changes to the presentation layer.

---

# 3. Core Design Principles

The project follows the following engineering principles.

## Simplicity

The website uses plain HTML, CSS and JavaScript.

No frontend framework is used.

---

## Progressive Enhancement

The website should remain usable even if advanced browser features are unavailable.

---

## SEO First

Every public page should be indexable.

Vehicle pages should generate structured metadata automatically.

---

## Accessibility

The website should follow modern accessibility practices.

Examples include:

- Semantic HTML
- Keyboard navigation
- ARIA labels
- Focus management
- Screen reader support

---

## Mobile First

Every page must function correctly on:

- Desktop
- Tablet
- Mobile

---

## Modular Architecture

Each page owns its own controller.

Business logic is separated into dedicated functions.

Future APIs should replace only the data layer.

---

## Replaceable Data Layer

The UI must never depend on where data comes from.

Today:

```
MOCK_VEHICLES
```

Tomorrow:

```
REST API

or

Database

or

CMS
```

The rendering layer should remain unchanged.

---

# 4. Technology Stack

## Current

Frontend

- HTML5
- CSS3
- Vanilla JavaScript (ES Modules)

Data

- Mock JavaScript objects

Deployment

- Static website

---

## Planned & Finalized Backend Platform

- **Source Code Repository**: GitHub
- **Frontend Hosting**: Cloudflare Pages (Frontend remains a fully static website)
- **Backend API**: Cloudflare Workers
- **Relational Database**: Cloudflare D1 (SQLite)
- **Vehicle Image Storage**: Cloudflare R2

## Database Migrations Policy
- Database schema changes after initial deployment must be introduced through migration scripts rather than directly modifying the original schema. This ensures zero data loss, auditability, and reproducible environments.

---

# 5. Project Architecture

Current architecture

```
Homepage

index.html
        │
        │
Stock Listing
stock.html
        │
        │
stock.js
        │
        │
Vehicle Cards
        │
        │
vehicle.html
        │
        │
vehicle.js
```

Future architecture

```
Browser

↓

UI Layer

↓

Vehicle Service

↓

REST API

↓

Database
```

Only the Vehicle Service layer should change when backend integration begins.

---

# 6. Directory Structure

Current project structure

```
/
│
├── index.html
├── stock.html
├── vehicle.html
│
├── css/
│      style.css
│
├── js/
│      stock.js
│      vehicle.js
│
├── assets/
│      images/
│      logo.png
│
└── README.md
```

Future modules

```
admin/

dashboard/

services/

api/

media/
```

---

# 7. Application Modules

## Homepage

Purpose

Marketing website.

Primary sections

- Hero
- Featured vehicles
- Company introduction
- Trust indicators
- Contact
- Footer

---

## Stock Listing

Purpose

Browse inventory.

Responsibilities

- Vehicle listing
- Search
- Filters
- Sorting
- Pagination
- Vehicle cards

Current data source

```
MOCK_VEHICLES
```

Future

```
GET /vehicles
```

---

## Vehicle Details

Purpose

Display complete vehicle information.

Responsibilities

- SEO
- Gallery
- Specifications
- Features
- Description
- Auction Sheet
- Promotional Poster
- YouTube
- Related Vehicles
- Share
- Contact

Current source

```
fetchVehicleByStock()
```

Future

```
GET /vehicle/{stockNumber}
```

---

# 8. JavaScript Architecture

Each page has a dedicated controller.

Example

```
stock.html

↓

stock.js

↓

Hydration

↓

Rendering
```

Vehicle page

```
vehicle.html

↓

vehicle.js

↓

Hydration Functions

↓

DOM
```

Rendering is organized into modular hydration functions.

Examples

```
hydrateSEO()

hydrateMainMedia()

hydrateSpecifications()

hydrateFeatures()

hydrateDescription()

hydrateAuctionSheet()

hydratePromotionalPoster()

hydrateYoutubeEmbed()

hydrateRelatedVehicles()
```

This architecture should be preserved.

---

# 9. Data Layer

Current implementation

```
MOCK_VEHICLES

↓

Filtering

↓

Rendering
```

Future implementation

```
REST API

↓

Vehicle Service

↓

Rendering
```

The rendering code should never communicate directly with the database.

---

# 10. Vehicle Data Model

The Vehicle object is the single source of truth throughout the application.

Every vehicle should follow the same schema.

```javascript
{
    id,                  // String: Unique identifier for routing/referencing (e.g. "toyota-axio")
    slug,                // String: SEO-friendly slug string (e.g. "toyota-corolla-axio-hybrid-2019")
    stockNumber,         // String: Stock reference number (e.g. "RL-8821")

    make,                // String: Manufacturer brand name (e.g. "Toyota")
    model,               // String: Vehicle model line name (e.g. "Corolla Axio Hybrid")
    year,                // Number: Year of manufacture (e.g. 2019)

    price,               // Number: List price in BDT (e.g. 2150000)
    negotiable,          // Boolean: Whether the price is negotiable (e.g. false)

    status,              // String: 'available' | 'incoming' | 'reserved' | 'sold' | 'draft'

    featured,            // Boolean: Whether highlighted on home page
    displayOrder,        // Number: Sort ranking order on home/stock views

    grade,               // String: Combined grade string representation (e.g. "4.5 / A")
    auctionGrade,        // String: Numeric or alphabetic auction score (e.g. "4.5")
    mileage,             // Number: Total odometer reading in kilometers (e.g. 32500)

    engineCC,            // Number: Displacement in Cubic Centimeters (e.g. 1500)
    transmission,        // String: Gearbox type (e.g. "Automatic")
    fuel,                // String: Fuel power system type (e.g. "Hybrid")
    drive,               // String: Drivetrain configuration (e.g. "2WD")

    bodyType,            // String: Body style classification (e.g. "Sedan")

    exteriorColor,       // String: Outer paint color (e.g. "Pearl White")
    interiorColor,       // String: Inside cabin/seat color (e.g. "Beige")

    seats,               // Number: Passenger capacity (e.g. 5)
    doors,               // Number: Door count (e.g. 4)

    accidentHistory,     // String: Accident/reconstruction status (e.g. "None")

    shortDescription,    // String: Brief teaser description
    description,         // String: Detailed narrative description

    features,            // Array of strings: Key options checklist (e.g. ["Pre-Crash Safety", "EV Mode"])

    coverImage,          // String: Primary cover image URL

    images,              // Array of strings: Combined all images list
    exteriorImages,      // Array of strings: Exterior gallery URLs list
    interiorImages,      // Array of strings: Interior gallery URLs list

    auctionSheetAvailable, // Boolean: If authentic sheet cert exists
    auctionSheetUrl,     // String: Auction sheet file/image link URL

    youtubeUrl,          // String: Full YouTube walkthrough clip URL

    arrivalDate,         // String: Estimated arrival timeframe (e.g. "Mid August 2026")

    createdAt,           // String: ISO timestamp of creation
    updatedAt            // String: ISO timestamp of last modification
}
```

No page should assume additional fields outside this schema without updating this specification.

### Database Representation & Rules

1. **Vehicle Metadata & Status Storage**:
   - Core vehicle attributes are stored as column fields in the **`vehicles`** table in Cloudflare D1.
   - **Business Status (`status`)**: Limited strictly to `'available'`, `'incoming'`, `'reserved'`, and `'sold'`. The legacy `'draft'` status is removed.
   - **Publication Status (`is_published`)**: Handled independently of the business status via the `is_published` boolean/integer column.
   - **`arrivalDate`** remains a free-text field (e.g., `"Mid August 2026"`). No arrival status enum or complex state logic is used.

2. **Vehicle Lifecycle (`archived_at`) & Soft Deletes**:
   - Vehicles are never permanently deleted immediately. Deleting a vehicle archives it.
   - Represented by a nullable UTC timestamp field `archived_at`.
     - `archived_at = NULL` means the vehicle is active.
     - `archived_at = <UTC_Timestamp>` means the vehicle is archived.
   - **Archived Vehicles Policy**:
     - Hidden from the public website completely.
     - Hidden from default admin/manager inventory lists.
     - Retain all associated details and image records.
     - Can be restored before automatic purge.
   - Do **NOT** introduce an "archived" status to the core business status list; it is strictly a lifecycle attribute.

3. **Automatic Purging**:
   - A scheduled Cloudflare Worker Cron Trigger automatically purges archived vehicles after a configurable retention period.
   - The retention period is stored in the `settings` table as a key-value pair (e.g., `archive_retention_days = 180`).
   - **The purge process permanently deletes**:
     - The vehicle record.
     - All associated image records in the `vehicle_images` table.
     - The binary image assets stored in Cloudflare R2.
   - Every automatic purge operation must write an audit record to the `activity_logs` table.

4. **Image Storage Model**:
   - All vehicle images are stored in the separate normalized **`vehicle_images`** table.
   - Each image record contains:
     - `vehicle_id`: Foreign key referencing the `vehicles` table.
     - `image_url`: Full asset URL in Cloudflare R2 storage.
     - `image_type`: A string categorizing the asset type, strictly limited to: `'exterior'`, `'interior'`, or `'auction'`.
     - `display_order`: An integer defining the sort order.
   - **No Separate Cover/Poster Image**: There is no separate poster image or dedicated database cover image field.
   - **Dynamic Cover Image**: The cover image is derived dynamically as **the first exterior image ordered by display_order** (lowest value). The backend maps these normalized image records into the vehicle data model returned to the frontend.

5. **Time Handling & Timezones**:
   - **Backend/Database**: All timestamps are stored strictly in Coordinated Universal Time (UTC).
   - **Frontend**: The static frontend website displays dates and times formatted for the **Asia/Dhaka (UTC+6)** timezone. Day-to-day business operations are evaluated using Dhaka local time, while data storage remains purely UTC.

---

# 11. Rendering Strategy

The UI is hydration-based.

General flow

```
Load data

↓

Hydrate sections

↓

Render HTML

↓

Attach interaction handlers
```

Rendering functions should remain stateless whenever possible.

---

# 12. Search and Filtering

Current functionality

- Search
- Make
- Body Type
- Fuel Type
- Transmission
- Status
- Sort
- Pagination

Filtering occurs entirely on the client.

Future implementation

The UI should remain identical.

Only the data source should change.

---

# 13. SEO Architecture

Every vehicle page dynamically generates

- Page Title
- Description
- Canonical URL
- Open Graph tags
- Twitter Card tags
- JSON-LD Vehicle Schema

No manual SEO editing should be required for individual vehicles.

---

# 14. Image Management

Each vehicle may include

- Cover image
- Poster image
- Exterior gallery
- Interior gallery
- Auction sheet
- Promotional assets

Current implementation

Static image files.

Future implementation

Cloud-hosted media.

The database should store URLs only.

---

# 15. Media Components

Vehicle page supports

- Image galleries
- Lightbox
- Keyboard navigation
- Swipe gestures
- Lazy loading

Future additions may include

- 360° viewer
- Multiple videos
- Interior walkthroughs

---

# 16. Related Vehicles

Related vehicles are currently selected using

Priority 1

Same manufacturer

Priority 2

Same body type

Maximum

4 vehicles

Future recommendation engines may replace this logic without changing the UI.

---

# 17. Performance Objectives

The website should target

- Lighthouse ≥ 95
- Largest Contentful Paint < 2.5 seconds
- Cumulative Layout Shift < 0.1
- Responsive images
- Lazy loading
- Minimal JavaScript
- Minimal layout shifts

---

# 18. Security & Database Architecture

## 18.1 Locked Database Schema
The database uses exactly these five relational tables inside Cloudflare D1. No additional tables, permission models, or RBAC structures are permitted:
- `users`: Contains system user records (id, username, password_hash, role, created_at, updated_at).
- `settings`: Holds global key-value configuration values (key, value, updated_at).
- `vehicles`: Holds core inventory metadata, specifications, and statuses.
- `vehicle_images`: Holds image URLs, types (exterior, interior, auction), and display orders.
- `activity_logs`: Holds administrative audit records.

## 18.2 Authentication & Signed Session Tokens
- **Platform-Enforced Logic**: Authentication is fully handled by the Cloudflare Worker backend. The frontend remains a static website and does not contain login or authentication validation logic.
- **Password Hashing**: Passwords must strictly be stored only as salted password hashes using **Argon2** password hashing. Plaintext passwords must never be stored.
- **Signed JWT Tokens**: Authentication utilizes signed JSON Web Tokens (JWTs). These tokens are validated exclusively by the Cloudflare Worker.
- **Token Delivery**: Session JWTs are stored in secure **HttpOnly, Secure, and SameSite** cookies.
- **Session Expiration**: Enforced by standard JWT expiration.

## 18.3 Session Management & User Roles
- **Supported User Roles**:
  - `admin`: Full system access, including viewing and modifying security/global configurations.
  - `manager`: Inventory management only. Permissions are intentionally limited. Managers are prohibited from modifying settings.
- **Sliding Session Expiration**: Active sessions are renewed dynamically on user interaction, extending the JWT expiration sliding window.
- **Configurable Session Timeout**: The session timeout length is configurable and stored in the `settings` table as a key-value pair (e.g., `session_timeout_minutes`).
- **Authorization Constraints**: The configuration of the timeout value is **NOT** editable from the frontend. Only users with the `admin` role can modify security configurations directly via backend authenticated API commands.
- **Audit Compliance**: All administrative state actions (stock edits, configuration adjustments, login attempts) are recorded in the `activity_logs` table.

## 18.4 Core Security Principles
- **Security-First Coding**: Build secure interfaces by default with principle of least privilege.
- **Never Trust Client Inputs**: All data validation occurs within the Cloudflare Worker. Client-side checks are for user interface polish only.
- **SQL Parameterization**: SQL queries must always be parameterized. Dynamic string concatenation is forbidden.
- **Secrets Isolation**: Cloudflare Secrets are used for sensitive configuration (salts, JWT keys). Secrets must never be committed to Git.
- **Audit Logging**: Mandatory audit logging is required in the `activity_logs` table for all administrative state modifications (adding/editing/deleting cars, configuration edits, user logins).

---

# 19. Planned Administration System

Future modules

```
Login

Dashboard

Vehicle List (with Cover Image derived dynamically from vehicle_images)

Vehicle Editor (with exterior/interior image order management)

Users Management (Admin only)

Settings Management (Admin only, e.g., session_timeout_minutes)
```

The administration interface consumes the backend REST API hosted on Cloudflare Workers.

---

# 20. Planned API

Illustrative endpoints

```
GET     /vehicles

GET     /vehicles/{stock}

POST    /vehicles

PUT     /vehicles/{stock}

DELETE  /vehicles/{stock}

POST    /upload/image

POST    /login

POST    /logout
```

These endpoints are conceptual and may evolve during backend design.

---

# 21. Coding Standards

General guidelines

- Prefer readability over cleverness.
- Keep functions focused on a single responsibility.
- Use descriptive names.
- Minimize global state.
- Avoid duplicated logic.
- Preserve accessibility.
- Preserve SEO.
- Preserve responsive behavior.

---

# 22. Development Principles

The following principles govern future development.

### 1. Preserve Working UI

Do not refactor stable UI components solely for stylistic reasons.

---

### 2. Separate Responsibilities

Keep presentation, business logic and data access independent.

---

### 3. Preserve Data Contracts

Changes to the Vehicle object should be intentional and documented.

---

### 4. API Independence

Pages should never depend on database implementation details.

---

### 5. Backward Compatibility

Whenever possible, new features should not break existing pages.

---

### 6. Reusability

Reusable components are preferred over duplicated implementations.

---

### 7. Accessibility

Every new component should remain keyboard accessible.

---

### 8. SEO

No new functionality should reduce search engine visibility.

---

### 9. Performance

Avoid unnecessary libraries or large dependencies.

---

### 10. Evolution

The current frontend is considered stable.

Future work should primarily focus on expanding the system through new modules rather than rewriting existing ones.

---

# 23. Future Roadmap

## Phase 1

- Public Website
- Vehicle Listings
- Vehicle Details
- SEO
- Responsive UI

Status

Completed.

---

## Phase 2

- Admin Dashboard
- Vehicle CRUD
- Image Management
- Media Upload
- Dashboard Statistics

Status

Planned.

---

## Phase 3

- REST API
- Database
- Authentication
- Cloud Storage
- Contact Management
- Analytics

Status

Planned.

---

# 24. Conclusion

The Roadlink Automobiles project is intentionally designed around a stable presentation layer with a replaceable data layer. This approach minimizes future migration effort, allowing the website to evolve from a static prototype into a fully integrated inventory management platform without requiring major changes to the user interface.

Future development should prioritize expanding functionality through new modules while preserving the existing frontend architecture.

---

# 25. Inventory Schema Sync & Specifications (Merged Reference)

This outlines the synchronized data structures, variable names, data types, and mapping relationships between the **Admin Portal** inventory manager and the **Public Customer-Facing Website**.

### Core Synchronized Fields

The following fields have been synchronized across the admin inventory editor (`/admin/index.html`, `/admin/vehicles.js`) and the public detail viewer (`/js/vehicle.js`, `/js/stock.js`):

| Variable Name | JSON Data Type | Admin Input Type | UI Form Section | Public Website Mapping & Display |
| :--- | :--- | :--- | :--- | :--- |
| `bodyType` | `string` | `<select>` dropdown | Core Information | Displayed in Key Specs table (Sedan, SUV, Hatchback, etc.) |
| `featured` | `boolean` | `<input type="checkbox">` | Core Information | Flags vehicle for Home page featured slider & prominent badges |
| `negotiable` | `boolean` | `<input type="checkbox">` | Pricing | Appends a "Negotiable" note next to the price on the detail page |
| `arrivalDate` | `string` | `<input type="text">` | Status | Displays expected delivery timeline on incoming/pending vehicles |
| `accidentHistory` | `string` | `<input type="text">` | Specifications | Renders under the specifications detail list (e.g. "None", "Repaired") |
| `shortDescription` | `string` | `<input type="text">` | Description | Displayed as a premium bold subtitle/tagline below the main title |
| `youtubeUrl` | `string` | `<input type="url">` | Media & Verification | Embeds an interactive YouTube walkaround video frame on the details page |
| `auctionSheetUrl` | `string` | `<input type="text">` | Media & Verification | Connects direct view link to the verifiable report modal |
| `auctionSheetAvailable`| `boolean` | `<input type="checkbox">` | Media & Verification | Shows verified auction badge, unlocking "View Report" interactive controls |
| `published` | `boolean` | `<input type="checkbox">` | Core Information | If false, hides the vehicle from all public portal pages (home, stock, related list, and detail direct lookup) |
| `features` | `string[]` | Comma-separated input | Specifications | Parses into an array to render responsive highlight bullet points |

---

### Updated Specifications Table Mappings

To maximize transparency, several fields that were previously omitted or hidden from the public website specifications table have been integrated and fully formatted in `/js/vehicle.js`:

*   **Chassis Number (`chassisNumber`)**: Integrated directly into the specs list.
*   **Registration (`registration`)**: Displays current registration status or "Unregistered / Auction Grade" dynamically.
*   **Steering Config (`steering`)**: Formatted dynamically for instant recognition (e.g., `"RHD"` converts to `"Right Hand Drive (RHD)"` and `"LHD"` to `"Left Hand Drive (LHD)"`).

---

### Data Safety & Form Handlers

*   **Robust Parsing**: Boolean checkbox inputs are parsed via strict truthiness tests (`!!value` and `input.checked`) rather than string comparisons.
*   **List Transformations**: The comma-separated feature string is automatically split, trimmed, and stripped of empty elements to produce a clean TypeScript/JavaScript array:
    ```js
    const parsedFeatures = data.features ? data.features.split(",").map(f => f.trim()).filter(Boolean) : [];
    ```
*   **Fallback Assets**: Missing cover photos default to a high-resolution premium Unsplash placeholder to maintain elegant UI presentation in both grids and tabular logs.

---

# 26. Architecture Decision Records (ADR)

This section contains the immutable architectural decisions for the Roadlink Automobiles platform. These decisions guide ongoing development and preserve the structural integrity of the application.

---

## ADR-001: Cloudflare Stack

### Status
Accepted (July 2026)

### Context
We need a robust, scalable, yet cost-efficient hosting and backend platform suitable for a single vehicle dealership owner. Minimizing maintenance effort and operational overhead is crucial.

### Decision
The entire application infrastructure will be hosted on the Cloudflare ecosystem:
- **Source Control**: GitHub as the sole source of truth.
- **Frontend Hosting**: Cloudflare Pages, serving the public and admin portals as a fully static website.
- **Backend API Layer**: Cloudflare Workers (running a lightweight REST API).
- **Relational Database**: Cloudflare D1 (SQLite) for structured transactional records.
- **Media Asset Storage**: Cloudflare R2 (Object Storage) for storing exterior, interior, and auction images.

### Consequences
- Zero-cost or very low-cost hosting within Cloudflare's free limits.
- Extremely low latency due to Cloudflare's edge-network distribution.
- Clear, distinct boundary between the static presentation layer (Pages) and the backend database/validation service (Workers).

---

## ADR-002: Five-Table Database Schema

### Status
Accepted (July 2026) - **LOCKED**

### Context
To maintain simplicity and prevent architectural drift, we must strictly control the database complexity. We want to avoid relational bloat or nested permission tables.

### Decision
The schema is locked to exactly the following five tables:
1. `users`: System account records.
2. `settings`: Global key-value options.
3. `vehicles`: Vehicle core details and statuses.
4. `vehicle_images`: Ordered collection of image URLs and metadata.
5. `activity_logs`: Chronological audit trail of all administrator/manager changes.

No additional tables (such as roles, permissions, or vehicle_features) are allowed.

### Consequences
- High maintainability, allowing easy inspection and backup of the SQLite file.
- Features like vehicle specifications/features must be serialized (e.g. as JSON or comma-separated lists) instead of introducing child tables.

---

## ADR-003: JWT Authentication

### Status
Accepted (July 2026)

### Context
The application is a full-stack system with a static frontend and a serverless backend. We need stateless, secure, and performant session verification.

### Decision
- **Protocol**: JSON Web Token (JWT) based authentication.
- **Password Hashing**: Strictly using **Argon2** password hashing (no plaintext or weak hashing).
- **Delivery**: Tokens are stored and transmitted in secure **HttpOnly, Secure, SameSite=Strict** cookies to prevent token leakage via XSS.
- **Session Lifespan**: Enforced by JWT expiration.
- **Session Style**: Sliding session expiration (refreshed on active user interaction).
- **Validation**: Performed exclusively by the Cloudflare Worker backend. The frontend never runs local authentication or credential validation logic itself.

### Consequences
- Eliminates the need for a database-backed session table, keeping D1 lightweight.
- High resilience against CSRF and XSS attacks.

---

## ADR-004: Vehicle Image Normalization

### Status
Accepted (July 2026)

### Context
The application needs to handle multiple image galleries per vehicle (exterior, interior, auction sheet) without database denormalization or duplicate field lookups.

### Decision
- Store all vehicle image references in a single unified `vehicle_images` table.
- Eliminate separate `cover` or `poster` fields/tables.
- Image records contain exactly `vehicle_id`, `image_url`, `image_type` (restricted to `'exterior'`, `'interior'`, or `'auction'`), and `display_order`.
- The Cloudflare Worker backend maps normalized image records into the expected frontend data models.

### Consequences
- Standardized image queries across all pages.
- Avoids multiple redundant image tables.

---

## ADR-005: UTC Timestamp Policy

### Status
Accepted (July 2026)

### Context
Multiple environments and clients will interact with the database. To prevent timestamp timezone mismatches, a unified date-time format is required.

### Decision
- **Storage**: All database and server-side timestamps must be generated and stored in **Coordinated Universal Time (UTC)**.
- **Display**: The static frontend converts and formats these timestamps to the local **Asia/Dhaka (UTC+6)** timezone for presentation to the Bangladeshi customer base and local dealership managers.

### Consequences
- Consistent, reliable audit trails in `activity_logs`.
- Prevents timezone drift during server restarts or region changes on Cloudflare.

---

## ADR-006: Archive Instead of Delete

### Status
Accepted (July 2026)

### Context
Accidental deletions of vehicle stock are costly. The owner must have a safeguard to restore inventory listings before they are permanently deleted from Cloudflare R2 and D1.

### Decision
- Vehicles are never deleted permanently immediately by user action. Instead, deleting a vehicle archives it.
- Archive state is represented in the `vehicles` table via a nullable timestamp field `archived_at`.
  - `archived_at = NULL` represents an active vehicle.
  - `archived_at = <UTC_Timestamp>` represents an archived vehicle.
- Archived vehicles are completely hidden from the public website and hidden from default default administrative listings.
- Images and specifications are fully preserved while archived, allowing seamless restoration.

### Consequences
- Safeguards dealership inventory records against human error.
- Soft-deletes are handled without inventing new core business status strings.

---

## ADR-007: Configurable Session Timeout

### Status
Accepted (July 2026)

### Context
The dealership owner requires administrative control over session idle timeouts to enforce local security rules.

### Decision
- The idle timeout duration is stored as a setting (e.g. `session_timeout_minutes`) in the global `settings` table.
- This configuration is **NOT** editable or visible from the general public or manager-level views.
- Only users with the `admin` role can modify security configurations directly via authenticated API requests.
- Users with the `manager` role are restricted from editing security configuration parameters.

### Consequences
- Eliminates static hardcoded timeout limits.
- Reinforces the role separation between administrative owners and inventory managers.

---

## ADR-008: Cover Image Derived from First Exterior Image

### Status
Accepted (July 2026)

### Context
Having separate "cover image" fields creates synchronization friction when images are uploaded, rearranged, or deleted.

### Decision
- No dedicated cover image database field exists.
- The cover image is always dynamically derived as **the first exterior image ordered by display_order** (lowest integer value).
- Both the public vehicle details page, stock list page, and administrative dashboards must use this dynamic derivation strategy.

### Consequences
- Guarantees that deleting or reordering exterior images dynamically updates the cover image without requiring double-writes or database updates.

---

## ADR-009: Separate Business Status, Publication Status and Lifecycle

### Status
Accepted (July 2026)

### Context
To prevent logical conflicts, a clear boundary is required between a vehicle's commercial stage, its draft/public availability state, and its system storage lifespan.

### Decision
Three distinct dimensions represent a vehicle's operational state:
1. **Business Status (`status`)**: Reflects the commercial phase of the vehicle:
   - `available`: Instantly buyable.
   - `incoming`: On the way from Japan.
   - `reserved`: Deposit received.
   - `sold`: Fulfilled.
   *(Legacy `draft` status is removed from this list)*
2. **Publication Status (`is_published`)**: Handled via a boolean field. Allows managers to draft/prepare listings safely before making them public, independent of their commercial state (e.g., an incoming car can be a draft or published).
3. **Lifecycle State (`archived_at`)**: Controls whether the listing exists in the active workspace. If archived, it is excluded from public visibility and default lists, pending automatic purging.

### Consequences
- Clear, highly maintainable operational lifecycle.
- Eliminates logical collision where a draft vehicle had to share the same status list as sold or incoming.

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

## Planned

Backend

- REST API

Database

- To be determined

Authentication

- To be determined

Cloud Storage

- To be determined

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
    posterImage,         // String: Promotional poster image URL

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

# 18. Security

Current website

Public read-only.

Future administration

- Authentication
- Authorization
- Audit logging
- Rate limiting
- Input validation
- Secure file uploads
- CSRF protection
- Server-side validation

Security should always be enforced on the server.

Client-side validation is for usability only.

---

# 19. Planned Administration System

Future modules

```
Login

Dashboard

Vehicle List

Vehicle Editor

Image Upload

Media Library

Users

Settings
```

The administration interface should consume the same API as the public website.

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

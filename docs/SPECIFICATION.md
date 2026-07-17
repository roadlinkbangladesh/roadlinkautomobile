# Roadlink Automobiles Website
## Software Specification
Version: 1.0
Status: Draft
Author: ChatGPT & Project Owner
Last Updated: July 2026

---

# 1. Project Overview

## 1.1 Purpose

Develop a modern, responsive website for Roadlink Automobiles that showcases available Japanese reconditioned passenger vehicles while providing a simple administration portal for maintaining inventory.

The system must be easy to operate by a single administrator and hosted entirely using free-tier cloud services.

---

# 2. Project Objectives

The website shall:

- Present Roadlink Automobiles professionally.
- Display available vehicles.
- Display detailed vehicle information.
- Allow visitors to contact via WhatsApp, phone or email.
- Allow the owner to easily manage stock.
- Require no coding knowledge to update inventory.
- Be optimized for search engines.
- Be mobile-first and responsive.

---

# 3. Guiding Principles

## 3.1 Public Website First

The public website defines the business requirements.

Admin Portal → Database → API must support the public website.

---

## 3.2 Simplicity

Whenever two solutions achieve the same objective, the simpler solution shall be preferred.

---

## 3.3 Free Hosting

Version 1 shall only use free services.

Approved technologies:

- GitHub
- Cloudflare Pages
- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2

---

## 3.4 User Roles & Access Control

The system supports exactly two user roles:

- **Admin**: Full system access, including managing security settings (e.g., session timeout value).
- **Manager**: Inventory management only. Managers cannot modify security settings.

No additional RBAC architecture should be introduced. There are no role tables or permission tables; roles are represented directly within the user record.

---

## 3.5 English Only

Version 1 will be English only.

Future multilingual support may be added without redesigning the system.

---

## 3.6 Single Source of Truth

No information shall be duplicated.

Company information shall exist only once.

Vehicle information shall exist only once.

Images shall exist only once.

SEO defaults shall exist only once.

---

# 4. Technology Stack

Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Hosted on GitHub and deployed through Cloudflare Pages as a static website

Backend
- Cloudflare Workers (handles REST API, authentication, validation, and metadata processing)

Database
- Cloudflare D1 (SQLite)

Image Storage
- Cloudflare R2

Source Control
- GitHub

Hosting
- Cloudflare Pages (Frontend)
- Cloudflare Workers (Backend API)

Development
- Google AI Studio
- ChatGPT

---

# 5. Public Website

## Pages

Home

Stock

Vehicle Details

404

Privacy Policy

Terms of Service

---

# 6. Home Page

Purpose

Introduce the company and highlight selected vehicles.

Sections

- Hero
- Featured Vehicles
- Why Choose Us
- WhatsApp CTA
- Contact
- Footer

Featured Vehicles

Displays selected vehicles only.

Filtering

Sourcing filtering matches the following categories. In the code, these correspond to lowercase values:

- `all` (All Stock)
- `sedan` (Sedans)
- `suv` (SUVs / Crossovers)

The full inventory is displayed only on the Stock page.

---

# 7. Stock Page

Purpose

Display all available inventory.

Features

Search

Filters

Sorting

Pagination (if required later)

Vehicle Cards

Each card displays:

- Cover Image
- Make
- Model
- Year
- Price
- Mileage
- Engine
- Transmission
- Auction Grade
- Status
- View Details

---

# 8. Vehicle Details Page

Purpose

Provide complete information about one vehicle.

Sections

Image Gallery

Vehicle Summary

Specifications

Features

Description

Auction Sheet (optional)

YouTube Video (optional)

WhatsApp CTA

Related Vehicles

---

# 9. Administration Portal

Pages

Login

Dashboard

Vehicles

Add Vehicle

Edit Vehicle

Settings

---

# 10. Business Rules

Cover image is simply the first exterior image (no separate poster image).

Unlimited exterior images.

Unlimited interior images.

Auction sheet is optional.

YouTube video is optional.

Prices are always displayed.

Display Order controls ordering.

Featured determines Home Page appearance.

Vehicle status controls website visibility.

---

# 11. Vehicle Status & Lifecycle

## 11.1 Business Status
Vehicles have one of the following active business statuses. In the database and codebase, these are stored as lowercase strings and are capitalized in the UI presentation layer:

- `available` (Available)
- `incoming` (Incoming)
- `reserved` (Reserved)
- `sold` (Sold)

The legacy `draft` status has been completely removed.

## 11.2 Publication Status (`is_published`)
Publication status is managed independently of the business status using a dedicated boolean/integer field:
- `is_published = true`: The vehicle is eligible for public display (provided it is not archived).
- `is_published = false`: The vehicle is a draft/hidden and is never shown on the public website.

## 11.3 Vehicle Lifecycle (`archived_at`)
Vehicles are never permanently deleted immediately by user action. Instead, deleting a vehicle archives it.
- **Representation**: A nullable UTC timestamp field named `archived_at` in the `vehicles` table represents this state:
  - `archived_at = NULL`: The vehicle is active.
  - `archived_at = <UTC_Timestamp>`: The vehicle is archived.
- **Rules for Archived Vehicles**:
  - Hidden from the public website.
  - Hidden from the default administrator/manager inventory view.
  - Retain all associated images and details.
  - Can be restored before automatic purge.
- **Do NOT introduce an "archived" status** in the core business status list; archiving is purely a lifecycle state.

## 11.4 Automatic Purging
- To prevent database bloat, the system automatically purges archived vehicles after a configurable retention period.
- The retention period is stored in the `settings` table as a key-value configuration (e.g., `archive_retention_days = 180`).
- A scheduled Cloudflare Worker Cron Trigger runs periodically to perform the purge.
- **The purge process permanently deletes**:
  - The vehicle record from the `vehicles` table.
  - Associated records in the `vehicle_images` table.
  - Actual image binary files stored in Cloudflare R2.
- Every purge operation must be recorded in the `activity_logs` table for administrative audit tracking.

## 11.5 Time Handling & Timezone Policies
- **Database Storage**: All timestamps (including `created_at`, `updated_at`, `archived_at`, `logged_at`) are generated and stored strictly in **Coordinated Universal Time (UTC)**.
- **UI Display**: The frontend displays all dates, times, and timelines adjusted to the **Asia/Dhaka (UTC+6)** timezone for local business operations in Bangladesh. Conversion is handled purely in the client rendering layer.

---

# 12. Vehicle Images Normalization

Images are stored and managed in a fully normalized manner inside the `vehicle_images` table.

## 12.1 Image Records Schema
Each image record contains exactly:
- `vehicle_id`: Foreign key referencing the `vehicles` table.
- `image_url`: Full URL path to the image stored in Cloudflare R2.
- `image_type`: Categorizes the asset type, limited to:
  - `exterior`: Outside photos of the vehicle.
  - `interior`: Inside cabin photos of the vehicle.
  - `auction`: Official auction sheet certificate images/PDFs.
- `display_order`: An integer defining the rendering sequence.

## 12.2 Cover Image Derivation
The application does **NOT** store a separate cover image field or cover image record in the database.
- The cover image is always dynamically derived as **the first exterior image** in the collection ordered by `display_order` (e.g., the lowest display_order where `image_type = 'exterior'`).
- The backend Cloudflare Worker maps normalized image records into the unified frontend vehicle data model dynamically, ensuring compatibility with the static client.
- There is no separate poster image. Images are stored in Cloudflare R2 and referenced via direct URLs. No image duplication is permitted.

---

# 13. SEO

Every page shall contain

Title

Description

Canonical URL

Open Graph

Twitter Cards

Structured Data

XML Sitemap

Robots.txt

---

# 14. Performance

Lazy loading

Responsive images

Image optimization

Minified assets

Fast page loading

---

# 15. Security & Database Architecture

## 15.1 Database Schema (LOCKED)
The system operates on an explicit, locked SQLite database structure inside Cloudflare D1 containing exactly the following tables. No additional tables or permission schemas (such as secondary role or permission mapping tables) are permitted:
- `users`: Stores user account records (id, username, password_hash, role, created_at, updated_at).
- `settings`: Stores global key-value configuration values (key, value, updated_at).
- `vehicles`: Stores vehicle core metadata, specifications, and status.
- `vehicle_images`: Stores related image URLs, types (exterior, interior, auction), and sorting display orders.
- `activity_logs`: Stores audit records for tracking administrative changes.

## 15.2 Authentication
The authentication architecture is completely fixed and server-authoritative:
- **Platform**: Login and credential validation are handled entirely by the Cloudflare Worker backend. The frontend remains a static website and never performs authentication or password validation logic itself.
- **Password Storage**: Passwords must never be stored in plaintext. They are strictly stored as secure, salted hashes using the **Argon2** password hashing algorithm.
- **Session Tokens**: Authentication uses signed **JSON Web Tokens (JWTs)**. These JWTs are validated strictly by the Cloudflare Worker.
- **Token Delivery**: Session JWTs are transmitted securely using **Secure, HttpOnly, and SameSite** cookies to protect against cross-site scripting (XSS) and cross-site request forgery (CSRF) attacks.
- **Session Timeout & Expiration**: Session timeout is enforced via standard JWT expiration.

## 15.3 Session Management & User Roles
- **Supported User Roles**:
  - `admin`: Full system access, including managing security configurations and global settings.
  - `manager`: Inventory management only. Permissions are intentionally limited.
- **Sliding Session Expiration**: Active users have their session lifetime extended automatically on interaction (sliding expiration), up to the maximum idle limit.
- **Configurable Session Timeout**: The session timeout limit is configurable and stored directly in the `settings` table as a key-value configuration pair (e.g., `session_timeout_minutes`).
- **Authorization Restraints**: The session timeout value is **NOT** editable from the frontend. Only users with the `admin` role can modify security configurations directly via authenticated backend API calls, while users with the `manager` role are strictly prohibited.

## 15.4 Core Security Principles
Every module and backend endpoint must strictly adhere to these principles:
- **Security-First & Secure by Default**: Active protection across all user interaction surfaces.
- **Principle of Least Privilege**: Managers can only perform inventory operations; configuration and user management are restricted to Admins.
- **Never Trust Client-Side Validation**: All validation must run securely within the Cloudflare Worker backend. Client-side checks are strictly for user experience.
- **Strict SQL Parameterization**: To eliminate SQL injection vulnerabilities, all queries run against Cloudflare D1 must use parameterized bindings. Plain text SQL string concatenation is forbidden.
- **Secret Separation**: Sensitive tokens, salts, and private keys must never be committed to source repositories. All credentials must be configured securely using Cloudflare Environment Secrets.
- **Audit Logging**: All administrative changes (adding/editing/deleting stock, modifying configurations, or logging in) must write a persistent record into the `activity_logs` table for compliance.

---

# 16. Future Enhancements

Bangla version

Vehicle comparison

Saved vehicles

Finance calculator

Vehicle enquiry form

Auction search

---

# 17. Development Roadmap

Phase 1
✔ Public Website

Phase 2
⬜ Admin Portal

Phase 3
⬜ Database

Phase 4
⬜ Worker API

Phase 5
⬜ Authentication

Phase 6
⬜ Production Deployment

---

# 18. Change Log

Version 1.0

Initial project specification.

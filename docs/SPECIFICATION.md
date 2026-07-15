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

## 3.4 Single Administrator

Version 1 supports only one administrator.

No user roles.

No staff accounts.

No customer accounts.

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

Backend
- Cloudflare Workers

Database
- Cloudflare D1 (SQLite)

Image Storage
- Cloudflare R2

Source Control
- GitHub

Hosting
- Cloudflare Pages

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

Poster (optional)

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

Exactly one cover image per vehicle.

Unlimited exterior images.

Unlimited interior images.

Poster is optional.

Auction sheet is optional.

YouTube video is optional.

Prices are always displayed.

Display Order controls ordering.

Featured determines Home Page appearance.

Vehicle status controls website visibility.

---

# 11. Vehicle Status

Vehicles have one of the following statuses. In the database and codebase, these are stored as lowercase strings; they are capitalized in the UI presentation layer:

- `draft` (Draft)
- `incoming` (Incoming)
- `available` (Available)
- `reserved` (Reserved)
- `sold` (Sold)

---

# 12. Images

Images are divided into:

Cover

Exterior

Interior

Poster

Cover image is selected from uploaded images.

Images are never duplicated.

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

# 15. Security

HTTPS only

Admin authentication

Server-side validation

Image validation

Worker API protection

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

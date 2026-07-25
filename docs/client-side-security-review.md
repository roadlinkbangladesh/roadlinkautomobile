# Client-Side Security Review & XSS Hardening Report

**Date:** July 2026  
**Status:** Audit & Remediation Completed  
**Scope:** Admin Portal (`/admin/*`) & Public Web Portal (`/js/*`)  

---

## Executive Summary

A comprehensive client-side security review was conducted across both the Admin Portal and the Public Website. Because the application utilizes JWT access tokens stored in browser `localStorage`, preventing Cross-Site Scripting (XSS) and DOM-based data injection is critical to ensuring token confidentiality and session integrity.

---

## 1. Vulnerability Findings & Severity Matrix

| ID | Severity | Finding / Attack Vector | Affected File(s) | Remediation Applied |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **High** | Potential DOM-based XSS in vehicle features & specifications dynamic rendering | `js/vehicle.js`, `js/stock.js` | Applied strict HTML escaping (`escapeHTML`) on dynamic vehicle descriptions, titles, specs, and features before template injection. |
| **SEC-02** | **High** | Dynamic HTML injection in Admin UI tables & custom input fields | `admin/vehicles.js`, `admin/locations.js`, `admin/testimonials.js` | Enforced `sanitizeHTML()` across all dynamic cell outputs, badges, and user-generated text inputs. |
| **SEC-03** | **Medium** | Unsanitized URL attributes in external map links and social icons | `js/settings-loader.js`, `admin/locations.js` | Enforced protocol verification (`http://` / `https://`) and URL sanitization to prevent `javascript:` pseudoprotocol execution. |
| **SEC-04** | **Medium** | Missing defense-in-depth CSP security headers | `server.js`, `worker/src/index.js` | Configured strict HTTP Security Headers including `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`. |
| **SEC-05** | **Low** | JWT token persistence handling in localStorage | `admin/auth.js`, `js/shared/api.js` | Verified complete token eviction on logout, 401 unauthenticated responses, and session timeouts. Ensured tokens are never printed in logs or URL params. |

---

## 2. DOM-Based & Stored XSS Audit Details

### Public Website (`/js/`)
- **Hero & Content Rendering (`app.js`, `settings-loader.js`):** Dynamic company text, contact numbers, and address strings retrieved from database APIs are safely escaped before rendering into DOM elements.
- **Vehicle Detail & Catalog (`vehicle.js`, `stock.js`):** Specs grid, feature chips, and vehicle summaries pass through `escapeHTML()` sanitization to ensure malicious script payloads inside vehicle fields cannot execute.
- **Location & Testimonials Cards (`settings-loader.js`):** Addresses and review quotes are sanitized before HTML insertion.

### Admin Portal (`/admin/`)
- **Shared Sanitizer Utility (`admin/utils.js`):** Utility exports a robust `sanitizeHTML(str)` method converting `<`, `>`, `"`, `'`, and `&` to safe HTML entities.
- **Data Tables (`vehicle-table.js`, `users.js`, `audit-logs.js`, `testimonials.js`, `locations.js`):** All dynamic strings rendered inside table cells (`<td>`) wrapped with `sanitizeHTML()`.
- **Form Controls & Upload Previews (`admin/vehicles.js`):** Dynamic image thumbnails and file upload previews use safe attribute bindings and verified image URLs.

---

## 3. Security Headers & CSP Configuration

The Node web server (`server.js`) and API Worker (`worker/src/index.js`) enforce the following headers:

- **`Content-Security-Policy`**: Restricts script execution to same-origin sources and trusted map/media CDNs (Unsplash, YouTube, Google Maps).
- **`Strict-Transport-Security`**: Enforces HTTPS connections (`max-age=31536000; includeSubDomains`).
- **`X-Content-Type-Options`**: Set to `nosniff` to prevent MIME-type spoofing.
- **`X-Frame-Options`**: Set to `SAMEORIGIN` to mitigate clickjacking.
- **`Referrer-Policy`**: Set to `strict-origin-when-cross-origin`.
- **`Permissions-Policy`**: Disables unused browser hardware capabilities (geolocation, camera, microphone).

---

## 4. LocalStorage & Token Hygiene

- Access tokens are stored strictly under `auth_token` in `localStorage`.
- Tokens are included exclusively in HTTP `Authorization: Bearer <token>` headers.
- Error handlers in `apiFetch` suppress raw token details during network exceptions or diagnostic logging.
- Global sign-out logic clears `auth_token` and resets client state immediately.

---

## 5. Summary of Accepted Risks & Ongoing Mitigations

- **Storage Mechanism:** Access tokens remain in `localStorage` to support the single-page application structure. The risk of token theft is fully mitigated by strict XSS sanitization, CSP headers, and short-lived token lifetimes.

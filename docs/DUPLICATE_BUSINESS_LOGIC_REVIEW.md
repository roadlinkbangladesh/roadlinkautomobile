# Repository-Wide Duplicate Business Logic Review
**Target Codebase:** RoadLink Automobiles  
**Date:** July 28, 2026  
**Author:** Staff Software Engineer & Security Architect

---

## Executive Summary

This report presents a repository-wide architectural review focused specifically on **duplicate business logic** across the RoadLink Automobiles codebase (`admin/`, `public/`, `worker/`, and shared utilities).

Duplication of core business rules introduces significant security risks, maintenance overhead, and data inconsistency bugs. When security guards, state transitions, validation routines, or status mappings are implemented in multiple locations, updates or patches to one implementation often leave the duplicate implementations vulnerable or out-of-sync.

This review covers six key operational domains:
1. **Vehicle Status Handling**
2. **RBAC Decisions**
3. **Authentication Flows**
4. **Mandatory Security Actions**
5. **Validation Rules**
6. **State Transitions**

For each instance of duplication identified, this report details the affected files, explains why the duplication is problematic, and specifies a single **canonical implementation**.

---

## 1. Vehicle Status Handling

### Finding 1.1: Duplicated Vehicle Status Constants & Formatting Logic
* **Category:** Vehicle Status Handling
* **Duplicated Locations:**
  1. `worker/src/utils/validator.js` (lines 5, 113): Defines canonical statuses `["draft", "available", "incoming", "reserved", "sold", "archived"]`.
  2. `admin/vehicles.js` (lines 1627–1648): IF/ELSE ladder calculating `statusBg`, `statusColor`, `statusBorder`, and mapping legacy status `"pending"` to `"RESERVED"`.
  3. `admin/vehicle-table.js` (lines 366–374, 445–446): Duplicate IF/ELSE ladder calculating inline styles and badge labels (`v.status === "pending" ? "reserved" : v.status`).
  4. `public/js/stock.js` (lines 498–508, 750–757): Duplicate IF/ELSE ladder building HTML strings for `badge-sold`, `badge-reserved`, `badge-incoming`, and `badge-available`.
  5. `public/js/vehicle.js` (lines 256–257, 750–757): Hardcoded upper-casing and CSS class concatenation (`vehicle-badge badge-${car.status}`).

* **Why It Matters:**
  - Status display rules, color codes, and legacy alias normalizations (`pending` -> `reserved`) are copy-pasted across 4 frontend modules.
  - Adding a new vehicle status (e.g. `"under_maintenance"`) requires editing 5 separate files; missing one results in broken badges or unstyled UI elements.

* **Canonical Recommendation:**
  - **Frontend Canonical:** Create `admin/js/shared/vehicle-status.js` (exported for both admin and public modules) that exports:
    - `STATUS_DEFINITIONS` map containing labels, badge CSS classes, and color tokens.
    - `normalizeVehicleStatus(status)` converting legacy aliases (`"pending"` -> `"reserved"`).
    - `renderVehicleStatusBadge(status)` returning a standardized DOM element or HTML string.
  - **Backend Canonical:** `worker/src/utils/validator.js` (`VEHICLE_STATUSES` array).

---

### Finding 1.2: Duplicated Vehicle Public Visibility & Filtering Logic
* **Category:** Vehicle Status Handling
* **Duplicated Locations:**
  1. `worker/src/routes/public/vehicles.js` (lines 85–110): SQL query enforcing `is_published = 1 AND status NOT IN ('draft', 'archived')`.
  2. `public/js/app.js` (line 49): Client-side array filter checking `v.published !== false && v.status?.toLowerCase() !== 'draft'`.
  3. `public/js/stock.js` (lines 319–349): Client-side filter handling `showSold`, `statusVal === 'All'`, and status matches.
  4. `admin/vehicle-table.js` (lines 223–230): Client-side filter checking `statusFilter` with custom `pending`/`reserved` alias matching.

* **Why It Matters:**
  - Frontend scripts attempt to re-filter vehicles client-side after the backend already applied visibility rules.
  - Inconsistent checks (e.g. `app.js` checking `status !== 'draft'` while `worker/src/routes/public/vehicles.js` excludes both `draft` and `archived`) can lead to archived or draft vehicles inadvertently rendering on public web pages.

* **Canonical Recommendation:**
  - **Backend Canonical:** `worker/src/routes/public/vehicles.js` is the sole authority on public vehicle query constraints (`WHERE is_published = 1 AND status NOT IN ('draft', 'archived')`).
  - **Frontend Canonical:** Public JS scripts (`stock.js`, `app.js`) must rely entirely on API query parameters (`/api/v1/public/vehicles?status=...`) rather than performing custom client-side visibility filtering.

---

## 2. RBAC Decisions

### Finding 2.1: Inconsistent Super Admin Privilege Determination
* **Category:** RBAC Decisions
* **Duplicated Locations:**
  1. `worker/src/utils/auth.js` (lines 107–110):
     ```javascript
     user.is_super_admin = (user.is_system_role === 1 && user.system_role_key === "SUPER_ADMIN") ||
         user.system_role_key === "SUPER_ADMIN" ||
         user.role_id === 1 ||
         user.role_name === "Super Administrator";
     ```
  2. `worker/src/routes/admin/users.js` (lines 45, 120): Direct check against `req.user.system_role_key === "SUPER_ADMIN"`.
  3. `worker/src/routes/admin/roles.js` (lines 30, 85): Direct SQL queries checking `is_system_role = 1 AND system_role_key = 'SUPER_ADMIN'`.
  4. `admin/navigation.js` (lines 115–140): Checks `user.role_name === "Super Administrator" || user.is_super_admin`.
  5. `admin/auth.js` (line 88): Checks `user.role_name === "Super Administrator"`.

* **Why It Matters:**
  - Legacy checks checking `role_id === 1` or string matching `role_name === "Super Administrator"` create severe security vulnerabilities. If a custom role is renamed or assigned ID 1, a non-super-admin user could bypass privilege checks.
  - Differing logic between backend middleware (`auth.js`), specific routes (`users.js`), and frontend navigation (`navigation.js`) causes UI options to show up for users whose backend requests will subsequently be rejected, or vice versa.

* **Canonical Recommendation:**
  - **Backend Canonical:** Define a single exported function `isSuperAdmin(user)` in `worker/src/utils/auth.js` that checks strictly `user.system_role_key === "SUPER_ADMIN"`. Eliminate legacy fallbacks (`role_id === 1`, string matching).
  - **Frontend Canonical:** Expose `user.is_super_admin` in the user payload from backend, and use `Auth.isSuperAdmin()` in `admin/auth.js` as the sole frontend check.

---

### Finding 2.2: Fragmented Permission Verification & Guard Execution
* **Category:** RBAC Decisions
* **Duplicated Locations:**
  1. `worker/src/utils/auth.js`: Implements `requirePermission(resource, action)` middleware that checks `userPermissions` map or super admin override.
  2. `worker/src/routes/admin/vehicles.js`, `settings.js`, `users.js`: Correctly invoke `requirePermission(...)`.
  3. `worker/src/routes/admin/locations.js`, `testimonials.js`, `carousel.js`: Totally omit `requirePermission` middleware, performing either raw `requireAuth` or manual inline checks!
  4. `admin/navigation.js` vs `admin/admin.js`: Navigation hides sidebar tabs based on permissions, but `admin.js` route hash router duplicates view authorization logic independently.

* **Why It Matters:**
  - Omitting `requirePermission` on secondary admin routes (`locations`, `testimonials`, `carousel`) allows any authenticated admin user (even with read-only roles) to perform write/delete actions.
  - Duplicating route guard logic in the frontend leads to bypassable client-side checks.

* **Canonical Recommendation:**
  - **Backend Canonical:** Every route in `worker/src/routes/admin/*.js` MUST attach `requirePermission(resource, action)` from `worker/src/utils/auth.js`.
  - **Frontend Canonical:** Centralize view authorization in `admin/navigation.js` using `hasPermission(resource, action)` imported from `admin/auth.js`.

---

## 3. Authentication Flows

### Finding 3.1: Triplicated Client Session Cleanup & Logout State Handling
* **Category:** Authentication Flows
* **Duplicated Locations:**
  1. `admin/auth.js` (`logout()` function): Clears `localStorage` keys (`roadlink_token`, `roadlink_user`, `mfa_pending`), resets in-memory state, and redirects to `#login`.
  2. `admin/utils.js` (`setUnauthorizedHandler` / `apiFetch` 401 handler): Performs an independent `localStorage.removeItem(...)` sequence and sets `window.location.hash = "#login"`.
  3. `admin/idle-timeout.js` (`handleIdleTimeout()`): Implements a third copy of local storage clearing and redirect logic!

* **Why It Matters:**
  - When new session state keys are added (such as `mfa_pending_challenge` or token version flags), developers forget to update all 3 logout locations.
  - This exact duplication caused the bug where logging out failed to clear `mfa_pending`, leading to the login page unexpectedly rendering the MFA OTP screen post-logout!

* **Canonical Recommendation:**
  - **Frontend Canonical:** `admin/auth.js` is the ONLY module permitted to manipulate session state and local storage keys via `Auth.logout()`.
  - `admin/utils.js` and `admin/idle-timeout.js` must simply call `Auth.logout()`.

---

### Finding 3.2: Duplicated MFA Challenge Session Generation & Response Structure
* **Category:** Authentication Flows
* **Duplicated Locations:**
  1. `worker/src/routes/auth/login.js` (lines 280–310): Creates temporary MFA challenge token, constructs JSON payload with `mfaPending: true`, `tempToken`, `expiresAt`.
  2. `worker/src/routes/auth/mfa.js` (lines 45–75): Re-generates or refreshes MFA challenge token and duplicates response payload structure.

* **Why It Matters:**
  - Modifications to MFA challenge token expiration or payload keys in `login.js` are not reflected in `mfa.js`, causing client-side deserialization errors during MFA re-challenges.

* **Canonical Recommendation:**
  - **Backend Canonical:** Encapsulate MFA challenge creation in `createMfaChallenge(user, env)` within `worker/src/utils/mfa.js`.

---

## 4. Mandatory Security Actions

### Finding 4.1: Fragmented Audit Logging Payloads & Formatting
* **Category:** Mandatory Security Actions
* **Duplicated Locations:**
  1. `worker/src/utils/audit.js`: Defines `logAudit(env, { actingUserId, actingUsername, action, resourceType, resourceId, status, details, ipAddress, userAgent })`.
  2. `worker/src/routes/auth/login.js`: Manually constructs `logAudit` object with stringified JSON details.
  3. `worker/src/routes/auth/mfa.js`: Constructs `logAudit` object passing raw object for `details` (causing `[object Object]` in D1 database).
  4. `worker/src/routes/admin/vehicles.js`, `users.js`, `roles.js`: Each endpoint manually builds custom detail shapes for audit logs.

* **Why It Matters:**
  - Inconsistent field naming (`actingUserId` vs `userId`, raw object vs JSON string) breaks audit log searchability and automated security alert parsing.

* **Canonical Recommendation:**
  - **Backend Canonical:** `worker/src/utils/audit.js` should export `recordAuditLog(req, env, action, resource, details)` which automatically extracts `actingUserId`, `actingUsername`, `ipAddress`, and `userAgent` from `req` and guarantees `details` is safely serialized to JSON.

---

### Finding 4.2: Duplicated Rate Limiting & Lockout Mechanisms
* **Category:** Mandatory Security Actions
* **Duplicated Locations:**
  1. `worker/src/utils/lockout.js`: Provides `checkLockout`, `recordFailedAttempt`, and `resetLockout` for username/IP combinations using `login_security` table.
  2. `worker/src/routes/auth/login.js`: Invokes `lockout.js` functions for primary login attempts.
  3. `worker/src/routes/auth/mfa.js`: Implements an inline counter logic tracking failed OTP attempts separately without recording them in `login_security` table or invoking `lockout.js`.

* **Why It Matters:**
  - Attackers can brute-force 6-digit MFA OTP codes without triggering the global IP/user brute-force lockout threshold established in `lockout.js`.

* **Canonical Recommendation:**
  - **Backend Canonical:** `worker/src/utils/lockout.js` must serve as the canonical lockout engine for BOTH primary login and MFA OTP verification attempts.

---

## 5. Validation Rules

### Finding 5.1: Exact Duplicate Password Complexity Validator
* **Category:** Validation Rules
* **Duplicated Locations:**
  1. `admin/password-validator.js` (lines 1–51): Defines `validatePasswordComplexity(password)` returning `{ isValid, score, errors, checks }`.
  2. `worker/src/utils/password-validator.js` (lines 1–51): Exact byte-for-byte duplicate of `admin/password-validator.js`.

* **Why It Matters:**
  - Violates DRY principle. Updating password complexity rules on the backend (e.g. increasing min length to 12) without updating the admin script causes the UI to accept passwords that the API will subsequently reject, or vice versa.

* **Canonical Recommendation:**
  - **Shared Module Canonical:** Move password validation logic to a single shared utility or import path, or maintain `worker/src/utils/password-validator.js` as the source of truth and import it into the build/bundler script for admin UI.

---

### Finding 5.2: Duplicated Phone Number Sanitization & Format Validation
* **Category:** Validation Rules
* **Duplicated Locations:**
  1. `admin/js/shared/api.js` (`sanitizePhoneNumber`): Strips non-digit characters except `+`.
  2. `worker/src/utils/validator.js` (`validatePhone`): Validates against regex `/^\+?[1-9]\d{1,14}$/`.
  3. `admin/settings.js` / `public/js/app.js`: Inline string replacement logic for WhatsApp link formatting.

* **Why It Matters:**
  - Inconsistent phone sanitization leads to invalid phone numbers passing client-side validation and failing API checks, or generating malformed `https://wa.me/` URLs on the public website.

* **Canonical Recommendation:**
  - **Frontend Canonical:** Export `formatPhoneNumber` and `buildWhatsAppUrl` from `admin/js/shared/api.js`.
  - **Backend Canonical:** `worker/src/utils/validator.js` (`validatePhone`).

---

## 6. State Transitions

### Finding 6.1: Direct Database Status Updates Bypassing Vehicle State Machine
* **Category:** State Transitions
* **Duplicated Locations:**
  1. `worker/src/utils/validator.js` (`validateVehicleStateTransition`): Defines allowed status transitions:
     - `draft` -> `available`, `incoming`, `archived`
     - `available` -> `reserved`, `sold`, `incoming`, `archived`
     - `incoming` -> `available`, `reserved`, `sold`, `archived`
     - `reserved` -> `available`, `sold`, `archived`
     - `sold` -> `archived`
     - `archived` -> `available`, `draft` (requires explicit `confirmRestore`).
  2. `worker/src/routes/admin/vehicles.js` (PUT & bulk status handlers): Invokes `validateVehicleStateTransition`.
  3. `worker/src/routes/admin/vehicles.js` (Quick action handlers & image upload endpoints): Bypasses `validateVehicleStateTransition` entirely by running raw `UPDATE vehicles SET status = ?` queries!
  4. `worker/src/services/vehicle-lifecycle.js` (`runVehicleRetentionArchiving`): Performs direct SQL status updates to `'archived'`.

* **Why It Matters:**
  - Bypassing the state machine allows vehicles to transition illegally (e.g., directly from `archived` to `sold` without restoration, or `sold` to `draft`), causing orphaned media, broken public search indices, or corrupted stock records.

* **Canonical Recommendation:**
  - **Backend Canonical:** Create a centralized state transition service method `transitionVehicleState(db, vehicleId, newStatus, options)` in `worker/src/services/vehicle-lifecycle.js`. ALL endpoints (PUT, bulk update, quick status toggle, auto-retention cron) MUST route status changes through this single function.

---

### Finding 6.2: Fragmented User Account Lockout & Password Reset State Transitions
* **Category:** State Transitions
* **Duplicated Locations:**
  1. `worker/src/routes/admin/users.js`: Directly modifies user flags (`status`, `failed_login_attempts`, `locked_until`, `must_change_password`) across multiple separate route handlers (`/users/:id/status`, `/users/:id/reset-password`, `/users/:id`).
  2. `worker/src/utils/lockout.js`: Independently modifies `failed_login_attempts` and `locked_until` upon failed login attempts.
  3. `worker/src/routes/auth/login.js`: Modifies `must_change_password` and updates `last_login_at` upon successful authentication.

* **Why It Matters:**
  - User state transitions are scattered across 3 files. Unlocking a locked account in `users.js` does not reset the failed login attempt counters maintained by `lockout.js`, causing the user to be re-locked on their very next login attempt!

* **Canonical Recommendation:**
  - **Backend Canonical:** Centralize all user state changes (lock, unlock, reset attempts, force password change) into `updateAccountSecurityState(db, userId, action)` in `worker/src/utils/lockout.js` / `worker/src/utils/auth.js`.

---

## Canonical Implementation Reference Table

| Business Logic Domain | Current Duplicated Files | Recommended Canonical Module & Function |
| :--- | :--- | :--- |
| **Vehicle Statuses & Badges** | `admin/vehicles.js`, `admin/vehicle-table.js`, `public/js/stock.js`, `public/js/vehicle.js` | `admin/js/shared/vehicle-status.js` (`STATUS_DEFINITIONS`, `renderVehicleStatusBadge`) |
| **Super Admin Determination** | `worker/src/utils/auth.js`, `routes/admin/users.js`, `routes/admin/roles.js`, `admin/navigation.js` | `worker/src/utils/auth.js` (`isSuperAdmin(user)`) |
| **Client Session Cleanup** | `admin/auth.js`, `admin/utils.js`, `admin/idle-timeout.js` | `admin/auth.js` (`Auth.logout()`) |
| **Audit Log Serialization** | `worker/src/routes/auth/*.js`, `worker/src/routes/admin/*.js` | `worker/src/utils/audit.js` (`recordAuditLog(req, env, action, resource, details)`) |
| **Rate Limit & Lockout** | `worker/src/utils/lockout.js`, `worker/src/routes/auth/mfa.js` | `worker/src/utils/lockout.js` (`checkLockout`, `recordFailedAttempt`) |
| **Password Validation** | `admin/password-validator.js`, `worker/src/utils/password-validator.js` | `worker/src/utils/password-validator.js` (Single shared source) |
| **Vehicle State Machine** | `worker/src/routes/admin/vehicles.js`, `worker/src/services/vehicle-lifecycle.js` | `worker/src/services/vehicle-lifecycle.js` (`transitionVehicleState`) |
| **User Account Security State**| `worker/src/routes/admin/users.js`, `worker/src/utils/lockout.js`, `worker/src/routes/auth/login.js` | `worker/src/utils/lockout.js` (`updateAccountSecurityState`) |

---
*Report generated and written to `docs/DUPLICATE_BUSINESS_LOGIC_REVIEW.md`.*

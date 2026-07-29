# System Architecture Document (High-Level Design)

## 1. System Purpose and Scope

**Roadlink Automobiles** is an enterprise-grade automobile dealership management system and public web application. It provides a full-stack platform designed to manage vehicle inventory, media assets, sales status workflows, system user accounts, role-based access control (RBAC), multi-factor authentication (MFA), administrative settings, security audit logs, and public inventory presentation.

The platform serves two primary audiences:
1. **Public Website Visitors**: Prospective vehicle buyers searching, filtering, and viewing published vehicle details, vehicle image galleries, business locations, and auction sheets.
2. **Dealership Administrators and Managers**: Authenticated staff managing vehicle inventory, updating vehicle lifecycle statuses, uploading media assets, configuring platform settings, running maintenance jobs, and managing user roles and permissions.

---

## 2. Overall Architecture

The system utilizes an edge-first, serverless full-stack architecture deployed on Cloudflare Workers, backed by Cloudflare D1 (serverless relational database) and Cloudflare R2 (distributed object storage). The client interface consists of two distinct Single-Page Applications (SPAs): the Admin Portal and the Public Website.

```
+-------------------------------------------------------------------------------+
|                                CLIENT LAYER                                   |
|   +------------------------------------+ +--------------------------------+   |
|   |         Public Website SPA         | |        Admin Portal SPA        |   |
|   |      (HTML5 / JS / Tailwind)       | |     (HTML5 / JS / Tailwind)    |   |
+---+------------------------------------+-+--------------------------------+---+
                                   |
                                   | HTTPS / REST API
                                   v
+-------------------------------------------------------------------------------+
|                      SERVERLESS EDGE COMPUTING LAYER                          |
|                             Cloudflare Worker                                 |
|                                                                               |
|  +-------------------------------------------------------------------------+  |
|  |                           Router & Middleware                           |  |
|  |           (Regex Routing, CORS, Security Headers, Preflight)            |  |
|  +-------------------------------------------------------------------------+  |
|                                   |                                           |
|  +-------------------------------------------------------------------------+  |
|  |                    Authentication & Security Engine                     |  |
|  |    (JWT Validation, PBKDF2 Hashing, MFA TOTP, Lockout, RBAC Guard)      |  |
|  +-------------------------------------------------------------------------+  |
|                                   |                                           |
|  +-------------------------------------------------------------------------+  |
|  |                           Domain Services                               |  |
|  |  (VehicleService, PlatformConfigService, Lifecycle, Orphan Cleanup)   |  |
|  +-------------------------------------------------------------------------+  |
|                                   |                                           |
|  +-------------------------------------------------------------------------+  |
|  |                          Repository Layer                               |  |
|  |                        (VehicleRepository)                              |  |
|  +-------------------------------------------------------------------------+  |
+-----------------------------------|-------------------------------------------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
+---------------------------------------+ +-------------------------------------+
|        DATA PERSISTENCE LAYER         | |         OBJECT STORAGE LAYER        |
|             Cloudflare D1             | |             Cloudflare R2           |
|     (Serverless SQLite Database)      | |      (Images & Auction Sheets)      |
+---------------------------------------+ +-------------------------------------+
```

---

## 3. Major Components

### 3.1 Edge Router and HTTP Dispatcher (`worker/src/index.js`)
* Provides lightweight, zero-dependency URL routing using exact and parameterized regex matching.
* Handles CORS preflight (`OPTIONS`) and applies security headers across all API responses.
* Routes requests to specialized handler modules in `routes/public`, `routes/auth`, and `routes/admin`.

### 3.2 Authentication & Security Module (`worker/src/utils/auth.js`, `jwt.js`, `password.js`, `mfa.js`, `lockout.js`)
* Executes server-authoritative JWT token validation using `HS256`.
* Enforces session freshness by validating token versions against active database user records (`token_version`).
* Handles password hashing via PBKDF2-HMAC-SHA256 (100,000 iterations).
* Evaluates Multi-Factor Authentication (MFA) TOTP tokens (RFC 6238) and single-use backup codes.
* Enforces mandatory security actions (forced password change or MFA setup) before allowing access to protected resources.
* Tracks account and IP failed login attempts to execute automated account lockouts.

### 3.3 Domain Services Layer (`worker/src/services/`)
* **`VehicleService`**: Enforces core vehicle business rules (status validation, image limits, price rules, duplicate stock/slug prevention, featured vehicle position reordering).
* **`PlatformConfigService`**: Loads strongly-typed platform policies from D1 with in-memory caching and fallback bounds.
* **`VehicleLifecycleService`**: Manages retention auto-archiving of sold vehicles and media purging.
* **`OrphanCleanupService`**: Scans R2 object storage for unreferenced media assets and purges them based on retention thresholds.
* **`VehicleMapper`**: Converts raw database records to API domain models.

### 3.4 Data Persistence Layer (`worker/src/repositories/vehicle-repository.js`)
* Encapsulates all SQL query execution against Cloudflare D1.
* Uses parameterized prepared statements (`db.prepare().bind()`) to prevent SQL injection.

### 3.5 Storage Layer (`worker/src/utils/storage.js`)
* Integrates with Cloudflare R2 object storage for binary media management (vehicle images, auction sheet PDFs, company logos).
* Enforces key structure conventions: `uploads/{companySlug}/vehicles/{stockNumber}/{subfolder}/{uuid}`.

---

## 4. Deployment Architecture

The application is deployed to Cloudflare's serverless edge network:
* **Worker Execution**: Worker code runs within V8 isolates distributed globally across Cloudflare edge locations, ensuring low-latency request execution without server management.
* **Database Deployment**: Cloudflare D1 provides distributed SQLite query processing at the edge with strong consistency.
* **Storage Deployment**: Cloudflare R2 provides S3-compatible object storage for binary assets, accessible directly by Workers.

---

## 5. Technology Stack

| Layer | Technology / Specification |
| :--- | :--- |
| **Runtime Environment** | Cloudflare Workers (JavaScript ES Modules, V8 Isolates) |
| **Database** | Cloudflare D1 (Serverless Relational SQLite) |
| **Object Storage** | Cloudflare R2 (S3-Compatible Storage) |
| **Backend Language** | JavaScript (ES2022+) |
| **Cryptography** | Web Crypto API (`crypto.subtle`) — PBKDF2-HMAC-SHA256, HMAC-SHA1, HMAC-SHA256 |
| **Frontend Framework** | Vanilla JavaScript (Modular ES6), HTML5, Tailwind CSS |

---

## 6. High-Level Data Flow

```
1. Client Sends Request
   └─► HTTPS request with optional "Authorization: Bearer <JWT>" header.

2. Edge Worker Router
   └─► Matches route pattern & HTTP method in worker/src/index.js.

3. Authentication & Permission Guard
   ├─► Verifies JWT signature and expiry.
   ├─► Checks token_version in D1 users table.
   ├─► Verifies no pending Mandatory Security Action (or routes to allowed security handler).
   └─► Checks role_permissions in D1 for required permission key.

4. Domain Service Execution
   ├─► Loads platform policy bounds via PlatformConfigService.
   ├─► Enforces business invariants (e.g., non-archivable featured vehicles).
   └─► Invokes VehicleRepository for D1 query execution.

5. Data Persistence / Object Storage
   ├─► D1 executes SQL transaction / query.
   └─► R2 handles file reads/writes if media upload/download is requested.

6. Response Mapping & Serialization
   ├─► VehicleMapper transforms database rows to camelCase domain models.
   └─► Response helper generates JSON response with CORS & security headers.
```

---

## 7. Authentication Architecture

Authentication is stateless at the HTTP transport level and validated server-side against D1 state:
* **JSON Web Tokens (JWT)**: Signed using `HS256` with a server-side `JWT_SECRET`. Tokens embed `id`, `username`, `email`, `role_id`, `token_version`, and `scope`.
* **Session Types**:
  * **Standard Session**: 8-hour expiry.
  * **Remember Me Session**: 30-day expiry.
* **Instant Session Revocation**: Every user record includes a `token_version` counter. Upon password resets, MFA changes, or explicit administrative logout, `token_version` is incremented in D1, invalidating all issued JWTs across all devices.
* **Multi-Factor Authentication (MFA)**: Built on Time-based One-Time Passwords (TOTP, RFC 6238). Enrolls users with a 32-character base32 secret and key URI, confirmed via a 6-digit TOTP token, and generates 8 single-use emergency backup codes stored as PBKDF2 hashes.

---

## 8. Authorization Model

Authorization uses a granular Role-Based Access Control (RBAC) model:
* **Permissions**: String keys representing specific actions (e.g., `vehicles.read`, `vehicles.create`, `vehicles.edit`, `vehicles.delete`, `users.create`, `roles.edit`).
* **Roles**: Custom roles stored in table `roles` with mappings in `role_permissions`.
* **Super Administrator Exemption**: System role `SUPER_ADMIN` (or role with `is_system_role = 1`) bypasses explicit permission key checks.
* **Role Privilege Hierarchy Guard (`isStrictlyLessPrivileged`)**: Prevents non-Super Admin users from creating, modifying, or deleting users/roles that have equal or greater privileges than their own role.

---

## 9. High-Level Security Architecture

1. **Defense-in-Depth**: Every input is validated at the API boundary before execution.
2. **Brute-Force & Lockout Protection**: Failed login attempts are tracked per user account and per IP address in D1. Exceeding thresholds triggers account lockouts for 15 minutes.
3. **Mandatory Security Actions**: New accounts or accounts requiring security updates (e.g., forced password change or MFA enrollment) are issued restricted-scope JWT tokens (`mandatory_security_action_pending`). Access to general administrative API endpoints is blocked until the required security action is completed.
4. **Audit Logging**: All security-critical events (login, logout, user creation, vehicle modification, status changes, setting updates) write immutable records to table `audit_logs`.
5. **Content Security & Framing Policies**: Auction sheet PDF serving enforces strict Content Security Policy (CSP) framing rules (`X-Content-Type-Options: nosniff`, framing headers) to prevent clickjacking and unauthorized embedding.

---

## 10. Trust Boundaries

```
+-------------------------------------------------------------------------+
| UNTRUSTED ZONE: Public Web Browsers / Client Applications               |
+-------------------------------------------------------------------------+
                                    |
                  API Boundary (HTTPS, CORS, Sanitization)
                                    v
+-------------------------------------------------------------------------+
| TRUSTED ZONE: Cloudflare Worker Runtime Environment                     |
| - Authentication Middleware                                             |
| - Permission Verification                                               |
| - Domain Services & Business Rules                                      |
+-------------------------------------------------------------------------+
                                    |
               Internal Cloudflare Bindings (env.DB, env.R2)
                                    v
+-------------------------------------------------------------------------+
| INFRASTRUCTURE ZONE: Cloudflare D1 & Cloudflare R2                      |
+-------------------------------------------------------------------------+
```

---

## 11. Storage Architecture

### 11.1 Relational Database (Cloudflare D1)
* `vehicles`: Primary vehicle inventory records.
* `vehicle_images`: Vehicle image metadata, order, and storage URLs.
* `users`: System user credentials, lockout state, token version, and MFA settings.
* `roles` & `role_permissions`: RBAC roles and assigned permission keys.
* `audit_logs`: Immutable security audit log records.
* `settings`: Administrative site settings.
* `platform_configuration`: System operational parameters (image size limits, lockout thresholds, retention periods).
* `locations`, `carousel_slides`, `testimonials`: Site management entities.

### 11.2 Object Storage (Cloudflare R2)
* **Vehicle Images**: High-resolution exterior and interior vehicle photographs stored as JPEG/PNG/WebP assets.
* **Auction Sheets**: Vehicle inspection and condition report PDFs.
* **Branding Assets**: Company logos and favicons.

---

## 12. Background Jobs

Automated background maintenance is exposed via the administrative endpoint `POST /api/v1/admin/maintenance/run`:
1. **Retention Archiving (`VehicleLifecycleService`)**: Identifies vehicles in `sold` status updated prior to `archive_after_months` threshold, updates their status to `archived`, un-features and un-publishes them, and purges all associated R2 media assets (images and auction sheets).
2. **Orphan Storage Cleanup (`OrphanCleanupService`)**: Scans the R2 storage bucket for media objects, checks active database references in `vehicles`, `vehicle_images`, `settings`, and `carousel_slides`, and permanently deletes unreferenced orphan files older than `orphan_cleanup_days`.

---

## 13. Key Architectural Principles

1. **Server-Authoritative Enforcement**: Client-side state is treated as untrusted; all business rules, permissions, and status transitions are validated on the backend.
2. **Single Responsibility & Layered Clean Architecture**: Strict separation between Routing, Business Logic Services, Persistence Repositories, and Data Mappers.
3. **Fail-Closed Security**: Any ambiguity in permission checks, token verification, or mandatory security actions defaults to denying access.
4. **Storage Efficiency**: Automated lifecycle purging removes high-volume binary assets for archived inventory, conserving R2 storage.

---

## 14. Non-Functional Characteristics

* **Low Latency**: Edge-based routing and query processing deliver responses near the user location.
* **Scalability**: Auto-scaling Cloudflare Workers isolates handle variable traffic spikes without server provisioning.
* **Security & Compliance**: Passwords are never stored in plaintext; audit trails track all user actions.

---

## 15. Architectural Constraints for Future Development

Future development must adhere to the following constraints:
1. **Preserve D1 Database Compatibility**: Schema updates must maintain compatibility with existing SQLite D1 instances and avoid destructive data migrations.
2. **Preserve REST API Contracts**: Standardized API response structures (`{ success, data, message }`) and status codes must be maintained.
3. **Zero Native Binary Node Dependencies**: Backend code must remain compatible with Cloudflare Worker V8 isolates and standard Web APIs.
4. **No Direct Database Access in Routes**: Route handlers must delegate business logic and data queries to Services and Repositories.

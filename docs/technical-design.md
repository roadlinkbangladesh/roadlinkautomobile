# Technical Design Document (Low-Level Design)

## 1. Repository Structure & Module Organisation

The codebase is organized into serverless backend worker components, public and administrative frontend single-page applications, and project configuration:

```
├── worker/                           # Cloudflare Worker Backend Root
│   ├── src/
│   │   ├── config/
│   │   │   └── constants.js          # Static application constants (API prefixes, status codes, limits)
│   │   ├── repositories/
│   │   │   └── vehicle-repository.js # Database query & persistence layer for vehicle domain
│   │   ├── routes/
│   │   │   ├── admin/                # Admin Portal protected API route handlers
│   │   │   │   ├── audit_logs.js
│   │   │   │   ├── carousel.js
│   │   │   │   ├── locations.js
│   │   │   │   ├── maintenance.js
│   │   │   │   ├── roles.js
│   │   │   │   ├── settings.js
│   │   │   │   ├── testimonials.js
│   │   │   │   ├── users.js
│   │   │   │   └── vehicles.js
│   │   │   ├── auth/                 # Authentication & MFA route handlers
│   │   │   │   ├── login.js
│   │   │   │   └── mfa.js
│   │   │   └── public/               # Public-facing API route handlers
│   │   │       ├── carousel.js
│   │   │       ├── locations.js
│   │   │       ├── settings.js
│   │   │       ├── testimonials.js
│   │   │       └── vehicles.js
│   │   ├── services/                 # Domain Services & Business Logic Layer
│   │   │   ├── orphan-cleanup.js     # Storage orphan cleanup job logic
│   │   │   ├── platform-config.js    # Strongly-typed system policy management with D1 fallback
│   │   │   ├── vehicle-lifecycle.js  # Retention auto-archiving & media purging
│   │   │   ├── vehicle-mapper.js     # Database row to domain API object mapper
│   │   │   └── vehicle-service.js    # Vehicle domain business rules & orchestration
│   │   ├── utils/                    # Core cross-cutting utility modules
│   │   │   ├── audit.js              # Audit logging helper
│   │   │   ├── auth.js               # Authentication & authorization middleware
│   │   │   ├── jwt.js                # Web Crypto JWT token signing and verification
│   │   │   ├── lockout.js            # Account and IP login lockout tracking
│   │   │   ├── map-helper.js         # Navigation map URL helpers
│   │   │   ├── mfa.js                # TOTP secret generation, QR generation, backup code hashing
│   │   │   ├── password-validator.js # Password complexity validator
│   │   │   ├── password.js           # PBKDF2 Web Crypto password hashing
│   │   │   ├── response.js           # Standardized HTTP JSON response builders & CORS headers
│   │   │   ├── storage.js            # Cloudflare R2 object storage operations
│   │   │   └── validator.js          # Pure data validation helper routines
│   │   └── index.js                  # Worker entry point, HTTP dispatcher & regex router
├── admin/                            # Admin Portal Frontend Application Source
├── js/                               # Public Website Frontend Application Source
├── docs/                             # System Documentation Baseline
├── package.json                      # Project dependencies and deployment scripts
└── wrangler.toml                     # Cloudflare Worker configuration & D1/R2 bindings
```

---

## 2. Layered Architecture & Component Responsibilities

The system adheres to a strict multi-layer architecture where each layer has clearly separated responsibilities:

```
+-------------------------------------------------------------------------+
|                              ROUTE LAYER                                |
|  - Parses HTTP requests & extracts path/query parameters                |
|  - Triggers authentication middleware (authenticate)                   |
|  - Invokes Service Layer methods                                        |
|  - Translates Domain Errors into HTTP Response JSON                     |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                             SERVICE LAYER                               |
|  - Implements all domain business rules & invariants                    |
|  - Enforces system platform policies (PlatformConfigService)            |
|  - Coordinates transactions and audit logging                           |
|  - Invokes Repository Layer for persistence                             |
+-------------------------------------------------------------------------+
                                    |
                  +-----------------+-----------------+
                  |                                   |
                  v                                   v
+-----------------------------------+   +---------------------------------+
|         REPOSITORY LAYER          |   |          MAPPER LAYER           |
|  - Formulates prepared SQL        |   |  - Transforms DB snake_case     |
|  - Binds parameters & runs D1     |   |    rows into camelCase domain   |
|  - Returns raw DB records/counts  |   |    objects for API output       |
+-----------------------------------+   +---------------------------------+
```

### 2.1 Route Layer (`routes/`)
* Extracts HTTP method, query parameters, path variables, and JSON request bodies.
* Invokes `authenticate(request, env, requiredPermission)` middleware for protected routes.
* Delegates domain logic execution to Service modules.
* Formats responses using `response.js` helpers (`success`, `created`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `serverError`).
* Contains **zero SQL queries** and **zero business rule logic**.

### 2.2 Service Layer (`services/`)
* **`VehicleService`**: Implements business invariants for inventory management:
  * Ensures stock numbers and slugs are unique.
  * Validates status transitions (`available`, `incoming`, `reserved`, `sold`, `archived`).
  * Prevents archiving of featured vehicles (`is_featured = 1`).
  * Automatically reorders featured vehicle positions (1, 2, 3...) when items are added, removed, or updated.
  * Enforces maximum image upload counts per vehicle based on `PlatformConfigService`.
  * Logs administrative operations via `logAudit`.
* **`PlatformConfigService`**: Loads configuration settings from the `platform_configuration` table in D1, applies strict numeric and boundary validation bounds, and caches values in memory (1-minute TTL).
* **`VehicleLifecycleService`**: Manages automated vehicle retention policies, identifying sold vehicles past retention limits, setting status to `archived`, and purging media from R2 storage.
* **`OrphanCleanupService`**: Periodically reconciles keys in Cloudflare R2 against active URLs stored in D1 database tables, deleting unreferenced files older than `orphan_cleanup_days`.

### 2.3 Repository Layer (`repositories/`)
* **`VehicleRepository`**: Encapsulates all SQL interactions with Cloudflare D1 for the `vehicles` and `vehicle_images` tables.
* Executes prepared statements (`db.prepare().bind()`).
* Provides standardized queries: `findVehicleByIdOrStock`, `findVehicles`, `countVehicles`, `createVehicleRecord`, `updateVehicleRecord`, `deleteVehicleRecord`, `findVehicleImages`, `insertVehicleImage`, `deleteVehicleImages`.

### 2.4 Mapper Layer (`services/vehicle-mapper.js`)
* Transforms raw database rows (snake_case columns, 0/1 integer flags) into clean, type-safe camelCase domain objects.
* Formats vehicle image collections into exterior and interior image structures.
* Generates relative API paths for protected asset streaming (e.g. auction sheets).

### 2.5 Validator Layer (`utils/validator.js`, `password-validator.js`)
* Pure validation functions:
  * VIN format validation.
  * Stock number formatting.
  * Year/Price numeric bounds validation.
  * Password complexity verification (length, uppercase, lowercase, numbers, special characters).

### 2.6 Utility Layer (`utils/`)
* **`auth.js`**: Centralized authentication, session validation against `token_version`, mandatory security action detection, RBAC permission verification, and role hierarchy check (`isStrictlyLessPrivileged`).
* **`jwt.js`**: HMAC-SHA256 JWT creation and parsing using Web Crypto API.
* **`password.js`**: Key derivation via PBKDF2-HMAC-SHA256 (100,000 iterations).
* **`mfa.js`**: TOTP generation (RFC 6238), QR code URL generation, backup code hashing and single-use verification.
* **`lockout.js`**: Tracks failed attempts per account and IP in D1, enforcing 15-minute temporary lockouts.
* **`storage.js`**: Object storage interface for Cloudflare R2 bucket (`put`, `get`, `delete`).
* **`response.js`**: Standardized JSON response generation, CORS header construction, and CSP header injection.

---

## 3. Security Implementation Details

### 3.1 Authentication & Token Lifecycle
1. User provides credentials to `POST /api/v1/auth/login`.
2. Password hash verified using PBKDF2-HMAC-SHA256 with stored salt.
3. System checks for account or IP lockout in table `users`.
4. If MFA is enabled or required, login returns a temporary scope (`mfa_pending`) requiring a secondary call to `POST /api/v1/auth/mfa/verify`.
5. If mandatory security actions (e.g. forced password change or initial MFA setup) are required, a token with scope `mandatory_security_action_pending` is issued.
6. Upon full authentication, a standard JWT (8-hour expiry) or Remember Me JWT (30-day expiry) is returned.
7. Every protected API request invokes `authenticate()`, which retrieves the user's active record from D1 and verifies that `decoded.token_version === user.token_version`. If an admin resets password or revokes sessions, `token_version` is incremented, immediately invalidating all outstanding tokens.

### 3.2 Role-Based Access Control (RBAC) & Hierarchy Protection
* Endpoint handlers specify required permissions (e.g., `vehicles.create`).
* `authenticate()` verifies if `user.permissions` includes the required key or if `user.is_super_admin` is true.
* **Hierarchy Enforcement (`isStrictlyLessPrivileged`)**: When an administrative user attempts to create, update, or delete another user or role, `isStrictlyLessPrivileged(env, actingUserRoleId, targetRoleId)` is evaluated. A user cannot edit or create a role/user with equal or higher privileges than their own.

```
Super Administrator (SUPER_ADMIN)
      │
      ▼
Custom Administrative Roles (Admin, Manager, etc.)
      │  (Evaluated via permission subset checking)
      ▼
Lower-Privilege Roles
```

---

## 4. Error Handling & Domain Errors

The application uses custom domain errors to signal business rule violations:

```javascript
export class VehicleServiceError extends Error {
  constructor(message, type = "BAD_REQUEST") {
    super(message);
    this.name = "VehicleServiceError";
    this.type = type; // "BAD_REQUEST", "NOT_FOUND", "FORBIDDEN", "CONFLICT"
  }
}
```

### Route-Level Exception Mapping
Route handlers wrap service calls in `try ... catch` blocks and map domain error types to standard HTTP response builders:
* `BAD_REQUEST` -> `badRequest(error.message)` (HTTP 400)
* `NOT_FOUND` -> `notFound(error.message)` (HTTP 404)
* `FORBIDDEN` -> `forbidden(error.message)` (HTTP 403)
* `CONFLICT` -> `conflict(error.message)` (HTTP 409)
* Uncaught Errors -> `serverError("Internal server error.")` (HTTP 500)

---

## 5. Major Workflows

### 5.1 Vehicle Domain Management Workflow

```
[ Admin User ]
      │
      ▼  POST /api/v1/admin/vehicles
[ Route: createAdminVehicle ]
      │
      ▼  authenticate(request, env, "vehicles.create")
[ Auth Middleware ] ──(Validates JWT, token_version, permissions)
      │
      ▼  VehicleService.createVehicle(env, data, auditContext)
[ Service Layer ]
      ├─► Loads bounds via PlatformConfigService
      ├─► Validates data invariants (year, price, stock uniqueness)
      ├─► Auto-generates unique slug
      ├─► Reorders featured position if is_featured = 1
      ├─► VehicleRepository.createVehicleRecord(env.DB, ...)
      ├─► VehicleRepository.insertVehicleImage(env.DB, ...)
      └─► logAudit(env, "CREATE_VEHICLE")
      │
      ▼  VehicleMapper.mapDbToVehicle(row, images)
[ Response ] ──► 201 Created JSON
```

### 5.2 File Upload & Media Management

1. Client sends `multipart/form-data` to `POST /api/v1/admin/upload`.
2. Handler validates file type (JPEG, PNG, WebP, PDF) and size against `PlatformConfigService` (`max_image_upload_mb` or `max_auction_sheet_mb`).
3. File key is constructed: `uploads/{companySlug}/vehicles/{stockNumber}/{subfolder}/{uuid}.{ext}`.
4. Binary data is written to Cloudflare R2 bucket via `putStoredFile(env, key, body, contentType)`.
5. Public asset URL or relative path is returned to client.
6. When vehicle is saved, URL is stored in D1 via `VehicleRepository`.

### 5.3 Auction Sheet Proxy & Security Streaming

1. Client requests `GET /api/v1/public/vehicles/:identifier/auction-sheet`.
2. `VehicleService.getPublicAuctionSheetInfo` checks that vehicle exists, is published, is not archived, and has `auction_sheet_available = 1`.
3. Object key is extracted from `auction_sheet_url`.
4. R2 bucket streams document body.
5. Response is delivered with security headers:
   * `Content-Type: application/pdf`
   * `Content-Disposition: inline; filename="..."`
   * `X-Content-Type-Options: nosniff`
   * `Cache-Control: private, max-age=3600`

---

## 6. Coding Conventions & Implementation Patterns

1. **Standard ES Modules**: All files use native `import` / `export` syntax.
2. **Asynchronous I/O**: All database and storage operations use `async` / `await`.
3. **Database Naming**: D1 columns use `snake_case` (e.g. `stock_number`, `is_published`, `created_at`).
4. **API Payload Naming**: REST API bodies and responses use `camelCase` (e.g. `stockNumber`, `isPublished`, `createdAt`).
5. **SQL Security**: All queries MUST use parameterized D1 bindings (`db.prepare(sql).bind(...params)`). Concatenating unsanitized strings into SQL is strictly forbidden.
6. **Pure Web API Usage**: Encryption, hashing, and token operations use standard Web Crypto API (`crypto.subtle`) for edge compatibility.

---

## 7. Extension Guidelines for Future Development

When extending the system with new domain modules:
1. **Create Route Handlers** under `worker/src/routes/admin/` or `routes/public/`.
2. **Register Route Mappings** in `worker/src/index.js` regex route map.
3. **Encapsulate Business Logic** inside a dedicated service in `worker/src/services/`.
4. **Isolate SQL Persistence** inside a dedicated repository class in `worker/src/repositories/`.
5. **Define Permission Keys** and enforce them using `authenticate(request, env, "module.permission")`.
6. **Record Audit Trail Events** using `logAudit()` for all state-modifying operations.

---

## Architectural Invariants

Future development **MUST** preserve the following architectural rules:

1. **Business Rules Belong Exclusively in Services**:
   Route handlers and repository classes MUST NOT contain business rule decisions (e.g. status transition validation, image limit checks, featured position reordering). All business rules MUST reside in Service modules (`VehicleService`, `PlatformConfigService`).

2. **Repositories Only Perform Persistence**:
   Repository classes (`VehicleRepository`) MUST only formulate prepared SQL statements and execute them against D1. They MUST NOT contain business rules, authorization checks, or HTTP response logic.

3. **Routes Contain No Business Logic or Raw SQL**:
   Route handlers MUST only parse request parameters, trigger middleware, call Service methods, and return formatted responses via `response.js`. No raw SQL queries or domain business logic may exist in route files.

4. **Data Mapping Occurs in Mappers**:
   Transformation between database `snake_case` records and API `camelCase` domain objects MUST occur in dedicated mapper functions (`vehicle-mapper.js`).

5. **Server-Authoritative Access Control**:
   All security, permissions, session validity, and lockout checks MUST be performed on the backend edge server. Frontend UI state MUST NEVER be trusted for authorization.

6. **Preserve API Response Contracts**:
   All endpoints MUST return JSON matching the standard response envelope:
   `{ "success": true, "data": ... }` for success, or `{ "success": false, "message": ... }` for errors.

7. **Preserve Database Compatibility**:
   Database schema modifications MUST be additive and maintain backward compatibility with Cloudflare D1. Existing column names and table contracts MUST NOT be changed destructively.

8. **Avoid Duplicated Business Logic**:
   Business logic MUST NOT be duplicated across multiple routes, services, or background jobs. Shared domain behavior MUST be centralized within the primary domain Service module.

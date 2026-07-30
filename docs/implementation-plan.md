# System Cleanup & Hardening Implementation Plan (Version 2)

## 1. Purpose & Authoritative Scope

This document serves as the **authoritative implementation plan** for executing codebase cleanup, security hardening, performance optimization, and architectural alignment across the Roadlink Automobiles platform.

All subsequent development, cleanup, and hardening work packages **MUST** adhere to the target files, step-by-step actions, validation checkpoints, quality gates, and architectural invariant preservation rules defined herein.

---

## 2. Architectural Invariants Preservation Rules

All implementation tasks executed under this plan **MUST** strictly preserve the following non-negotiable architectural invariants:

1. **Business Rules Belong Exclusively in Services**:
   Route handlers and repositories must not execute business logic (status state transitions, policy validation, position reordering, lockout rule checks).
2. **Repositories Only Perform Persistence**:
   Repository classes (`VehicleRepository`, `UserRepository`, `RoleRepository`, `SettingsRepository`, `ContentRepository`) formulate and execute prepared D1 SQL statements.
3. **Routes Contain No Business Logic or Raw SQL**:
   Route handlers must delegate all domain operations to Services and return standard JSON responses via `response.js` helpers.
4. **Data Mapping Occurs in Mappers**:
   Database `snake_case` records must be transformed to API `camelCase` domain representations inside dedicated mappers (`vehicle-mapper.js`, `user-mapper.js`, `role-mapper.js`).
5. **Server-Authoritative Security & Permissions**:
   All permission key validations, token versions, mandatory actions, and RBAC rules must be enforced on the backend edge Worker.
6. **Preserve REST API Contracts & DB Compatibility**:
   Response envelopes (`{ success, data, message }`), status codes, and existing database schema contracts must remain 100% backward compatible.

---

## 3. Work Packages & Action Items

### Work Package 1: Security, Permission & Authorization Hardening (Phase 1)

#### Package 1.1: Fix Array Permission Parameter Evaluation Bug
* **Target File**: `worker/src/utils/auth.js`
* **Action**:
  1. Inspect `requiredPermission` parameter inside `authenticate()`.
  2. If `requiredPermission` is an Array, evaluate `requiredPermission.some(p => permissions.includes(p))`.
  3. If string, evaluate `permissions.includes(requiredPermission)`.
  4. Ensure non-super-admin users with required permissions pass authorization check cleanly.

#### Package 1.2: Mandatory Security Action & Token Scope Guards
* **Target File**: `worker/src/utils/auth.js`
* **Action**:
  1. Verify `getPendingMandatoryAction()` check in `authenticate()`.
  2. Confirm token scope restriction (`mandatory_security_action_pending`, `mfa_pending`) rejects un-whitelisted route access with HTTP 403 Forbidden.

#### Package 1.3: Uniform RBAC Permission Check Parameter
* **Target Files**: `worker/src/routes/admin/audit_logs.js`, `worker/src/routes/admin/roles.js`
* **Action**:
  1. Refactor `listAuditLogs` and `exportAuditLogs` to invoke `authenticate(request, env, "audit.view")`. Remove manual inline permission checks.
  2. Refactor `listRoles` to invoke `authenticate(request, env, "roles.manage")`.

#### Package 1.4: SQL Wildcard Search Input Escaping
* **Target Files**: `worker/src/utils/validator.js`, `worker/src/routes/admin/audit_logs.js`, `worker/src/services/vehicle-service.js`, `worker/src/routes/admin/users.js`
* **Action**:
  1. Export `escapeSqlWildcards(str)` in `validator.js` to escape `%` and `_` characters (`replace(/[%_]/g, '\\$&')`).
  2. Wrap user search parameters in `escapeSqlWildcards()` before inserting into `LIKE` query parameter bindings.
  3. Ensure SQL `LIKE` clauses append `ESCAPE '\'` where necessary.

#### Package 1.5: Security Headers & Dynamic CORS Sanitization
* **Target Files**: `worker/src/utils/response.js`, `worker/src/routes/public/vehicles.js`, `worker/src/routes/admin/audit_logs.js`
* **Action**:
  1. Export `applySecurityHeaders(headers)` in `response.js` to inject `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
  2. Apply `applySecurityHeaders()` to binary PDF streaming responses in `getPublicVehicleAuctionSheet`.
  3. Replace hardcoded CORS origin `"https://roadlinkautomobile.pages.dev"` in `exportAuditLogs` with request origin matching or centralized CORS helper.

---

### Work Package 2: Database & Worker Performance Optimization (Phase 2)

#### Package 2.1: Vehicle Image Query Batching (N+1 Elimination)
* **Target Files**: `worker/src/repositories/vehicle-repository.js`, `worker/src/services/vehicle-service.js`
* **Action**:
  1. Add `VehicleRepository.findImagesForVehicleIds(db, vehicleIds)` using `SELECT * FROM vehicle_images WHERE vehicle_id IN (...) ORDER BY display_order ASC`.
  2. Update `VehicleService.listPublicVehicles` and `listAdminVehicles` to fetch image records for all result vehicle IDs in a single batch query.
  3. Map image arrays to vehicle records in memory using a `Map` keyed by `vehicle_id`.

#### Package 2.2: Composite Database Indexes
* **Target Files**: `worker/database/schema.sql`, new migration file
* **Action**:
  1. Add `CREATE INDEX IF NOT EXISTS idx_vehicles_published_status ON vehicles(is_published, status, archived_at);`.
  2. Add `CREATE INDEX IF NOT EXISTS idx_vehicles_featured ON vehicles(is_featured, archived_at, featured_position);`.

#### Package 2.3: Streamed Audit Log CSV/NDJSON Export
* **Target File**: `worker/src/routes/admin/audit_logs.js`
* **Action**:
  1. Refactor `exportAuditLogs()` to use `TransformStream` to stream audit log rows line-by-line as CSV format.
  2. Set `Content-Type: text/csv` and `Content-Disposition: attachment; filename="audit-logs.csv"`.

#### Package 2.4: Eliminate Dynamic Runtime DDL Mutations
* **Target File**: `worker/src/routes/admin/roles.js`
* **Action**:
  1. Remove `ensureRolesMfaColumn()` dynamic `ALTER TABLE` execution from `listRoles()` route handler.
  2. Verify that `mfa_required` column definition is statically defined in `schema.sql`.

---

### Work Package 3: Architectural Layer Alignment (Phase 3)

#### Package 3.1: User Domain Service-Repository Extraction
* **Target Files**:
  * `worker/src/repositories/user-repository.js` (New)
  * `worker/src/services/user-service.js` (New)
  * `worker/src/services/user-mapper.js` (New)
  * `worker/src/routes/admin/users.js`
* **Action**:
  1. Implement `UserRepository` for D1 `users` persistence.
  2. Implement `UserService` encapsulating creation, password changes, MFA management, lockout handling, and `isStrictlyLessPrivileged` validation.
  3. Refactor `routes/admin/users.js` to delegate entirely to `UserService`.

#### Package 3.2: Roles Domain Service-Repository Extraction
* **Target Files**:
  * `worker/src/repositories/role-repository.js` (New)
  * `worker/src/services/role-service.js` (New)
  * `worker/src/services/role-mapper.js` (New)
  * `worker/src/routes/admin/roles.js`
* **Action**:
  1. Implement `RoleRepository` for D1 `roles` and `role_permissions` persistence.
  2. Implement `RoleService` for role creation, permission mapping, and hierarchy checks.
  3. Refactor `routes/admin/roles.js` to delegate to `RoleService`.

#### Package 3.3: Platform Settings Service-Repository Extraction & Cache Invalidation
* **Target Files**:
  * `worker/src/repositories/settings-repository.js` (New)
  * `worker/src/services/settings-service.js` (New)
  * `worker/src/routes/admin/settings.js`
* **Action**:
  1. Implement `SettingsRepository` for D1 `settings` persistence.
  2. Implement `SettingsService` for settings updates and orphan media cleanup.
  3. Invoke `platformConfig.clearCache()` inside `SettingsService.updateSettings()` to invalidate in-memory policy cache upon update.
  4. Refactor `routes/admin/settings.js` to delegate to `SettingsService`.

#### Package 3.4: Content Management Service-Repository Extraction
* **Target Files**:
  * `worker/src/repositories/content-repository.js` (New)
  * `worker/src/services/content-service.js` (New)
  * `worker/src/routes/admin/carousel.js`, `locations.js`, `testimonials.js`
* **Action**:
  1. Implement `ContentRepository` for carousel slides, business locations, and customer testimonials.
  2. Refactor route handlers to delegate through `ContentService`.

---

### Work Package 4: Code Quality, Diagnostics & Maintainability (Phase 4)

#### Package 4.1: Structured Diagnostic Logger
* **Target File**: `worker/src/utils/logger.js` (New)
* **Action**:
  1. Create structured logger wrapping `console.log` and `console.error` with JSON formatted output including timestamp, log level, message, and metadata context (IP address, user ID, route path).

#### Package 4.2: Frontend API Client Standardization
* **Target Files**: `public/js/app.js`, `public/js/inventory.js`, `public/js/stock.js`, `public/js/vehicle.js`
* **Action**:
  1. Import `public/js/shared/api.js` and `public/js/shared/config.js` across public frontend scripts to standardize fetch operations and URL resolution.

---

## 4. Verification & Quality Gates

Every Work Package must pass all three Quality Gates before being marked complete:

```
[ Code Changes Applied ] ──► [ Quality Gate 1: Syntax & Linter Check ]
                                   │
                                   ▼
                             [ Quality Gate 2: Applet Build (compile_applet) ]
                                   │
                                   ▼
                             [ Quality Gate 3: API Contract & Invariant Test ]
                                   │
                                   ▼
                             [ Package Completed ]
```

1. **Quality Gate 1**: Zero syntax errors or unresolved imports across all server and client files.
2. **Quality Gate 2**: `compile_applet` executes cleanly with zero build errors.
3. **Quality Gate 3**: API response envelopes (`{ success, data, message }`) and status codes match contracts documented in `docs/api.md`.

# System Cleanup & Hardening Implementation Plan

## 1. Purpose & Authoritative Scope

This document serves as the **authoritative implementation plan** for the execution of codebase cleanup, security hardening, performance optimization, and architectural alignment phases across the Roadlink Automobiles platform.

All subsequent cleanup and hardening work items **MUST** follow the work packages, quality gates, and architectural invariant preservation rules defined in this document.

---

## 2. Architectural Invariants Preservation Rules

All implementation tasks executed under this plan **MUST** strictly preserve the following non-negotiable architectural invariants:

1. **Business Rules Belong Exclusively in Services**:
   Route handlers and repositories must not execute business logic (status transitions, policy validation, position reordering).
2. **Repositories Only Perform Persistence**:
   Repository classes (`VehicleRepository`, `UserRepository`, `RoleRepository`, `SettingsRepository`) formulation and execution of prepared D1 SQL statements.
3. **Routes Contain No Business Logic or Raw SQL**:
   Route handlers must delegate all domain operations to Services and return standard responses via `response.js`.
4. **Data Mapping Occurs in Mappers**:
   Database `snake_case` records must be converted to API `camelCase` domain objects inside dedicated mappers.
5. **Server-Authoritative Security & Permissions**:
   All permissions, token versions, mandatory actions, and RBAC rules must be enforced on the backend edge Worker.
6. **Preserve REST API Contracts & DB Compatibility**:
   Response envelopes (`{ success, data, message }`) and existing database schema contracts must remain fully backward compatible.

---

## 3. Work Packages & Action Items

### Work Package 1: Security Hardening (Phase 1)

#### Package 1.1: Universal Mandatory Security Action Middleware Guard
* **Target File**: `worker/src/utils/auth.js`
* **Action**:
  1. Update `authenticate()` function to inspect `user.mandatory_security_action_pending`.
  2. If true, verify if the current route path is in the allowed whitelist (`/api/v1/auth/change-password`, `/api/v1/auth/mfa/*`, `/api/v1/auth/logout`).
  3. If not whitelisted, immediately return HTTP 403 Forbidden with message: `"Access denied. Mandatory security action pending."`.

#### Package 1.2: Uniform Permission Key Verification
* **Target File**: `worker/src/routes/admin/audit_logs.js`
* **Action**:
  1. Refactor `listAuditLogs` and `exportAuditLogs` to pass `"audit.view"` directly to `authenticate(request, env, "audit.view")`.
  2. Remove manual `hasViewPerm` inline checks.

#### Package 1.3: SQL Wildcard Search Sanitization
* **Target File**: `worker/src/utils/validator.js`
* **Action**:
  1. Export helper function `escapeSqlWildcards(str)` that escapes `%` and `_` characters.
  2. Apply `escapeSqlWildcards()` across search parameter handlers in vehicle, user, and audit log repositories.

#### Package 1.4: Streaming Response Security Headers
* **Target File**: `worker/src/utils/response.js`, `worker/src/routes/public/vehicles.js`
* **Action**:
  1. Export helper `applySecurityHeaders(responseHeaders)` to inject `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
  2. Apply helper when building Response instances for PDF streams in `getPublicVehicleAuctionSheet`.

---

### Work Package 2: Architectural Alignment & Tech Debt Removal (Phase 2)

#### Package 2.1: User Domain Service & Repository Extraction
* **Target Files**:
  * `worker/src/repositories/user-repository.js` (New)
  * `worker/src/services/user-service.js` (New)
  * `worker/src/routes/admin/users.js`
* **Action**:
  1. Create `UserRepository` for D1 queries on `users` table.
  2. Create `UserService` to encapsulate user creation, password resets, MFA reset, lockout unlocking, and `isStrictlyLessPrivileged` checks.
  3. Refactor `routes/admin/users.js` to delegate entirely to `UserService`.

#### Package 2.2: Roles Domain Service & Repository Extraction
* **Target Files**:
  * `worker/src/repositories/role-repository.js` (New)
  * `worker/src/services/role-service.js` (New)
  * `worker/src/routes/admin/roles.js`
* **Action**:
  1. Create `RoleRepository` for D1 queries on `roles` and `role_permissions` tables.
  2. Create `RoleService` to manage role operations and hierarchy guards.
  3. Refactor `routes/admin/roles.js` to delegate entirely to `RoleService`.

#### Package 2.3: Settings Service & Repository Extraction
* **Target Files**:
  * `worker/src/repositories/settings-repository.js` (New)
  * `worker/src/services/settings-service.js` (New)
  * `worker/src/routes/admin/settings.js`
* **Action**:
  1. Create `SettingsRepository` for D1 queries on `settings` table.
  2. Create `SettingsService` for updating platform settings and triggering media cleanup.
  3. Refactor `routes/admin/settings.js` to delegate to `SettingsService`.

#### Package 2.4: Platform Policy Cache Invalidation
* **Target File**: `worker/src/services/platform-config.js`
* **Action**:
  1. Ensure `platformConfig.clearCache()` is called whenever platform settings or policy parameters are updated.

---

### Work Package 3: Performance & Scalability (Phase 3)

#### Package 3.1: N+1 Vehicle Image Query Batching
* **Target File**: `worker/src/repositories/vehicle-repository.js`
* **Action**:
  1. Add `findImagesForVehicleIds(db, vehicleIds)` to `VehicleRepository` using `WHERE vehicle_id IN (...)`.
  2. Update `VehicleService.listPublicVehicles` and `listAdminVehicles` to fetch images for all result vehicles in a single query batch.

#### Package 3.2: D1 Composite Index Additions
* **Target File**: `worker/migrations/0002_add_composite_indices.sql` (or schema update)
* **Action**:
  1. Add composite index `CREATE INDEX IF NOT EXISTS idx_vehicles_status_published ON vehicles(is_published, status, archived_at);`.

#### Package 3.3: Streamed Audit Log Export
* **Target File**: `worker/src/routes/admin/audit_logs.js`
* **Action**:
  1. Refactor `exportAuditLogs` to use `TransformStream` to stream audit log rows in CSV or NDJSON format, preventing memory buffer spikes.

---

### Work Package 4: Code Quality & Housekeeping (Phase 4)

#### Package 4.1: Structured Diagnostic Logger
* **Target File**: `worker/src/utils/logger.js` (New)
* **Action**:
  1. Create standard logger wrapping `console.log` / `console.error` with JSON formatted outputs including timestamp and context.

#### Package 4.2: Repository Housekeeping
* **Target Action**:
  1. Verify and archive obsolete reference files (`sqlite_master_20260729.txt`, `vehicle-refactoring-plan.md`).
  2. Execute `compile_applet` to confirm successful build across all packages.

---

## 4. Verification & Quality Gates

Each Work Package must pass the following Quality Gates before completion:

```
[ Code Changes Applied ] ──► [ Quality Gate 1: Syntax & Linter Check ]
                                   │
                                   ▼
                             [ Quality Gate 2: Full Applet Compilation (compile_applet) ]
                                   │
                                   ▼
                             [ Quality Gate 3: API Contract & Invariants Verification ]
                                   │
                                   ▼
                             [ Package Completed ]
```

1. **Quality Gate 1**: Zero syntax errors or unresolved imports.
2. **Quality Gate 2**: `compile_applet` must execute clean builds with zero compilation errors.
3. **Quality Gate 3**: API response structures (`{ success, data, message }`) and status codes must remain 100% compliant with `docs/api.md`.

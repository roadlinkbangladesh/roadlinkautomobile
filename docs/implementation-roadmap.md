# Implementation Roadmap (Version 2)

## 1. Strategic Prioritization Matrix

The implementation roadmap prioritizes tasks based on a three-axis evaluation: **Security & Correctness Risk Reduction**, **Architectural Value**, and **Implementation Effort / Regression Risk**.

```
HIGH VALUE / HIGH RISK REDUCTION
┌───────────────────────────────────────────────┬───────────────────────────────────────────────┐
│ Phase 1: Critical Security & Permission Fixes │ Phase 2: Performance & Scalability            │
│ - Middleware Permission Array Bug (SEC-05)    │ - N+1 Vehicle Image Query Batching (PERF-01)  │
│ - Universal Mandatory Action Guards (SEC-01)  │ - D1 Composite Indexes (PERF-02)              │
│ - Uniform RBAC Check Parameter (SEC-02)       │ - Audit Log CSV/NDJSON Streaming (PERF-03)    │
│ - SQL Wildcard Input Escaping (SEC-03)        │ - Remove Dynamic DDL Mutations (ARCH-03)      │
│ - Streaming Security & CORS Fixes (SEC-04/06) │                                               │
│ Effort: LOW | Value: CRITICAL                 │ Effort: MEDIUM | Value: HIGH                  │
├───────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ Phase 3: Architectural Layer Alignment        │ Phase 4: Maintainability & Diagnostics        │
│ - Refactor User Domain (ARCH-02a)             │ - Structured Diagnostic Logger (QUAL-01)      │
│ - Refactor Role Domain (ARCH-02b)             │ - Frontend API Client Uniformity (QUAL-02)    │
│ - Refactor Settings Domain (ARCH-02c)         │ - Documentation Baseline Synchronization     │
│ - Refactor Content Management (ARCH-02d)      │                                               │
│ - Platform Policy Cache Invalidation (ARCH-01)│                                               │
│ Effort: MEDIUM-LARGE | Value: HIGH            │ Effort: LOW | Value: MEDIUM                   │
└───────────────────────────────────────────────┴───────────────────────────────────────────────┘
LOW EFFORT ────────────────────────────────────────────────────────────────────────► HIGH EFFORT
```

---

## 2. Phase Breakdown

### Phase 1: Critical Security, Permission & Authorization Hardening
**Goal**: Immediately resolve authorization defect bugs, enforce mandatory security action boundaries, and sanitize input vectors across all endpoints.

* **Task 1.1**: Fix Array Permission Evaluation Bug in `authenticate()` (SEC-05)
  * Update `worker/src/utils/auth.js` to properly evaluate string array parameters for required permissions (`requiredPermission.some(...)`), restoring access for non-super-admin users with required permissions.
* **Task 1.2**: Universal Mandatory Security Action & Token Scope Guards (SEC-01)
  * Verify and enforce mandatory action restrictions and token scope validation inside `authenticate()` across all administrative and protected API routes.
* **Task 1.3**: Uniform RBAC Permission Parameter Enforcement (SEC-02)
  * Refactor endpoints in `audit_logs.js`, `roles.js`, and legacy routes to pass explicit permission keys (e.g. `"audit.view"`, `"roles.manage"`) directly to `authenticate()`, eliminating manual inline permission checks.
* **Task 1.4**: SQL Wildcard Input Escaping Helper (SEC-03)
  * Implement `escapeSqlWildcards()` in `utils/validator.js` and apply it to search filter inputs across `audit_logs.js`, `vehicle-service.js`, and `users.js` to eliminate wildcard-based DoS query risks.
* **Task 1.5**: Streaming Response Security Headers & CORS Sanitization (SEC-04 & SEC-06)
  * Export `applySecurityHeaders()` in `utils/response.js` and apply it to PDF attachment streams and file export responses. Replace hardcoded production origin headers in `exportAuditLogs()` with dynamic CORS origin matching.

---

### Phase 2: Database & Worker Performance Optimization
**Goal**: Resolve query bottlenecks, eliminate N+1 relational fetches, optimize D1 index access patterns, and stream heavy export data.

* **Task 2.1**: Eliminate N+1 Vehicle Image Queries (PERF-01)
  * Implement `VehicleRepository.findImagesForVehicleIds(db, vehicleIds)` batch query using `WHERE vehicle_id IN (...)`. Update `VehicleService.listPublicVehicles` and `listAdminVehicles` to fetch all image associations in a single query batch.
* **Task 2.2**: Add Composite Database Indexes (PERF-02)
  * Add composite index `idx_vehicles_published_status` on `(is_published, status, archived_at)` and `idx_vehicles_featured` on `(is_featured, archived_at, featured_position)` in D1 migrations and `schema.sql`.
* **Task 2.3**: Streamed Audit Log Export (PERF-03)
  * Refactor `exportAuditLogs()` in `routes/admin/audit_logs.js` to stream audit records in CSV format using `TransformStream`, eliminating memory heap spikes.
* **Task 2.4**: Eliminate Dynamic Runtime DDL Mutations (ARCH-03)
  * Remove `ensureRolesMfaColumn()` dynamic `ALTER TABLE` execution from `routes/admin/roles.js`. Ensure column definitions exist statically in `schema.sql` and migration scripts.

---

### Phase 3: Architectural Layer Alignment (Refactoring Legacy Domains)
**Goal**: Align all remaining administrative backend modules (`users`, `roles`, `settings`, content management) with the Service-Repository-Mapper layered architecture established in the Vehicle domain.

* **Task 3.1**: User Domain Extraction (ARCH-02a)
  * Extract D1 query logic from `routes/admin/users.js` into `UserRepository`, `UserService`, and `user-mapper.js`. Isolate password reset, lockout unlock, and role hierarchy checks in `UserService`.
* **Task 3.2**: Roles Domain Extraction (ARCH-02b)
  * Extract D1 query logic from `routes/admin/roles.js` into `RoleRepository` and `RoleService`. Isolate system role protections and permission assignment logic in `RoleService`.
* **Task 3.3**: Settings Domain Extraction & Cache Invalidation (ARCH-02c & ARCH-01)
  * Extract D1 query logic from `routes/admin/settings.js` into `SettingsRepository` and `SettingsService`. Ensure `SettingsService.updateSettings()` explicitly calls `platformConfig.clearCache()` upon modification.
* **Task 3.4**: Content Management Domain Extraction (ARCH-02d)
  * Extract D1 query logic from `routes/admin/carousel.js`, `locations.js`, and `testimonials.js` into structured repositories and services (`ContentRepository`, `ContentService`).

---

### Phase 4: Code Quality, Diagnostics & Maintainability
**Goal**: Standardize diagnostic logging, align public frontend API interaction patterns, and maintain comprehensive documentation.

* **Task 4.1**: Structured Diagnostic Logger (QUAL-01)
  * Create `worker/src/utils/logger.js` to provide structured JSON console logging with request metadata context (IP address, user ID, endpoint route).
* **Task 4.2**: Frontend API Helper Standardization (QUAL-02)
  * Standardize public frontend scripts (`app.js`, `stock.js`, `vehicle.js`) to import and utilize `public/js/shared/api.js` and `public/js/shared/config.js`.
* **Task 4.3**: Repository Housekeeping & Documentation Baseline
  * Clean up obsolete reference files and verify documentation synchronization across `docs/architecture.md`, `docs/technical-design.md`, and `docs/api.md`.

---

## 3. Strategic Roadmap Timeline & Phasing Schedule

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STRATEGIC ROADMAP TIMELINE                            │
├─────────────────┬───────────────────────────────────────────────────────────┤
│ Phase           │ Core Deliverables                                         │
├─────────────────┼───────────────────────────────────────────────────────────┤
│ Phase 1 (Week 1)│ Critical Security, Permission & Authorization Hardening   │
│ Phase 2 (Week 2)│ Database & Worker Performance Optimization                │
│ Phase 3 (Week 3)│ Architectural Layer Alignment (User/Role/Settings/Content)│
│ Phase 4 (Week 4)│ Code Quality, Structured Logging & Documentation          │
└─────────────────┴───────────────────────────────────────────────────────────┘
```

# Implementation Roadmap

## 1. Strategic Prioritization Matrix

The implementation roadmap prioritizes tasks based on a three-axis evaluation: **Security Risk Reduction**, **Architectural Value**, and **Implementation Effort**.

```
HIGH VALUE / HIGH RISK REDUCTION
┌───────────────────────────────────────────────┬───────────────────────────────────────────────┐
│ Phase 1: Security Hardening                   │ Phase 3: Performance & Scalability            │
│ - Mandatory Security Action Middleware Guard  │ - N+1 Query Elimination in Vehicles           │
│ - Strict Permission Middleware Enforcement     │ - Audit Log Streaming Export                  │
│ Effort: LOW-MEDIUM | Value: CRITICAL          │ Effort: MEDIUM | Value: HIGH                  │
├───────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ Phase 2: Architectural Layer Alignment        │ Phase 4: Code Quality & Standardization       │
│ - Refactor Legacy Routes (Users/Roles/Settings)│ - Error Logging Standardization               │
│ - Platform Policy Cache Invalidation          │ - Cleanup Obsolete Artifacts                  │
│ Effort: MEDIUM-LARGE | Value: HIGH            │ Effort: LOW | Value: MEDIUM                   │
└───────────────────────────────────────────────┴───────────────────────────────────────────────┘
LOW EFFORT ────────────────────────────────────────────────────────────────────────► HIGH EFFORT
```

---

## 2. Phase Breakdown

### Phase 1: Security Hardening & Vulnerability Remediation
**Goal**: Eliminate high-priority security risks and enforce uniform authentication/authorization guards.

* **Task 1.1**: Universal Mandatory Security Action Verification (SEC-01)
  * Extend `authenticate()` middleware in `worker/src/utils/auth.js` to block access to all protected administrative API routes if `user.mandatory_security_action_pending` is true (except dedicated MFA/password completion endpoints).
* **Task 1.2**: Uniform Permission Key Check (SEC-02)
  * Update `audit_logs.js` and other legacy endpoints to pass required permission keys directly into `authenticate(request, env, requiredPermission)`.
* **Task 1.3**: SQL Wildcard Sanitization (SEC-03)
  * Implement `escapeSqlWildcards()` helper in `utils/validator.js` and apply it across search filter query bindings.
* **Task 1.4**: Streaming Response Security Headers (SEC-04)
  * Ensure binary PDF streaming and raw object handlers explicitly inject global security headers (`X-Content-Type-Options`, framing headers).

---

### Phase 2: Architectural Invariant Enforcement & Tech Debt Cleanup
**Goal**: Align all remaining administrative backend modules with the strict layered architecture established in the Vehicle domain.

* **Task 2.1**: Refactor User Management Module (ARCH-02a)
  * Extract SQL logic from `routes/admin/users.js` into `UserRepository` and `UserService`.
* **Task 2.2**: Refactor Roles & Permissions Module (ARCH-02b)
  * Extract SQL logic from `routes/admin/roles.js` into `RoleRepository` and `RoleService`.
* **Task 2.3**: Refactor Platform Settings Module (ARCH-02c)
  * Extract SQL logic from `routes/admin/settings.js` into `SettingsRepository` and `SettingsService`.
* **Task 2.4**: Platform Policy Cache Invalidation Hook (ARCH-01)
  * Implement explicit `platformConfig.clearCache()` hook invocation whenever settings or platform policies are updated.

---

### Phase 3: Performance, Caching & Scalability Optimization
**Goal**: Resolve N+1 query patterns, optimize database indexing, and eliminate memory spike bottlenecks.

* **Task 3.1**: Eliminate N+1 Vehicle Image Queries (PERF-01)
  * Refactor `VehicleRepository.findVehicles` to fetch images for all vehicles in a list via a single batch SQL `IN (...)` query or JOIN, replacing iterative per-vehicle image queries.
* **Task 3.2**: Add Composite Database Indices (PERF-02)
  * Add composite index `idx_vehicles_status_published` on `(is_published, status, archived_at)` in D1 schema.
* **Task 3.3**: Streamed Audit Log Export (PERF-03)
  * Refactor `exportAuditLogs` in `routes/admin/audit_logs.js` to stream audit records in chunked CSV/NDJSON format rather than buffering 1,000 JSON items in memory.

---

### Phase 4: Code Quality, Standardization & Maintainability
**Goal**: Clean up obsolete files, standardize diagnostic logging, and establish long-term code quality.

* **Task 4.1**: Standardize Diagnostic Logging (QUAL-01)
  * Create a lightweight structured logger wrapper in `utils/logger.js` with contextual request metadata logging.
* **Task 4.2**: Repository Housekeeping & Documentation Baseline
  * Archive/clean up obsolete reference SQL files and confirm documentation baseline synchronization across `docs/architecture.md`, `docs/technical-design.md`, and `docs/api.md`.

---

## 3. Strategic Roadmap Timeline & Resource Allocations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ROADMAP TIMELINE                                 │
├─────────────────┬───────────────────────────────────────────────────────────┤
│ Phase           │ Scope                                                     │
├─────────────────┼───────────────────────────────────────────────────────────┤
│ Phase 1 (Week 1)│ Security Hardening & Vulnerability Remediation            │
│ Phase 2 (Week 2)│ Architectural Layer Alignment & Tech Debt Removal        │
│ Phase 3 (Week 3)│ Performance, Caching & Scalability Optimization           │
│ Phase 4 (Week 4)│ Code Quality, Logging & Final Verification                │
└─────────────────┴───────────────────────────────────────────────────────────┘
```

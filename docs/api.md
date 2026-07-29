# REST API Reference

## 1. Overview & API Standards

* **Base URL**: `/api/v1`
* **Format**: All request bodies and JSON responses use UTF-8 JSON.
* **Date Format**: ISO-8601 UTC strings (e.g. `2026-07-29T12:00:00.000Z`).

### Standard Response Envelope

#### Success Response (HTTP 200 / 201)
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional descriptive message"
}
```

#### Error Response (HTTP 400 / 401 / 403 / 404 / 409 / 422 / 429 / 500)
```json
{
  "success": false,
  "message": "Detailed description of error"
}
```

---

## 2. Authentication & Authorization

### Authentication Header
Protected administrative endpoints require a valid JWT Bearer token passed in the HTTP Authorization header:

```http
Authorization: Bearer <token>
```

### Response Status Codes

| HTTP Code | Description | Meaning in System |
| :--- | :--- | :--- |
| **200 OK** | Request succeeded | Data retrieved or successfully updated |
| **201 Created** | Resource created | Vehicle, user, role, or slide created |
| **204 No Content** | Action succeeded | CORS preflight or deletion response |
| **400 Bad Request** | Invalid payload | Validation failure or invalid parameter |
| **401 Unauthorized** | Authentication required | Missing, invalid, or expired JWT token |
| **403 Forbidden** | Access denied | Insufficient RBAC permission or pending security action |
| **404 Not Found** | Resource missing | Entity does not exist or is published/archived |
| **409 Conflict** | Business rule conflict | Duplicate stock number, slug, or username |
| **422 Unprocessable** | Domain validation error | Field formatting or password complexity error |
| **429 Too Many Requests** | Rate limited | Login attempt rate limit exceeded |
| **500 Server Error** | System failure | Uncaught server exception |

---

## 3. Public Endpoints (`/api/v1/public`)

Public endpoints do not require authentication headers.

### 3.1 List Public Vehicles
`GET /api/v1/public/vehicles`

Retrieves published, non-archived vehicles matching search and filter criteria.

#### Query Parameters
| Parameter | Type | Description | Default |
| :--- | :--- | :--- | :--- |
| `search` | string | Search term across stock number, make, model, grade, color, description, year | `""` |
| `category` | string | Body type filter (`sedan`, `suv`, `hatchback`, `van`, `truck`, `coupe`, `all`) | `"all"` |
| `make` | string | Vehicle manufacturer filter | `"all"` |
| `status` | string | Filter by vehicle status (`available`, `incoming`, `reserved`, `sold`) | All non-sold |
| `featured` | boolean | Set to `true` to list featured vehicles | `false` |
| `includeSold` | boolean | Set to `true` to include sold items (if setting permits) | `false` |
| `sort` | string | Sort order: `order-asc`, `price-asc`, `price-desc`, `year-desc`, `date-desc` | `order-asc` |
| `page` | integer | Page number | `1` |
| `limit` | integer | Results per page (max 100) | `100` |

#### Example Response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 12,
        "stockNumber": "RL-2026-001",
        "make": "Toyota",
        "model": "Land Cruiser Prado",
        "year": 2023,
        "price": 68000,
        "bodyType": "suv",
        "mileage": 15000,
        "fuelType": "Diesel",
        "transmission": "Automatic",
        "exteriorColor": "Pearl White",
        "status": "available",
        "isFeatured": true,
        "featuredPosition": 1,
        "featuredImage": "https://pub-r2.roadlink.com/uploads/roadlink/vehicles/RL-2026-001/exterior/front.jpg",
        "exteriorImages": ["https://pub-r2.roadlink.com/uploads/roadlink/vehicles/RL-2026-001/exterior/front.jpg"],
        "interiorImages": ["https://pub-r2.roadlink.com/uploads/roadlink/vehicles/RL-2026-001/interior/dash.jpg"],
        "auctionSheetAvailable": true,
        "auctionSheetUrl": "/api/v1/public/vehicles/RL-2026-001/auction-sheet"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

---

### 3.2 Get Single Public Vehicle
`GET /api/v1/public/vehicles/:identifier`

Retrieves single published vehicle details by database ID, stock number, or slug.

#### Parameters
* `identifier` (path): Vehicle ID, stock number (e.g. `RL-2026-001`), or slug.

---

### 3.3 Get Public Vehicle Auction Sheet
`GET /api/v1/public/vehicles/:identifier/auction-sheet`

Streams or downloads the PDF auction sheet for a published vehicle.

#### Headers Returned
* `Content-Type: application/pdf`
* `Content-Disposition: inline; filename="auction-sheet-{stockNumber}.pdf"`
* `X-Content-Type-Options: nosniff`

---

### 3.4 Get Public Settings
`GET /api/v1/public/settings`

Retrieves public dealership contact details, currency symbol, and branding assets.

---

### 3.5 Get Public Locations, Carousel, and Testimonials
* `GET /api/v1/public/locations` — List active locations
* `GET /api/v1/public/locations/:slug` — Get location by slug
* `GET /api/v1/public/carousel` — List active homepage slides
* `GET /api/v1/public/testimonials` — List public customer reviews

---

## 4. Authentication & MFA Endpoints (`/api/v1/auth`)

### 4.1 Login
`POST /api/v1/auth/login`

Authenticates credentials and returns a JWT token or MFA pending state.

#### Request Body
```json
{
  "username": "admin",
  "password": "SecurePassword123!",
  "rememberMe": true,
  "mfaCode": "123456"
}
```

#### Success Response (Standard Login)
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "fullName": "System Administrator",
      "email": "admin@roadlink.com",
      "role": "Super Administrator",
      "roleId": 1,
      "mfaEnabled": true
    }
  }
}
```

#### Success Response (MFA Required)
```json
{
  "success": true,
  "data": {
    "mfaRequired": true,
    "mfaToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Multi-Factor Authentication required."
}
```

---

### 4.2 Verify MFA Login Step
`POST /api/v1/auth/mfa/verify`

Submits 6-digit TOTP code or emergency backup code during MFA step.

#### Request Body
```json
{
  "mfaToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "code": "123456"
}
```

---

### 4.3 MFA Setup & Enrolment
* `GET /api/v1/auth/mfa/status` — Get current user MFA status
* `POST /api/v1/auth/mfa/setup` — Generate TOTP secret, QR code URI, and single-use backup codes
* `POST /api/v1/auth/mfa/enable` — Confirm enrolment with 6-digit TOTP code
* `POST /api/v1/auth/mfa/disable` — Disable MFA (requires password confirmation)

---

## 5. Admin Vehicle Management (`/api/v1/admin/vehicles`)

Requires `Authorization: Bearer <token>` and appropriate permission key.

### 5.1 List Vehicles (Admin)
`GET /api/v1/admin/vehicles` (Permission: `vehicles.read`)

#### Query Parameters
Supports `search`, `status` (`available`, `incoming`, `reserved`, `sold`, `archived`), `make`, `category`, `sort`, `page`, `limit`. Includes draft/unpublished and archived vehicles.

---

### 5.2 Create Vehicle
`POST /api/v1/admin/vehicles` (Permission: `vehicles.create`)

#### Request Body
```json
{
  "stockNumber": "RL-2026-002",
  "make": "Honda",
  "model": "Civic Type R",
  "year": 2024,
  "price": 45000,
  "bodyType": "hatchback",
  "mileage": 5000,
  "fuelType": "Petrol",
  "transmission": "Manual",
  "exteriorColor": "Championship White",
  "interiorColor": "Red/Black",
  "engineSize": "2.0L Turbo",
  "driveType": "FWD",
  "status": "available",
  "isPublished": true,
  "isFeatured": false,
  "shortDescription": "Track-ready hatchback in pristine condition.",
  "exteriorImages": ["https://pub-r2.roadlink.com/uploads/roadlink/vehicles/RL-2026-002/exterior/front.jpg"],
  "interiorImages": ["https://pub-r2.roadlink.com/uploads/roadlink/vehicles/RL-2026-002/interior/seats.jpg"],
  "auctionSheetAvailable": false
}
```

---

### 5.3 Update Vehicle
`PUT /api/v1/admin/vehicles/:id` (Permission: `vehicles.edit`)

Updates vehicle fields. Cannot archive featured vehicles directly without un-featuring first.

---

### 5.4 Update Vehicle Status
`PUT /api/v1/admin/vehicles/:id/status` (Permission: `vehicles.edit`)

#### Request Body
```json
{
  "status": "sold"
}
```

---

### 5.5 Delete Vehicle
`DELETE /api/v1/admin/vehicles/:id` (Permission: `vehicles.delete`)

Deletes vehicle record from D1 and associated image records.

---

### 5.6 Get Dashboard Statistics
`GET /api/v1/admin/dashboard/stats` (Permission: `vehicles.read` or `dashboard.read`)

#### Example Response
```json
{
  "success": true,
  "data": {
    "total": 45,
    "available": 30,
    "incoming": 5,
    "reserved": 3,
    "sold": 5,
    "archived": 2
  }
}
```

---

## 6. Administrative Management Endpoints

### 6.1 File Upload
`POST /api/v1/admin/upload`

Uploads media asset to Cloudflare R2 storage.

#### Request Form-Data
* `file` (binary file): Media asset (JPEG, PNG, WebP image or PDF auction sheet).
* `subfolder` (string, optional): Target subfolder (`exterior`, `interior`, `documents`, `branding`).

#### Response
```json
{
  "success": true,
  "data": {
    "url": "https://pub-r2.roadlink.com/uploads/roadlink/vehicles/RL-2026-001/exterior/a1b2c3d4.jpg",
    "key": "uploads/roadlink/vehicles/RL-2026-001/exterior/a1b2c3d4.jpg",
    "size": 1048576,
    "type": "image/jpeg"
  }
}
```

---

### 6.2 Maintenance Tasks
`POST /api/v1/admin/maintenance/run` (Permission: `settings.edit`)

Triggers background retention archiving and orphan storage cleanup.

#### Response
```json
{
  "success": true,
  "data": {
    "archiving": {
      "archivedVehiclesCount": 3,
      "archiveAfterMonths": 12
    },
    "orphanCleanup": {
      "scanned": 150,
      "deleted": 4,
      "orphanDaysCutoff": 7
    }
  }
}
```

---

### 6.3 User Management (`/api/v1/admin/users`)
* `GET /api/v1/admin/users` (Permission: `users.read`) — List all system users
* `POST /api/v1/admin/users` (Permission: `users.create`) — Create user account
* `GET /api/v1/admin/users/:id` (Permission: `users.read`) — Get user details
* `PUT /api/v1/admin/users/:id` (Permission: `users.edit`) — Update user details
* `DELETE /api/v1/admin/users/:id` (Permission: `users.delete`) — Delete user account
* `POST /api/v1/admin/users/:id/reset-password` (Permission: `users.edit`) — Administrative password reset
* `POST /api/v1/admin/users/:id/reset-mfa` (Permission: `users.edit`) — Reset user MFA configuration
* `POST /api/v1/admin/users/:id/enforce-mfa` (Permission: `users.edit`) — Enforce MFA requirement
* `POST /api/v1/admin/users/:id/unlock` (Permission: `users.edit`) — Unlock locked account
* `PUT /api/v1/admin/users/change-password` — Password change for authenticated user

---

### 6.4 Roles & Permissions (`/api/v1/admin/roles`)
* `GET /api/v1/admin/permissions` (Permission: `roles.read`) — List all system permissions
* `GET /api/v1/admin/roles` (Permission: `roles.read`) — List roles
* `POST /api/v1/admin/roles` (Permission: `roles.create`) — Create role with permission keys
* `GET /api/v1/admin/roles/:id` (Permission: `roles.read`) — Get role details
* `PUT /api/v1/admin/roles/:id` (Permission: `roles.edit`) — Update role permissions
* `DELETE /api/v1/admin/roles/:id` (Permission: `roles.delete`) — Delete role

---

### 6.5 Audit Logs (`/api/v1/admin/audit-logs`)
* `GET /api/v1/admin/audit-logs` (Permission: `audit.read`) — Query audit logs with date/user filters
* `GET /api/v1/admin/audit-logs/export` (Permission: `audit.read`) — Export audit logs as CSV file

---

### 6.6 Platform Settings (`/api/v1/admin/settings`)
* `GET /api/v1/admin/settings` (Permission: `settings.read`) — Retrieve administrative site settings
* `PUT /api/v1/admin/settings` (Permission: `settings.edit`) — Update platform settings

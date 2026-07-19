# Roadlink Automobiles API Documentation

## Version

Current API Version: `v1`

Base URL:

```
/api/v1
```

All responses use JSON.

---

# Standard Response Format

## Success

```json
{
    "success": true,
    "data": {}
}
```

## Error

```json
{
    "success": false,
    "message": "Description of the error"
}
```

---

# Authentication

Authentication uses JWT Bearer Tokens.

Protected endpoints require the following header:

```
Authorization: Bearer <JWT Token>
```

If the token is invalid or expired, the API returns:

HTTP Status

```
401 Unauthorized
```

Response

```json
{
    "success": false,
    "message": "Invalid or expired token."
}
```

---

# Login

## Endpoint

```
POST /api/v1/auth/login
```

Authentication Required

```
No
```

## Request

```json
{
    "username": "admin",
    "password": "password",
    "rememberMe": true
}
```

### rememberMe

| Value | Behaviour |
|--------|-----------|
| true | Creates a long-lived token intended to be stored in localStorage |
| false | Creates a session token intended to be stored in sessionStorage |

## Success Response

HTTP Status

```
200 OK
```

```json
{
    "success": true,
    "data": {
        "token": "<JWT Token>",
        "user": {
            "id": 1,
            "username": "admin",
            "role": "admin"
        }
    }
}
```

Possible Errors

| Status | Message |
|---------|---------|
| 400 | Validation failed |
| 401 | Invalid username or password |

---

# Settings

## Get Settings

Endpoint

```
GET /api/v1/admin/settings
```

Authentication Required

```
Yes
```

Headers

```
Authorization: Bearer <JWT Token>
```

Success Response

```json
{
    "success": true,
    "data": {
        "...": "..."
    }
}
```

The `data` object contains every column from the `settings` table.

Possible Errors

| Status | Message |
|---------|---------|
| 401 | Authentication required |
| 401 | Invalid or expired token |
| 500 | Internal server error |

---

# Frontend Authentication Rules

After a successful login:

If **Remember Me** is checked:

```
localStorage.setItem("token", token)
```

Otherwise:

```
sessionStorage.setItem("token", token)
```

The frontend should always obtain the JWT using:

```javascript
function getToken() {
    return (
        sessionStorage.getItem("token") ||
        localStorage.getItem("token")
    );
}
```

Logout must clear both:

```javascript
sessionStorage.removeItem("token");
localStorage.removeItem("token");
```

---

# Endpoints Implemented

| Endpoint | Status |
|----------|--------|
| POST /api/v1/auth/login | ✅ Complete |
| GET /api/v1/admin/settings | ✅ Complete |
| PUT /api/v1/admin/settings | ⏳ Planned |

## Frontend Configuration

The frontend must never hardcode API URLs.

All backend communication must use:

admin/config.js

through the shared apiFetch() helper in:

admin/utils.js

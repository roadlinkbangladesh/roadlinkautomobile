# Project Rules

## General & Project Philosophy

- **Keep it Simple**: Keep the system simple. Avoid enterprise patterns, unnecessary complexity, and over-engineering.
- **Strictly No Frameworks**: Use HTML, CSS, and Vanilla JavaScript with ES Modules only. No frameworks or heavy libraries.
- **Owner-Centric**: Build only what is needed for a single dealership owner.
- **Consistency**: Every new feature should follow the existing architecture instead of introducing new patterns.
- **Public-Driven**: The public website drives the design of the admin portal.
- **Locked Schema**: The project uses exactly the 5 locked tables: `users`, `settings`, `vehicles`, `vehicle_images`, and `activity_logs`. No additional tables or RBAC permission tables should be introduced.

---

## Development

- Use HTML, CSS and Vanilla JavaScript (ES Modules).
- Prefer readability over clever code.
- Reuse existing code where possible.
- Do not introduce frameworks.

---

## UI

- Maintain a consistent design and layout.
- Keep pages responsive.
- Accessibility and SEO should never be broken.

---

## Vehicle Data & Statuses

- **No Arbitrary Fields**: Never invent new fields.
- **Arrival Date**: Stored as a free-text field (`arrivalDate`). No arrival status enum is required.
- **Business Status (`status`)**: Limited strictly to `'available'`, `'incoming'`, `'reserved'`, and `'sold'`. The legacy `'draft'` status has been completely removed.
- **Publication Status (`is_published`)**: Managed separately as a boolean/integer field independent of the core business status.
- **Lifecycle Archiving (`archived_at`)**:
  - Vehicles are never deleted instantly; they are archived by writing a UTC timestamp to `archived_at` ( NULL = active).
  - Do NOT introduce an "archived" business status.
  - Archived vehicles are hidden from the public site and default admin inventory lists, but retain images and can be restored.

---

## Images

- **Normalized Model**: Images are stored in the `vehicle_images` table with type classification strictly set to `'exterior'`, `'interior'`, or `'auction'`.
- **No Poster Image / Separate Cover Image**: There is no dedicated cover or poster image field in the database.
- **Dynamic Cover**: The cover image is always dynamically derived as the first exterior image ordered by `display_order`. The Cloudflare Worker backend maps this collection into the frontend's expected data model format.

---

## User Roles, Sessions & Security

- **Supported Roles**: Strictly `admin` (full system access) and `manager` (inventory management only, with intentionally limited permissions).
- **Authentication**: Backend Cloudflare Worker validated JWTs with **Argon2** password hashing. Plaintext passwords must never be stored.
- **Session Cookie Security**: Signed JWT session tokens are transmitted in **Secure, HttpOnly, and SameSite** cookies.
- **Sliding Expiration**: Sessions utilize sliding expiration on user interaction.
- **Configurable Timeout**: Stored in the settings table (e.g., `session_timeout_minutes`). The value is **NOT** editable from the frontend and can only be updated by `admin` users via authenticated API calls.
- **Audit Logging**: Mandatory tracking of all inventory, settings, and auth state changes in the `activity_logs` table.

---

## Database Migrations

- **Migration-Led Schema Changes**: Database schema changes after initial deployment must be introduced through sequential SQL migration scripts rather than modifying original schema definitions directly, safeguarding existing production data.

---

## Time Handling

- **Database Time**: All timestamps must be saved in Coordinated Universal Time (UTC).
- **Frontend Presentation**: Dates and times are converted and rendered in the **Asia/Dhaka (UTC+6)** timezone for local dealership operations.

---

## AI Studio & Assistance

- Use AI Studio for UI generation.
- Use ChatGPT for architecture, review and planning.

---

## Our Principles

1. Keep the application simple.
2. Keep the development process simple.
3. Build only what helps sell cars.
4. Don't over-engineer. No complex enterprise abstractions.
5. All validation occurs in the Worker. Never trust client-side validation.
6. SQL queries must always be parameterized.
7. Sensitive secrets must never be committed to Git; utilize Cloudflare Secrets.

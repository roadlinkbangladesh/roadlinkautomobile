# Roadlink API

Backend API for the Roadlink Automobiles website.

## Technology Stack

- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- GitHub

## Architecture

- Frontend: Cloudflare Pages
- Backend: Cloudflare Workers
- Database: Cloudflare D1
- Image Storage: Cloudflare R2

## Project Structure

```text
worker/
├── src/
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   └── migrations/
├── package.json
├── wrangler.jsonc
└── README.md
```

## Setup

1. Create the D1 database.
2. Run `schema.sql`.
3. Run `seed.sql`.
4. Configure Worker bindings:
   - `DB`
   - `IMAGES`
5. Configure Worker secrets:
   - `JWT_SECRET`
6. Deploy the Worker.

## Security Principles

- Never commit secrets to GitHub.
- Passwords are stored as Argon2 hashes.
- JWT secret is stored as a Cloudflare Worker Secret.
- All API endpoints validate input.
- All authenticated actions are authorization checked.
- Administrative actions are audit logged.

## Time Handling

- All timestamps are stored in UTC.
- The frontend displays dates using the configured `display_timezone`.

## Version

Current Version: 1.0.0

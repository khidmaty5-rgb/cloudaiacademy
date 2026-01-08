# Environment configuration

Set the following variables for server APIs and AI flows.

- FIREBASE_PROJECT_ID=
- FIREBASE_CLIENT_EMAIL=
- FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\\n-----END PRIVATE KEY-----\n"
- INITIAL_ADMIN_EMAIL=
- FIREBASE_SERVICE_ACCOUNT_PATH= (optional, absolute or relative path to a JSON service account for local dev)
- GEMINI_API_KEY=
- STRIPE_SECRET_KEY=
- STRIPE_WEBHOOK_SECRET=
- PAYPAL_ENV=sandbox
- PAYPAL_CLIENT_ID=
- PAYPAL_CLIENT_SECRET=
- PAYPAL_WEBHOOK_ID=

Notes:
- Server-only Firebase Admin envs use the FIREBASE_* scheme consistently (no FIREBASE_ADMIN_*).
- `FIREBASE_PRIVATE_KEY` must contain literal `\n` sequences; the server converts them to newlines.
- `INITIAL_ADMIN_EMAIL` lets the owner self-promote to admin exactly once (or when no admins exist). Keep this private (do NOT use NEXT_PUBLIC_ here).
- Optionally set `FIREBASE_SERVICE_ACCOUNT_PATH` to point to a local service account JSON for development. In production, prefer env vars or default credentials.
- If deploying Cloud Functions instead of API routes, upgrade the Firebase project to Blaze.
- For billing setup details, see `docs/payments.md`.

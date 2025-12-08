# Environment configuration

Set the following variables for server APIs and AI flows.

- FIREBASE_PROJECT_ID=
- FIREBASE_CLIENT_EMAIL=
- FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\\n-----END PRIVATE KEY-----\n"
- GEMINI_API_KEY=

Notes:
- FIREBASE_PRIVATE_KEY must contain literal `\n` sequences; the API routes convert them to newlines.
- If deploying Cloud Functions instead of API routes, upgrade the Firebase project to Blaze.

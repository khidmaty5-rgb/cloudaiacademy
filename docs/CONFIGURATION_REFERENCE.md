# Configuration reference

This document records configuration names and ownership. It intentionally contains no secret values.

## Checked-in configuration files

| File | Purpose | Current notable setting |
| --- | --- | --- |
| `.firebaserc` | Default Firebase project alias | `studio-3170120655-4bab7` |
| `firebase.json` | Hosting, Firestore, Functions, and emulator configuration | Hosting framework backend region `us-west1`; emulator ports 8080, 9099, and 5001 |
| `apphosting.yaml` | Firebase App Hosting runtime configuration | `maxInstances: 1` |
| `firestore.rules` | Client Firestore authorization | Role, ownership, paywall, certificate, course, and journal rules |
| `firestore.indexes.json` | Composite and collection-group indexes | Course, journal, and enrollment-request indexes |
| `next.config.ts` | Next.js build, images, and development origins | Build errors are enforced; remote image hosts are restricted |
| `tsconfig.json` | TypeScript compilation | Strict mode; Functions excluded from root compilation |
| `eslint.config.mjs` | Root lint configuration | Next core-web-vitals and TypeScript presets through the ESLint CLI |
| `functions/eslint.config.mjs` | Firebase Functions lint configuration | TypeScript and ESLint recommended rules scoped to Functions source |
| `.github/workflows/ci.yml` | Continuous integration | Root checks on Node 22 and a separate Functions lint/build job on its declared Node 18 runtime |
| `tailwind.config.ts` | Design system and Tailwind scanning | Application styling configuration |
| `components.json` | shadcn component configuration | UI component aliases and styling |
| `package.json` | Root dependencies and scripts | Next.js application commands |
| `functions/package.json` | Firebase Functions dependencies and scripts | Separate Functions installation/build; Node 18 declared |
| `.env.example` | Server configuration template | Firebase Admin, billing, and n8n names |
| `.env.local.example` | S3 and billing local template | MinIO/S3-compatible example values |

## Public client variables

Values prefixed with `NEXT_PUBLIC_` are embedded in browser code and must not contain secrets.

| Variable | Required by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase client | Authentication domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase client | Firebase project identifier |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase client | Firebase web application ID |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase client | Messaging sender identifier |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase analytics | Optional measurement identifier |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Local development | Enables client emulator connections |
| `NEXT_PUBLIC_FIRESTORE_FORCE_LONG_POLLING` | Firestore client | Optional networking compatibility mode |
| `NEXT_PUBLIC_SITE_URL` | Public links | Canonical application origin |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Public content | Contact email displayed to users |
| `NEXT_PUBLIC_CONTACT_PHONE` | Public content | Contact phone displayed to users |
| `NEXT_PUBLIC_EVIDENCE_BASE_URL` | Evidence integration | Base URL for evidence resources |
| `NEXT_PUBLIC_JOURNAL_GUIDELINES_URL` | Journal UI | External or internal guidelines URL |

## Firebase Admin and authorization variables

| Variable | Sensitivity | Purpose |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Configuration | Server Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Sensitive identifier | Service-account email |
| `FIREBASE_PRIVATE_KEY` | Secret | Service-account private key with escaped newlines |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Sensitive local path | Optional local service-account JSON path |
| `INITIAL_ADMIN_EMAIL` | Sensitive configuration | Intended owner bootstrap identity |
| `ALLOW_BOOTSTRAP_ADMIN` | Security-sensitive flag | Explicitly enables first-admin bootstrap logic |
| `GOOGLE_CLOUD_PROJECT` | Runtime configuration | Google Cloud project override/derived value |
| `GCLOUD_PROJECT` | Runtime configuration | Compatibility project variable |
| `FIRESTORE_EMULATOR_HOST` | Local development | Firestore emulator host |
| `FIREBASE_AUTH_EMULATOR_HOST` | Local development | Authentication emulator host |

The shared server initializer resolves the project ID from `FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT`, then `GCLOUD_PROJECT`. It selects credentials in this order: emulator project configuration when an emulator host is set; complete project ID/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` values; a service-account JSON from `FIREBASE_SERVICE_ACCOUNT_PATH` or the ignored local `config/serviceAccount.local.json`; then Google Application Default Credentials. It reuses one named Admin app per server process and never logs credential values or file contents.

Known current limitation: the initial-admin branches in the role-update route are unreachable because the self-sync branch returns first. Do not rely on bootstrap behavior until that workstream is repaired and tested.

## AI configuration

| Variable | Sensitivity | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Secret | Enables Genkit/Gemini requests |

If the key is absent, quiz generation has a local fallback. The other AI flows currently require additional fallback and error-handling review.

## Stripe configuration

| Variable | Sensitivity | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Secret | Stripe server API authentication |
| `STRIPE_WEBHOOK_SECRET` | Secret | Stripe webhook signature verification |

Firestore `settings/payment` contains non-secret runtime choices such as enabled state, billing model, provider, currency, plan references, and paywall defaults.

## PayPal configuration

| Variable | Sensitivity | Purpose |
| --- | --- | --- |
| `PAYPAL_ENV` | Configuration | `sandbox` or `live` API selection |
| `PAYPAL_CLIENT_ID` | Sensitive identifier | PayPal application client ID |
| `PAYPAL_CLIENT_SECRET` | Secret | PayPal application client secret |
| `PAYPAL_WEBHOOK_ID` | Sensitive identifier | Webhook-signature verification ID |

## S3-compatible storage

| Variable | Sensitivity | Purpose |
| --- | --- | --- |
| `S3_ENDPOINT` | Configuration | S3 or MinIO endpoint |
| `S3_REGION` | Configuration | Storage region |
| `S3_FORCE_PATH_STYLE` | Configuration | Path-style compatibility flag |
| `S3_ACCESS_KEY_ID` | Secret | Storage access key |
| `S3_SECRET_ACCESS_KEY` | Secret | Storage secret key |
| `S3_BUCKET_JOURNAL` | Configuration | Journal manuscript/PDF bucket |
| `S3_BUCKET_LESSONS` | Configuration | Lesson PDF bucket |
| `S3_BUCKET_CERTIFICATES` | Configuration | Certificate PDF bucket |

Production buckets should use private access, encryption, restricted credentials, retention/lifecycle rules, and backups independent of the application repository.

## n8n and Telegram

| Variable | Sensitivity | Purpose |
| --- | --- | --- |
| `N8N_WEBHOOK_SECRET` | Secret | Authenticates n8n calls to internal Telegram endpoints |

The Telegram bot token is expected to remain inside n8n credentials and is not an application environment variable.

## Runtime variables

`NODE_ENV` is set by the runtime/build. The application changes authentication fallback behavior based on this value, so production must always run with `NODE_ENV=production`.

## Secret-handling policy

- Never commit `.env.local`, service-account JSON, private keys, provider secrets, or storage credentials.
- Do not place secret values in issues, logs, screenshots, backups, or documentation.
- Store production secrets in the deployment platform's secret/environment facility.
- Rotate credentials after suspected disclosure and record the rotation date outside this repository.
- Keep a separately encrypted, access-controlled disaster-recovery copy of production secrets.

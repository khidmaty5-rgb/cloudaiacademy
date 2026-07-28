# CloudAI Academy

CloudAI Academy is a role-based learning, certification, and research-publishing platform built with Next.js, TypeScript, Firebase, S3-compatible object storage, Stripe, PayPal, Genkit/Gemini, and n8n/Telegram integrations.

## Documentation

- `docs/DOCUMENTATION_INDEX.md` — documentation entry point and ownership
- `docs/FEATURE_CATALOG.md` — complete product-area and function inventory
- `docs/CONFIGURATION_REFERENCE.md` — environment variables, configuration files, and external services
- `docs/DEPLOYMENT_RUNBOOK.md` — validation, deployment, webhook, and rollback procedures
- `docs/BACKUP_RECOVERY.md` — backup contents, exclusions, verification, and restoration
- `docs/REPAIR_WORKSTREAMS.md` — prioritized function-by-function stabilization roadmap
- `docs/payments.md` — existing billing notes
- `docs/telegram-n8n.md` — existing n8n and Telegram workflow guide

## Technology stack

- Next.js 15 App Router, React 18, and TypeScript
- Tailwind CSS and shadcn/Radix UI
- Firebase Authentication, Firestore, Functions, Hosting/App Hosting, rules, indexes, and emulators
- Stripe Checkout and Billing Portal
- PayPal Orders and verified webhooks
- S3-compatible storage for journals, lessons, and certificate PDFs
- Genkit with Gemini for quizzes, recommendations, and learning paths
- n8n and Telegram for scheduled provider messages

## Local setup

1. Install root dependencies with `npm ci`.
2. Copy the environment templates into a local `.env.local` and fill in only the services needed locally.
3. Never commit `.env.local`, service-account JSON files, private keys, webhook secrets, or storage credentials.
4. Run `npm run typecheck`.
5. Run `npm run dev` or `npm run dev:turbo`.
6. If Firebase Functions are needed, install and build them separately from the `functions` directory.

See `docs/CONFIGURATION_REFERENCE.md` for the complete variable inventory and `docs/DEPLOYMENT_RUNBOOK.md` before deploying.

## Root scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run dev:turbo` | Start development with Turbopack |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run lint` | Run the current Next.js lint command |
| `npm run test:firestore-rules` | Run Firestore security-rule tests in the local emulator |
| `npm run build` | Remove `.next` and create a production build |
| `npm run start` | Start an existing production build |
| `npm run genkit:dev` | Start Genkit development tooling |
| `npm run genkit:watch` | Start Genkit tooling in watch mode |

## Current validation status

- Main application TypeScript check passes.
- Direct ESLint execution reports no errors but currently reports many warnings.
- GitHub Actions validate the application and Firebase Functions; focused Firestore profile and Journal boundary tests plus reviewer API access-policy tests run in the application job.
- Broader unit, integration, and acceptance-test coverage remains pending.
- Firebase Functions require their own dependency installation before they can be built.

The repair roadmap treats current behavior and intended behavior separately. Documenting a feature does not mean it has already passed security, integration, or acceptance testing.

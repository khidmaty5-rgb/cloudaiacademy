# Deployment runbook

This runbook documents the repository's current deployment surfaces. It does not imply that every workflow is automated or currently production-ready.

## Deployment surfaces

1. Root Next.js application and route handlers.
2. Firebase Firestore rules and indexes.
3. Firebase Functions in `functions/`.
4. External provider configuration: Stripe, PayPal, S3-compatible storage, Gemini, n8n, and Telegram.

The checked-in Firebase default project is `studio-3170120655-4bab7`. Confirm the target project and environment before every deployment.

## Pre-deployment checklist

1. Confirm the current branch, commit, and clean/understood Git status.
2. Create and verify a backup as described in `BACKUP_RECOVERY.md`.
3. Confirm the target Firebase project; never assume the `.firebaserc` default is correct for production.
4. Confirm production environment variables are present without printing their values.
5. Confirm Stripe and PayPal modes match the intended environment.
6. Confirm S3 bucket names, access policy, CORS, encryption, and lifecycle settings.
7. Run root validation:
   - `npm ci`
   - `npm run test:firestore-rules`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
8. Run Functions validation separately:
   - change to `functions`
   - `npm ci`
   - `npm run lint`
   - `npm run build`
9. Review Firestore rule and index changes.
10. Review migrations, seed/reset operations, and destructive changes explicitly.
11. Record the release commit and intended rollback commit.

Current caveats:

- GitHub Actions validate the root application, Firestore profile rules, and Firebase Functions.
- Automated Firestore coverage currently focuses on user-profile ownership and sensitive-field restrictions; broader rule and integration coverage remains pending.
- Functions dependencies are not installed by the root `npm ci`.
- The root production build removes `.next` before building.

## Local Firebase emulators

Configured ports:

- Firestore: `8080`
- Authentication: `9099`
- Functions: `5001`

Client emulator usage also depends on `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` and the application's Firebase provider behavior.

## Firestore deployment

Review `firestore.rules` and `firestore.indexes.json` before deployment. Use the Firebase CLI with an explicitly confirmed project.

Journal rules are being reconciled with production one behavior at a time. Verified scopes include direct article creation (author ownership, PDF namespace, initial workflow state, and reviewer-assignment protection), `settings/ui.showJournalNav` read gating, and author client-write isolation. When the Journal is disabled, public article and issue reads are denied while article owners and editorial staff retain their existing access. Author submissions and revisions use authenticated server APIs; direct Firestore article updates and deletes are limited to editors and administrators. Reviewer assignment, review, and unpublished-PDF APIs use the current profile role as authoritative; reviewer access additionally requires assignment to the article. Reviewer identities are stored only in the server-managed `journalReviewerAssignments` collection and protected review subcollections, not on author-readable article documents. Reviewers do not receive direct Firestore access to unpublished articles or private assignment records. Reviewer treatment outside the Journal remains a separate workstream. Before a rules deployment, compare the candidate with the active production ruleset and reject any unrelated Journal/Reviewer delta.

Typical scoped deployment:

```text
firebase use <confirmed-project>
firebase deploy --only firestore:rules,firestore:indexes
```

After deployment, test at minimum:

- Public published-course reads
- Student self-profile restrictions
- Role changes and administrator listing
- Enrollment and lesson access
- Purchase-document restrictions
- Certificate public lookup without list access
- Journal author, reviewer, editor, and public boundaries
- Direct journal creation cannot self-publish, assign an issue or reviewers, or pre-populate review state
- Journal visibility defaults to enabled and blocks public article and issue reads only when explicitly disabled
- Author article updates and revisions use authenticated server APIs; direct client updates and deletes are editor/admin only
- Reviewer APIs reject stale privileged token roles and require the current reviewer profile role plus article assignment
- Assigned reviewers cannot bypass the APIs with direct Firestore reads, updates, or deletes
- Article documents do not contain reviewer IDs or emails; assignment records remain unreadable through client Firestore

## Firebase Functions deployment

Functions are a separate package with their own lockfile and scripts.

```text
cd functions
npm ci
npm run lint
npm run build
npm run deploy
```

Current Functions:

- `onUserCreate`
- `onUserUpdate`
- `adminCreateUser`

Verify claim synchronization after deployment. A claim update does not automatically invalidate already-issued ID tokens.

## Next.js and Firebase hosting

The repository contains both `apphosting.yaml` and a Firebase Hosting framework configuration in `firebase.json`.

Current settings:

- App Hosting `maxInstances: 1`
- Framework backend region `us-west1`

The exact production release path—connected App Hosting branch versus Firebase CLI framework deployment—must be recorded for each environment before relying on this runbook. Do not operate both paths accidentally against the same production site.

After release, verify:

- Landing page and static assets
- Login/signup and Firebase client configuration
- Student, teacher, reviewer, editor, and administrator access
- API route authentication
- S3 PDF upload/download
- Payment checkout and webhook delivery
- Journal public and private access
- Telegram internal endpoints
- AI-disabled and AI-enabled behavior

## Stripe setup

Required server secrets: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.

Webhook endpoint:

```text
https://<host>/api/billing/webhook
```

Before enabling payments, verify the current billing workstream findings. In particular, course confirmation must strictly bind a paid session to the authenticated user, exact course, payment type, amount, and currency; webhook fulfillment must verify paid status.

## PayPal setup

Required configuration: `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID`.

Webhook endpoint:

```text
https://<host>/api/billing/paypal-webhook
```

Test sandbox checkout, capture, signature verification, ownership, amount, currency, duplicate events, and failure recovery before switching to `live`.

## S3-compatible storage setup

Create and restrict the journal, lessons, and certificates buckets. Confirm:

- Application credentials have only the required object permissions.
- Buckets are not publicly listable.
- Browser CORS permits only intended upload origins and methods.
- Upload size and content-type restrictions are enforced.
- Lifecycle and backup policies are configured.
- Presigned URLs expire as expected.

## Gemini/Genkit setup

Set `GEMINI_API_KEY` only after AI authentication, rate limits, input limits, logging, and budget controls are in place. Test behavior with the key both present and absent.

## n8n and Telegram setup

Follow `telegram-n8n.md`. Confirm `N8N_WEBHOOK_SECRET` matches between the application and n8n without displaying it. Keep the Telegram bot token only in n8n credentials.

## Rollback

1. Stop destructive jobs and disable affected external integrations if necessary.
2. Redeploy the last known-good application commit.
3. Redeploy the matching Functions version if Functions changed.
4. Restore prior Firestore rules if authorization broke.
5. Do not automatically roll back Firestore data; inspect and restore only from a verified backup.
6. Reconcile payment and entitlement records before reopening billing.
7. Record the incident, affected release, recovery steps, and remaining manual reconciliation.

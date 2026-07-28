# Repair workstreams

This roadmap turns the feature catalog into bounded, reviewable units. Each work unit should have tests, documentation, rollback notes, and a single clear owner.

## Definition of done for every function

- Current behavior and intended behavior are documented.
- Authorization and data ownership are explicit.
- Inputs, outputs, errors, and limits are validated.
- Happy path, denial path, and failure/retry path are tested.
- External cost and side effects are controlled.
- Logging does not expose secrets or private data.
- Deployment and rollback steps are documented.
- Firestore rules and indexes are updated and tested when needed.

## W0 — Safety net and documentation

1. Maintain the feature and configuration inventory.
2. Add GitHub Actions for root install, type check, lint, and build.
3. Add a separate Functions install/lint/build job.
4. Add a basic unit/integration test framework.
5. Add Firestore emulator rule tests.
6. Record release and rollback commits.

Current status: inventory, root CI, the separate Firebase Functions CI job, a Firebase emulator test harness, and focused user-profile rule tests are implemented. Broader test coverage and release-record work remain pending.

## W1 — Shared authentication and authorization

1. Create one shared Firebase Admin initializer.
2. Create shared `requireUser` and `requireRole` helpers.
3. Remove repeated token-decoding fallbacks.
4. Make the current profile role authoritative for sensitive server operations.
5. Repair initial-administrator bootstrap ordering.
6. Define role demotion and token-revocation behavior.
7. Add role-transition audit logs and tests.

Current checkpoint: the shared server-only Firebase Admin initializer is implemented with emulator, environment service-account, local service-account file, and Application Default Credentials support. The legacy `getAdminAuth` wrapper and the n8n Telegram due-jobs route now use it as a bounded proof migration. Other API routes still have local initializers and will be migrated incrementally; authorization behavior has not changed in this checkpoint.

## W2 — Payments and entitlements

1. Define the entitlement model for free, subscription, one-time, per-course, and offline access.
2. Strictly bind Stripe course confirmation to user, course, payment type, amount, currency, and paid status.
3. Handle delayed Stripe payment events correctly.
4. Test webhook replay and out-of-order subscription events.
5. Validate PayPal ownership, amount, currency, capture, and webhook replay.
6. Make purchase writes idempotent and auditable.
7. Test course access through Firestore rules and the lesson PDF route.

## W3 — Uploads and storage

1. Centralize S3 configuration and bucket selection.
2. Enforce upload sizes and accepted content types before or during upload.
3. Validate object keys and ownership consistently.
4. Remove rejected/orphaned objects.
5. Add private-bucket, CORS, encryption, lifecycle, and backup requirements.
6. Test presigned URL expiration and authorization.

## W4 — Certificates

1. Define the canonical certificate record.
2. Make sequence generation concurrency-safe.
3. Make PDF upload and both Firestore records atomic or recoverable.
4. Restrict upload size and verify real PDF content.
5. Test owner/admin download and public verification privacy.
6. Make delete/revoke operations consistent across Firestore and S3.
7. Add certificate audit events.

## W5 — Journal and peer review

1. Restrict author-updatable fields with explicit changed-field rules.
2. Validate manuscript metadata and upload size.
3. Protect reviewer identity and editor-only comments.
4. Define allowed journal status transitions.
5. Make review rounds and revisions consistent and idempotent.
6. Test issue assignment and publication.
7. Test public versus private PDF access.

Current isolated rules coverage:

- Direct article creation is limited to the authenticated author, that author's PDF namespace, `SUBMITTED` status, an unassigned issue, empty publication timestamps, and an initial review round.
- Author-controlled reviewer assignments and unexpected workflow fields are denied at creation.
- `settings/ui.showJournalNav` defaults to enabled. When explicitly disabled, public article and issue reads are denied while owners and editorial staff retain their existing access.
- Direct client updates and deletes of Journal articles are editor/admin only. Author submissions and requested revisions go through authenticated server APIs that validate ownership, workflow status, and PDF storage state.
- Reviewer assignment, review, and unpublished-PDF APIs use the current profile role rather than stale token claims. Reviewer access requires both the current `reviewer` role and assignment to the article; direct reviewer Firestore access remains denied.
- Reviewer identity fields currently stored on owner-readable article documents require a separate data-model migration before single-blind anonymity can be considered complete.
- Whether reviewer accounts should inherit non-Journal staff/paywall behavior remains a separate workstream.

## W6 — AI functions

1. Require an authenticated eligible user.
2. Add per-user rate and budget limits.
3. Add input length limits and output validation.
4. Define safe fallback behavior for all three flows.
5. Log usage without storing unnecessary private prompts.
6. Add timeouts and failure telemetry.

## W7 — Telegram, n8n, and live tools

1. Validate message, media, and link payloads.
2. Use constant-time shared-secret comparison where practical.
3. Define claim timeout and retry behavior for jobs.
4. Prevent permanently stuck claimed jobs.
5. Add delivery audit history and retry limits.
6. Test Telegram ownership and reconnection.
7. Define live-room authorization and lifecycle.

## W8 — Courses, enrollment, and learning

1. Validate course and lesson schemas centrally.
2. Refactor seed/reset operations away from normal administration.
3. Test instructor ownership and lesson writes.
4. Validate enrollment, waitlist, and progress fields.
5. Decide whether lesson sequence is a UI hint or an enforced rule.
6. Split oversized learning and administration components.
7. Improve server rendering and reduce unnecessary client pages.

## W9 — Public site and administration

1. Validate and version landing content.
2. Improve metadata, accessibility, performance, and localization.
3. Define analytics data sources and calculation rules.
4. Reconcile revenue analytics with payment-provider records.
5. Add administrator audit history for destructive actions.

## Recommended execution order

`W0 → W1 → W2 → W3 → W4 → W5 → W6 → W7 → W8 → W9`

W0 and W1 establish the safety and authorization foundation. W2 follows because it controls money and course access. Storage, certificates, and journals come next because they contain private or integrity-sensitive files and records.

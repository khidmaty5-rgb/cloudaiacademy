# Independent academy setup

## Isolation model

One academy = one deployment, Firebase project, storage bucket, payment account/webhooks, email identity, and secrets. This is not a multi-tenant SaaS. Never reuse CloudAI production data, service accounts, `.env` files, `.vercel` links, `.firebaserc` targets, or user records. Do not deploy a clone until its Firebase project alias has been explicitly replaced.

## Configure without editing application code

1. In Admin → Academy template, edit the public identity and module settings. Export `academy.config.json`. Exporting does NOT update the current site.
2. Put that file at the new checkout root. Replace the logo and certificate PDF in `public`; use their local paths in the exported configuration. Do not reuse CloudAI artwork without permission.
3. Run `npm ci`, then `npm run academy:check`. Run the complete CI suite and create a preview deployment before assigning the production domain.
4. Configure the academy's own Firebase web app and Admin SDK credentials in the deployment secret store. Match client/server project IDs; never put secrets in `academy.config.json` or `NEXT_PUBLIC_*` variables. Enable the intended Firebase Auth providers and authorize only the new academy domains.
5. In a fresh Firebase project, create the initial admin through Firebase Console/trusted Admin SDK provisioning. Set BOTH its verified Auth custom claim and `users/{uid}.role` to `admin`; the profile is authoritative. Do not add public self-promotion or bootstrap HTTP endpoints. Verify a student cannot change their role.
6. Deploy Firestore rules/indexes to the explicitly selected NEW project. Provision its own storage/CORS and service account permissions. A Vercel deployment does not deploy Firebase rules.
7. Configure prices, actual checkout currencies, provider product IDs and payment settings from Admin → Payments. A display currency is not a payment currency conversion. Use sandbox/test-mode transactions first, including webhook retries, refunds and failed payments.
8. Configure homepage content in Website settings, create academy-owned courses, assign teachers, upload/publish lessons and issue a test certificate. Configure a real meeting provider/room per course; we do not create public rooms automatically during setup.
9. Replace journal/research descriptions, editor names, legal/contact policies, illustrative images, hero text, quotes and sample assets before enabling those sections. These are editorial content, not generic branding. Disable testimonials until you have that academy's permission-backed testimonials; never relabel someone else's endorsement.
10. Run the release acceptance checklist. Only then attach DNS/SSL and enable production purchases.

## Module switches

Switches apply on deployment. Navigation filters and middleware reject disabled module pages/APIs; existing role/ownership security remains mandatory. These switches are product availability controls, not a replacement for database rules. Do not assign editor/reviewer roles when journal is disabled. Existing external meetings are not deleted by disabling live teaching.

Disabling new payments blocks checkout creation; payment webhooks, confirmations, and customer portal remain accessible to reconcile previous transactions and cancellations. Existing course paywall settings must also be reviewed before disabling checkout so learners are not left at a payment-required dead end. Telegram workflows outside the site must be disabled in their own automation service.

## Operations

- Maintain separate staging and production projects. Back up Firestore/storage and test restore to an isolated project before launch and periodically thereafter.
- Record every release SHA, CI results, Firebase rules release and Vercel deployment. Roll back app and rules independently when necessary; preserve data and investigate migrations before rollback.
- Keep credentials in the provider secret manager; rotate them when staff leave. Use least-privilege access and MFA for owners. Monitor error rates, auth failures, import failures and payment reconciliation without logging tokens or lesson content.
- Database/credential provisioning, restore tests and real role accounts require the new owner's resources. They are not completed merely by exporting this configuration.

## Current scope

The template foundation centralizes shared identity, contacts, core certificate defaults, live room prefixes, metadata, accent colors, default language and module availability. Existing course content, published certificates, journal/research editorial text and image/PDF assets are intentionally not rewritten. Treat any remaining CloudAI references as a launch review item, not permission to bulk-replace historical records.

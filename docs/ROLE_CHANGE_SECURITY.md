# Route and role-change safeguards — local batch 2

2026-10-13 Spark-only update supersedes the worker/deployment requirement below:
account creation uses Next directly, profile editing never writes roles, the new
Functions audit worker was removed. Pending audits are recovered explicitly via
admin-only /api/admin/role-sync and the People recovery panel. This reads the
current profile (never the audit's historical role), preserves other claims,
and keeps failures pending. Signed-in users also have the existing self-sync path.
No automatic/background delivery guarantee or paid service is assumed. Rules
deployment approval remains separate; no billing upgrade is required for this design.

Update 2026-10-12: production build now passes; see BUILD_VALIDATION.md. This
supersedes the earlier stalled-build note below, not the manual acceptance gates.

2026-10-12. Not committed, pushed or deployed. Existing CSP changes preserved.

## Behavior changes

- Registered routes explicitly declare public, authenticated or allowed roles.
  Unregistered paths are denied by workspace guards. Existing /admin login is
  explicitly public; it is not an administrative workspace. Teacher/admin legacy
  teaching paths remain supported pending the namespace migration.
- Role changes require a current admin profile rechecked inside a transaction.
  Self-role changes are denied; self-sync may only synchronize the stored role.
- A shared transaction lock serializes role changes. Admin demotion checks the
  remaining profile count; concurrent cross-demotions cannot remove both admins.
- users.role and roleChangeAudit are committed atomically. Audit fields include
  actorUid, targetUid, previousRole, newRole, server timestamp, optional bounded
  reason and claim-sync delivery status. No passwords, tokens or keys are logged.
- Request IDs bind actor, target and new role. Replay is idempotent, conflicting
  reuse rejected, and replay after a subsequent different role cannot restore an
  earlier privilege. The client reuses the ID after transient failures.
- Claims synchronize AFTER the authoritative profile commit. Failure returns
  claimsSyncPending rather than pretending the role mutation failed. A durable
  audit-created Functions trigger retries delivery; it rereads the latest profile
  and preserves other custom claims. Existing profile triggers also reread current
  roles rather than blindly replay old event roles. Cross-service Auth and Firestore
  updates cannot be atomic: current-profile authorization remains essential.
- Direct client role updates and ALL profile deletes are denied, including
  admins. Profile deletion could otherwise revive stale token fallback privileges.
  Existing ordinary admin payment-control and profile-name edits remain allowed.
- Audit writes/deletes are server-only; reads are current-admin-only. Transaction
  lock documents are client-inaccessible. Missing/invalid roles in an existing
  profile never fall back to stale claims in Firestore rules.
- Owner/bootstrap self-promotion code was unreachable after the earlier self-sync
  return and is removed. It was not an active bypass in the inspected version.
- People role selector is controlled so rejected changes do not leave a false
  selected role; pending token synchronization has English/Arabic guidance.

## Boundaries and remaining work

This protects application role/profile mutation paths, not privileged changes
made with Admin SDK/cloud-console credentials. No existing client Auth-account
deletion call was found; identity-provider deletion outside these application
paths is not prevented by Firestore rules. Operational recovery and controlled
account-deletion design are still required. Keep at least two operational admin
accounts and recovery credentials; don't equate profile counts with guaranteed
identity-provider account availability.

No destructive migration or production data mutation was performed. Existing
single-role records remain supported. Sensitive-promotion confirmation UI,
audit-viewer UI, account-deletion workflow and real staging sign-ins remain queued.
This batch does not fix the unrelated build/CSP content-origin gates.

Release must coordinate the Next API/client, Firestore rules and new/updated
Functions worker after a successful production build and manual validation.
Deploying just the UI or just the rules is not an accepted completion state.
No deployment is authorized by this document.

## Local verification

- TypeScript passed.
- App lint: zero errors, 530 existing warnings; targeted --no-ignore lint has only
  two existing src/lib/user.ts warnings. Functions lint/build pass (one existing warning).
- Rules/policy suite: 57 passed. Teacher course-query tests: five passed.
- Real emulator role transactions/API: five passed, including concurrent
  cross-demotion, exact replay, stale replay, revoked actor and simulated Auth
  claims outage followed by successful retry with one audit event.
- Non-emulator suite: 125 passed, one optional uploaded-sample test skipped.
  Includes actual guard child suppression for unregistered paths, complete page
  policy inventory, stale callable claims and durable worker retry behavior.
- npm run build retried; stopped while stuck in high-memory compile. NOT passed.
- Java21 emulator prerequisite solved for local tests using a checksum-verified
  portable Adoptium runtime in Temp; system Java installation unchanged.

For repeatable CI, Java21 is already configured and the transaction test has its
own demo-project emulator invocation. Never point transaction tests at a live DB:
they require FIRESTORE_EMULATOR_HOST and use demo-cloudai-role-transactions.

Manual acceptance: real staging sessions for all five roles; stale-token demotion;
direct unknown URLs; duplicate/network retry; self-role refusal; People selector
on rejected/pending change; concurrent admin operations; claims-worker retry and
audit readability; Arabic/RTL; existing course/journal ownership and disabled modules.

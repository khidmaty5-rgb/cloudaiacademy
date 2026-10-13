# Build blocker resolved — local verification

2026-10-12. No commit, push, deployment, production account/data changes or secrets copied.

## Confirmed cause and fix

Temporary Webpack progress diagnostics localized the stall to the server compiler's
70% finish-module-graph stage, specifically TraceEntryPointsPlugin. NFT diagnostic
logging showed repeated recursive searches shaped like:

```text
CloudAIAcademy/**/*\config\serviceAccount.local.json
```

Sixteen credential-discovery implementations built candidate filenames using a
variable directory level inside a loop. Next's file tracer converted that unknown
level into a recursive wildcard. The fix replaces those builders with five literal
path expressions in the SAME order. Explicit configured paths still take priority;
environment credentials, emulators, ADC fallback, app names and authorization
behavior are unchanged. No credential-file contents were printed or copied into
source/report artifacts. Legacy ancestor credential lookup remains a separate future
cleanup; this change deliberately preserves its runtime behavior.

Example of the important source change:

```diff
- const levels = ['', '..', '../..', '../../..', '../../../..'];
- for (const lvl of levels) {
-   tryPaths.push(path.join(process.cwd(), lvl, 'config', 'serviceAccount.local.json'));
- }
+ const tryPaths: string[] = [
+   path.join(process.cwd(), 'config', 'serviceAccount.local.json'),
+   path.join(process.cwd(), '..', 'config', 'serviceAccount.local.json'),
+   path.join(process.cwd(), '../..', 'config', 'serviceAccount.local.json'),
+   path.join(process.cwd(), '../../..', 'config', 'serviceAccount.local.json'),
+   path.join(process.cwd(), '../../../..', 'config', 'serviceAccount.local.json'),
+ ];
+ if (explicitPath) tryPaths.unshift(explicitPath);
```

The earlier trial externalizing Genkit did not eliminate the stall and was reverted.
All temporary progress logging, tracer overrides and build-worker settings were
removed. No dependency changes, disabling tracing, suppressing errors, increasing
heap limits or changing AI features were retained. next.config.ts remains the
previous security-header configuration.

Credential-path files changed:

- src/server/firebase-admin.ts
- src/app/api/admin/{create-user,update-user-role,seed-courses,reset-courses}/route.ts
- src/app/api/internal/{dev-seed-courses,dev-reset-courses}/route.ts
- src/app/api/billing/{checkout,portal,webhook,paypal-webhook,course-checkout,course-confirm}/route.ts
- src/app/api/reviewer/assignments/route.ts
- src/app/api/journal/articles/[id]/{reviewers,reviews}/route.ts

## Separate nonce propagation fix discovered during built-server testing

Next 15's middleware resolver copies response headers into the rendering request.
The middleware's small enforced rollout baseline was overwriting its full forwarded
nonce CSP. Explicit theme/language scripts had nonces, but framework scripts did not.

Moved the SAME baseline to global next.config headers (globalSecurityHeaders in
src/lib/security-headers.ts), and removed the middleware baseline assignment. The
forwarded full policy now reaches Next's nonce parser. No policy was loosened;
Report-Only remains the default, and enforced middleware overrides the static
baseline when CSP_MODE=enforce. tests/roles/academy-template.test.mjs was updated
to reflect the separation between middleware and static response headers.

## Verified results

- Standard npm run build completed with exit 0; final compile phase 30.6 seconds.
  Built-in TypeScript/lint checks passed; existing lint warnings remain.
- Broad non-emulator suite: 127 passed, zero failed, four optional tests skipped
  (uploaded sample and three explicitly opt-in local production smoke cases).
- Production smoke cases separately executed against the real built server:
  Report-Only header/script nonce equality, fresh nonces, security headers and
  unauthenticated lesson API 401; Arabic/dark initialization and teacher entry
  login redirect. Enforced mode additionally proved unauthorized parser-inserted
  inline script blocking. All passed; no real role sign-ins or cloud writes tested.
- All 93 emitted server NFT manifests checked: zero .env or serviceAccount.local.json
  file references. This is a manifest-path check, not a full secret-content audit.
- New credential-path tests prove identical candidate lists/order on Windows and
  Linux and reject future loop-variable path segments. CI runs these and the
  built-server Report-Only smoke tests after build.
- Local smoke browser contexts are fresh/unauthenticated. Outbound cloud calls
  and non-read local requests are blocked in the startup fixture. Temporary
  production servers on 3107/3108 stopped after verification.

## Remaining release gates

Prior build-stalled notes in ROLE_CHANGE_SECURITY.md, SECURITY_HEADERS.md and
ROLES_LAYOUT_TASKS.md are superseded by this result. Do not automatically deploy.
Real five-role staging sign-ins, sensitive-action confirmation and coordinated
API/Functions/rules release remain required. Full CSP production enforcement
still requires independent hosting for interactive data-frame lessons and exact
S3/stored embed-origin acceptance; a passing build does not remove that limitation.

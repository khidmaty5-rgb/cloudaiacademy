# Security headers — local implementation, not deployed

Production checkpoint 2026-10-14 UTC: PR28 deployed successfully; production
returns enforced baseline, Report-Only full policy, nosniff/referrer/permissions
and unchanged HSTS. Production nonce verification found framework scripts lack
nonces although theme/language scripts carry fresh values. Local/CI built-server
checks did not reproduce this adapter difference. Do not enforce full CSP.
Transport follow-up forwards the same generated policy in both supported request
header names, replacing client-supplied values. Browser policy is unchanged;
the follow-up must be checked on actual production before calling it fixed.

Update 2026-10-12: BUILD_VALIDATION.md supersedes the earlier incomplete build
result below. Production build and built-server nonce/startup smoke checks now
pass. The baseline moved from middleware to static global headers to avoid Next
overwriting its forwarded full nonce request policy; safeguards are unchanged.
Full enforcement's interactive-content/origin gates remain unresolved.

## Rollout decision

Default: full nonce CSP is **Report-Only**. A small enforced policy already
protects `frame-ancestors 'self'; object-src 'none'; base-uri 'self'`.
X-Frame-Options SAMEORIGIN is compatible with same-origin PDF previews.
HSTS is deliberately untouched; Vercel remains its owner.

**Do not switch production to full enforcement yet.** Real-browser tests prove
the existing `data:text/html` interactive lesson inherits the parent's CSP and
its uploaded scripts/event handlers are blocked under enforcement. A document's
own permissive meta CSP cannot override its parent's inherited policy.
Serve these documents from an independently sandboxed content origin before
enforcement. Keep the iframe's `allow-scripts`-only sandbox and existing restrictive
lesson CSP; never add allow-same-origin or permit inline scripts in Academy's CSP.
That hosting/player migration is not included in this header-only change.

Also inventory stored embed/image/PDF URLs and actual presigned S3 URLs before
enforcement. Source cannot enumerate URLs stored in production Firestore.
Report-Only violations are visible in DevTools; no report collector or third-party
reporting service is provisioned and no sensitive report payloads are logged.

Switch after these gates pass: set server environment `CSP_MODE=enforce` and
rebuild/redeploy. Any other value stays Report-Only. This is not a deployment
instruction or authorization: this task has made local changes only.

## Enforced policy template

Actual nonce is a fresh base64 value from 32 cryptographically random bytes for
each request. `AUTH`, `ANALYTICS`, `STORAGE` below are exact trusted
origins, not literal policy tokens. Empty configured origins are omitted.

```text
default-src 'self';
script-src 'self' 'nonce-PER_REQUEST_NONCE' 'strict-dynamic';
script-src-attr 'none';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://placehold.co https://images.unsplash.com https://picsum.photos STORAGE;
font-src 'self';
connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com AUTH STORAGE;
frame-src 'self' data: blob: AUTH ANALYTICS https://stackblitz.com https://excalidraw.com https://labs.whizlabs.com STORAGE;
frame-ancestors 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
worker-src 'self';
media-src 'self' data: blob:;
upgrade-insecure-requests
```

The same full policy is sent as Report-Only initially. No unsafe-inline scripts
or unsafe-eval in production. Development alone adds unsafe-eval for Next HMR,
local emulator HTTP origins and localhost WebSockets, and omits upgrade-insecure-requests.
Remote development workstations may need their exact HMR origin configured in
a future development-only policy; never add it to production.

CSS unsafe-inline is deliberate: React style props, Radix positioning/scroll
locks, Recharts, certificate styling, print styled-jsx and academy accent styles
currently depend on inline CSS. It does not permit script/event-handler execution.
Separately, opaque interactive lesson documents intentionally retain unsafe-inline
scripts/styles in their **own** offline CSP; this is not an exception in Academy's
script-src. These are exactly the documents that need independent hosting before
full enforcement.

strict-dynamic delegates script loading to trusted nonce-bearing loaders, including
Next chunk loading. Audit must continue to prohibit untrusted input reaching
dynamic script creation. No such parent application script creation was found.
Direct DevTools execution and dynamically inserted scripts originating from a
trusted loader are not reliable examples of untrusted parser-inserted scripts.

## External origin inventory

| Origin | Directive / reason |
| --- | --- |
| identitytoolkit.googleapis.com | connect: email/password registration, login and account operations |
| securetoken.googleapis.com | connect: Firebase ID token refresh |
| firestore.googleapis.com | connect: Firestore reads/writes/listener transport |
| `https://NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | connect/frame: exact configured Firebase Auth helper origin (no firebaseapp wildcard) |
| Cloud Functions origins | Removed on 2026-10-13: active Spark-compatible workflows use same-origin Next APIs, not a callable |
| placehold.co, images.unsplash.com, picsum.photos | img: existing next.config.ts remote image hosts; current bundled default images are local |
| `NEXT_PUBLIC_EVIDENCE_BASE_URL` or academy.analyticsUrl | frame: Evidence admin analytics; default https://analytics.cloudaiacademy.ca |
| stackblitz.com | frame: lesson coding/embed tools |
| excalidraw.com | frame: lesson whiteboards |
| labs.whizlabs.com | frame: lesson labs |
| `CSP_STORAGE_ORIGINS` | connect/img/frame: comma-separated exact HTTPS S3-compatible upload/PDF/asset origins for this deployment; must be explicitly reviewed |

Origin inputs reject non-HTTPS schemes and credentials and discard URL paths,
queries/fragments. No secrets or .env values were copied into this document.
Set CSP_STORAGE_ORIGINS from actual successful presigned request origins, including
bucket-specific hosts when virtual-host addressing is used. Do not use broad AWS
wildcards. No S3 credentials are needed by the policy builder.

Google fonts use next/font/google and are self-hosted under /_next/static: no
runtime fonts.googleapis.com/fonts.gstatic.com exception. Stripe/PayPal APIs,
Genkit/Google AI and S3 SDK operations run server-side; they do not require
browser connect-src exceptions. Checkout/live Google Meet/Jitsi/Facebook/Maps
open by top-level navigation or separate tabs, not embedded scripts in Academy.
Firebase Storage is initialized but no browser upload/download calls were found;
no speculative storage.googleapis.com exception was added.

## Audited code and risks

- Next 15.5.26 App Router: middleware.ts (not Next 16 proxy.ts); next.config.ts;
  root layout; all src/public script, iframe, style, URL, fetch and HTML sinks;
  client Firebase SDK initialization/authentication; API and Functions integrations;
  package scripts and CI. No package upgrades or role/auth changes.
- Root theme-init and lang-dir-init: legitimate beforeInteractive scripts now
  carry the request nonce. Framework/hydration scripts receive the same nonce
  via the forwarded CSP header. Incoming nonce/CSP headers are overwritten.
- Journal JSON-LD: serializeJsonLd escapes all `<`, `>`, `&`, U+2028/U+2029, so
  attacker-controlled titles, abstract, author names and other schema fields cannot
  close the raw-text script element, even with CSP disabled. Nonce applied too.
- Chart dangerouslySetInnerHTML: current config is developer-defined RevenueChart
  color, not article/user data. Added identifier and declaration delimiters checks
  to prevent future config-based CSS/style element breakouts.
- Standard imported lessons render allowlisted React nodes, not raw HTML.
  Interactive uploaded scripts remain only in the opaque sandboxed iframe.
- Other frames: code tools/whiteboards/labs, Evidence, journal/reviewer/admin/lesson
  PDFs. Most PDF URLs are authorized same-origin API responses leading to exact
  signed S3 origins; blob/data previews require those scheme exceptions.
- Dynamic nonces force pages to render per request: no static HTML/ISR reuse.
  Middleware sets private/no-store; static Next assets stay cacheable/excluded.
  Increased server rendering/cost is a deliberate architecture tradeoff.
- Permissions-Policy disables camera, microphone, geolocation, payment, USB,
  serial, Bluetooth, motion sensors, display capture and clipboard-read.
  Clipboard-write remains enabled for same-origin classroom copy controls and the
  three explicitly trusted tool origins (also allowed fullscreen).
  Tool embeds requesting camera/mic/location will be denied; full functionality
  can still open separately. No wildcard sensitive capability grants.

## Verification and acceptance

Local results (2026-10-12): TypeScript passed; full lint zero errors/530 existing
warnings; new policy module additionally linted with --no-ignore because the
repository's existing ESLint config excludes all lib directories. Browser CSP
tests passed (including the documented enforced-data-frame incompatibility).
Existing non-emulator suite initially had one mock-import regression; fixed its
middleware loader and all four template/nonce tests now pass. The complete broad
suite was rerun and passed with one optional sample test skipped. Firestore rule
tests could not start: firebase-tools requires Java 21 but installed Java is 17.
`npm run build` was run, but stopped after more than 20 minutes without completing
the compile phase while available physical memory was low. No build success or
production rendering/authentication validation is claimed. Require a successful
build on an adequately resourced machine/CI before any release. No push/deploy.

```bash
# Local project
npm run build
npm run typecheck
npm run lint
node --test tests/billing/*.test.mjs tests/roles/*.test.mjs tests/journal/*.test.mjs
npm run test:firestore-rules # Java 21 required

# Kali: after a separately approved deployment
curl -s -D - -o /dev/null https://www.cloudaiacademy.ca/ | \
grep -iE "content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|strict-transport-security"

# Check login, protected routes, API failures, static assets too
for path in / /login /signup /admin/dashboard /teacher/dashboard /reviewer /api/courses/business-intelligence/lesson-imports /sw.js; do
  echo "=== $path ==="
  curl -s -D - -o /dev/null "https://www.cloudaiacademy.ca$path" | grep -iE 'HTTP/|content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|strict-transport-security|cache-control'
done

# Compare request nonces: must differ; HTML script nonce must match its own header
curl -s -D /tmp/academy-headers-1 -o /tmp/academy-body-1 https://www.cloudaiacademy.ca/
curl -s -D /tmp/academy-headers-2 -o /tmp/academy-body-2 https://www.cloudaiacademy.ca/
grep -i content-security-policy /tmp/academy-headers-{1,2}
grep -oE 'nonce="[^"]+"' /tmp/academy-body-1 | sort -u
```

Initial rollout: full Content-Security-Policy-Report-Only plus enforced baseline
Content-Security-Policy, nosniff, SAMEORIGIN, Referrer-Policy, Permissions-Policy
and Vercel's existing HSTS. **Unauthorized inline scripts still execute in
Report-Only**; they produce reports instead. Do not call this full XSS prevention.
After full enforcement the full CSP is in Content-Security-Policy, not Report-Only.

For a parser-inserted inline-script test after enforcement, select an ordinary
non-script element in Chrome Elements (available as `$0` in Console), then run:

```js
delete window.__academyInlineProbe;
$0.insertAdjacentHTML('beforeend', '<img src="/missing-csp-test-image" onerror="window.__academyInlineProbe=true">');
// After the image error:
window.__academyInlineProbe // undefined, with a CSP script-src-attr violation
```

For an actual inline script element (rather than an event handler), create a
temporary srcdoc frame. It inherits the page policy and parses the supplied HTML:

```js
const probe = document.createElement('iframe');
probe.onload = () => console.log('Inline script result:', probe.contentWindow.__academyInlineProbe);
probe.srcdoc = '<p>CSP probe</p><script>window.__academyInlineProbe=true<\/script>';
document.body.appendChild(probe);
// Enforced: undefined + CSP violation. Report-Only: true + report.
// Remove it after inspecting: probe.remove();
```

Do not copy a valid nonce onto the probe. Typing `alert()` in DevTools does not
test CSP; DevTools is privileged. Under strict-dynamic, appendChild script tests
can inherit trust and must not be interpreted as proof CSP is absent. The automated
browser test sends unauthorized `<script>` markup in the HTTP response, verifies
it is blocked, verifies nonce-approved code executes, and tests escaped JSON-LD.

Manual checks before enforcement: fresh login/signup/logout/password reset/token
refresh; Firestore listeners and writes for each role; admin callable fallback;
all role guards/direct URLs; theme/light/dark and English/Arabic reloads; chart,
print/QR/certificate layout; S3 uploads and PDF previews; analytics/code/whiteboard/
lab embeds; interactive simulations/quizzes; navigation and lazy chunks, back/forward
and reload; no CSP violations except explicitly understood ones. Test real accounts
in staging—automated fixtures do not prove production roles/authentication.

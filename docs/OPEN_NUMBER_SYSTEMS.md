# Public Number Systems course

Public URL: `/open-courses/number-systems`. Linked from Courses, public Lecture
Resources, and the administrator's Resources page. Available without registration.

## Admin-managed courses (current)

Administrators use `/admin/open-courses` (Open courses in Academy management).
Upload a ZIP, edit bilingual metadata/language/duration and optional thumbnail,
save a private draft, preview the saved package, then explicitly Publish. Withdraw
blocks subsequent anonymous API reads and removes the course from new listings;
already loaded/downloaded copies cannot be recalled. Metadata edits use revision
checks to reject stale saves. Replacing lesson packages is not supported in this
version: create and preview a new draft, then withdraw the old course if needed.

The homepage, Courses and Resources now read `/api/open-courses`; failures show a
retry state, never a stale built-in fallback. Number Systems remains available at
its original URL. Its original content remains bundled, but administrator metadata
and publication overrides are persisted in `openCourses/number-systems`. A saved
withdrawal suppresses the built-in fallback even if no published records remain.

New content is validated again on the server and stored as private JSON objects
in the existing lessons/journal MinIO bucket at `open-courses/{UUID}.json`.
Metadata is stored in server-only Firestore `openCourses` records; no new client
rules or Firebase Blaze functions are needed. The default-deny Firestore rules
are covered by the course-lifecycle emulator test. APIs verify revoked ID tokens
and current administrator profiles. Storage privacy is checked before upload;
new objects are cleaned up if creating their metadata fails. No storage settings
or certificate records are modified. Deployment uses existing server credentials.

ZIP parsing is local (10 MB ZIP limit) and only the validated self-contained
package is sent to the server (3 MB request maximum, about 2.9 MB lesson package).
Up to 20 HTML lessons are supported. Local CSS/JS/images/fonts are bundled by the
existing importer. External CSS imports, network APIs and form submission are not
supported: bundle assets and use local button handlers. Always preview imported
quizzes. Thumbnail uploads are resized and rasterized locally, capped at 80 KB
data-URL text; SVG is not accepted. Lists paginate 20 records per request.

This workflow does not create enrollment/progress/certificate records. Public
content is returned only after publication checks; private previews require an
administrator bearer token. All content APIs are no-store. Uploaded scripts run
only in the existing opaque iframe sandbox, never in the parent DOM.

Tests: `open-course-management.test.mjs` (API authorization/storage/publication),
`manage-open-courses.browser.test.mjs` (admin/guest EN/AR workflow), existing
interactive-isolation browser tests, and Firestore course-lifecycle tests.

## Initial homepage discovery (superseded by API-backed listings)

The homepage shows **Free Courses — No Registration Required** directly after the
hero. Homepage, Courses and Resources render the same `OpenCoursesSection` from
`src/lib/open-courses.ts`. Only entries with `published: true` and `access: 'open'`
appear. Free enrollment courses are not inferred to be anonymously accessible.
To add another curated course, first implement and verify its public player/route,
then add its bilingual metadata to the catalog. All three listings update on the
next code deployment; this is not an administrator upload/publication control.

This is not a Firestore enrollment course. Its bundled lesson content still
requires a code release to change; metadata and withdrawal use the admin workflow.
Existing private courses, lesson
APIs, storage buckets, certificate records, and Firestore rules are unchanged.
No paid service or new infrastructure is required. Quiz scores are transient;
no progress persistence or certificates are promised.

## Source and isolation

Source: user-supplied `Number_Systems_Arabic_Interactive.zip` (2026-10-28), containing
index.html, style.css, script.js and README.txt. The converter uses BigInt, supports
Arabic digits and validates base-specific digits. Quiz answers are local constants.
No uploaded code is inserted into the Academy parent DOM.

`src/content/number-systems.json` is a self-contained lesson compiled using the
existing `parseInteractiveZip` validator/bundler. Its Google Fonts CSS import was
replaced by embedded Cairo WOFF2 fonts from the existing Next.js font build, with
the SIL license retained in `src/content/CAIRO-OFL.txt`. No external font requests
are necessary. The quiz grades via a button click instead of form submission,
because the sandbox intentionally forbids form submissions. Its answer key and
scoring are unchanged. The rest of the supplied lesson is preserved.

The existing InteractiveLessonPlayer wraps it in an opaque data-URL iframe with
only `allow-scripts`; no same-origin permission, network, popups, top navigation,
camera or microphone. Its internal CSP permits inline/data scripts only inside
this isolated document. No Academy CSP was weakened. The existing full Academy
CSP remains report-only; future enforcement must rerun iframe inheritance tests.

## Private draft package updates (2026-10-31)

Administrators can edit a private open course and select **Replace draft ZIP**.
The new package is previewed locally and saved with **Save details**. It retains
the course ID/URL, saves metadata and content pointer together, and never publishes.
Published courses and the bundled Number Systems lesson cannot use replacement.

PUT /api/open-courses requires the current administrator role, validated metadata,
a validated bounded package and the current revision. It uploads to an immutable
private key under open-courses/{courseId}/{versionUUID}.json, then uses a Firestore
transaction to recheck private status/revision before changing the pointer. Old
objects remain available for operator recovery. Failed/ambiguous transactions may
leave private orphan objects; do not automatically delete them after a timeout,
as the transaction may have committed. No public bucket permissions change.
There is no rollback UI yet; recovery requires an audited administrative action.
GET responses do not expose contentKey. Existing legacy object paths still work.

Tests cover same-ID replacement/preview, published and stale rejection, role
checks, legacy fallback, and retaining old content. New instructional packages are
review drafts, not approved semester curricula; content publication is separate
from shipping this editor feature.

## Verification

`node --test tests/roles/open-number-systems.browser.test.mjs`

Set INTERACTIVE_TEST_BROWSER to a Chrome executable if bundled Chromium is absent.
Run typecheck, roles/layout tests and build. After deployment, open the public URL
in a signed-out browser; test converter, invalid input, Arabic digits, bit switch,
quiz grading/reset, mobile width, and that no enrollment/login is requested.

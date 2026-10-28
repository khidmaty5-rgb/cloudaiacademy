# Public Number Systems course

Public URL: `/open-courses/number-systems`. Linked from Courses, public Lecture
Resources, and the administrator's Resources page. Available without registration.

This is a curated, repository-managed course, not a Firestore enrollment course.
Updates and withdrawal require a code release. Existing private courses, lesson
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

## Verification

`node --test tests/roles/open-number-systems.browser.test.mjs`

Set INTERACTIVE_TEST_BROWSER to a Chrome executable if bundled Chromium is absent.
Run typecheck, roles/layout tests and build. After deployment, open the public URL
in a signed-out browser; test converter, invalid input, Arabic digits, bit switch,
quiz grading/reset, mobile width, and that no enrollment/login is requested.

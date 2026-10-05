# CloudAI Academy work log

## 2026-10-04 — HTML lesson ZIP import

- Added an English/Arabic ZIP import dialog to the existing course lesson manager: local parsing, ordered preview, editable titles/reordering before save, resumable private drafts and explicit publication confirmation.
- Uploaded HTML never runs. Content becomes a validated React-rendered document tree; scripts, styles, embedded players and executable attributes are excluded. Safe external and cross-lesson links, tables, headings, lists and local PNG/JPEG/WebP images are preserved. Missing/oversized images and unsupported links are reported.
- Limits: 60 MiB ZIP, 1,000 entries, 100 MiB declared expansion, 8 MiB selected extraction, 20 lessons, 250 KB HTML, 400 KB per image, 750 KB per converted lesson and 3 MB API payload. No filesystem extraction or external resource fetching. Source ZIP stays on the user's device.
- Server verifies tokens including revocation, effective roles and course assignments; rechecks role/assignment within the publication transaction. Drafts use server-only course lessonImports/importLessons collections, separate from student-visible lessons. Atomic create-only publication appends stable IDs and ordered timestamps; retries cannot duplicate or overwrite existing lessons.
- Imported formatted text is read-only in the existing plain-text editor; title/integration controls remain available. Reimport edited source as a new draft to change rich content. This is HTML package import, not SCORM execution or a rich-text authoring editor.
- User's actual example parsed into five correct ordered lessons, preserving all referenced local images. Converted lessons total about 1.5 MB; two oversized unused template images are skipped. Sample content is not committed to Git and was not uploaded to production.
- Local typecheck and lint passed (existing warnings plus a data-image renderer warning). Parser/policy and mocked API tests pass, including forbidden roles, malformed content, idempotency and rollback. Added Firestore emulator coverage for direct draft access denial. CI and deployment verification pending.
- Isolated browser fixture used real import components with mocked identity and in-memory API: preview, title/order changes, save/resume, and explicit publish flow passed. Arabic 390px dialog had no horizontal overflow. This is not a claim of production writes or real sign-ins for every role.

## 2026-10-04 — Cairo and editor integrity

- Replaced the Arabic font with Cairo; translated course and lesson editor labels, validation and action feedback. Reduced form spacing, improved RTL field direction and instructor label associations, named lesson edit controls and reset forms between selected lessons.
- New lessons use generated document IDs instead of title-derived IDs, protecting duplicate and Arabic titles. Existing lesson IDs stay unchanged.
- Enrollment uses a transaction and leaves existing enrollment progress and metadata untouched.
- Local TypeScript, 19 role tests, seven layout tests and three new learning-record regression tests pass. Lint has no errors; existing warnings remain. Regression tests use mocked Firestore and do not establish real concurrent emulator coverage.
- Build and deployment verification pending. No production data has been edited.

## 2026-10-03 — Layout audit repair release

- Completed the audit's layout implementation: responsive user cards and loading states; full-width editorial queue with expandable issue tools; Arabic editorial filters, actions and dates; viewport-bounded dialogs; readable light/dark accent contrast; consistent workspace gutters, headings and card treatment; Arabic web font; reduced-motion support; denser course cards with decorative thumbnail alt text; compact-width teaching, learner and settings grids.
- Navigation keeps expanded sections within a mounted workspace, searches route aliases, respects journal visibility, and identifies teaching course editing. Public/workspace selection waits for authentication. Optional homepage sections wait for settings before showing defaults.
- Browser fixture verification uses real components and inert sample data: English/Arabic user cards at 390px and 1024px, Arabic editorial layout at both widths, dark mode. Mobile role controls measured x=41px / width=293px, fully within the content area. No whole-page horizontal overflow in these checks.
- Local TypeScript, 19 role/navigation tests, seven layout contracts and full lint passed (existing warnings remain). Final build, release and production verification are tracked below when complete.
- No production account roles, submissions, prices, payment rules or stored course content were changed. Course currency and stored translations require authoritative content values; prices are intentionally preserved.
- Real authenticated coverage remains the administrator account; role fixtures and policy tests must not be described as successful real logins for all roles.


## 2026-10-03 — Live-session layout completion

- Applied the previously blocked fix: loading, login-required, and access-denied live-session states now use SiteShell. Signed-in visitors retain the shared workspace navigation; the focused Jitsi classroom is unchanged.
- Confirmed PR #16 merged as `8eeb9a850cbc96715041a75334f9f21cdb35046f`; production CI and Vercel deployment both succeeded. Production CI: https://github.com/khidmaty5-rgb/cloudaiacademy/actions/runs/36868332673.
- Follow-up validation: TypeScript, ESLint with zero errors, all 19 role/navigation tests, and diff checks passed. Remote build and deployment pending. Existing unrelated untracked image and Word temporary file remain untouched.
- Remaining QA limitations: only the admin account has real authenticated browser coverage; other roles were checked with policy tests and isolated UI fixtures. Stored English course content still needs a separate translation pass.

## 2026-10-01 — Handover recovery

- Confirmed target: CloudAI Academy, not the current Khidmaty Mobile workspace.
- Redesign committed as `2f2594f` on `codex/role-navigation-redesign`, then merged in PR #16. Deployment confirmed on Oct 3 (see above).
- Corrected build status: the previous local production build did not finish. No `.next/BUILD_ID` exists; process activity was not evidence of successful compilation or static generation.
- TypeScript, 19 role/navigation checks, full-source lint with zero errors, and diff whitespace checks passed before this handover. Fixture browser checks used simulated identities, not five real logins.
- Next implementation: simplify the still-crowded public header; retain role tools in the shared workspace and visibility controls in Website settings. Then revalidate and release only after passing checks.
- Implemented Oct 1: compact public header with a single workspace entry, public mobile drawer, translated account controls, and no duplicate staff mega-menu. Removed non-working placeholder social links; footer section links now respect visibility and point to the homepage. Website settings cannot save after a failed settings read.
- Verified Oct 1: TypeScript, full-source ESLint (zero errors), 19 role/navigation tests, and diff checks pass. Real signed-in admin browser checks passed: public-to-workspace navigation, menu search, courses retaining the workspace, Arabic account controls, Arabic mobile drawer, and 320/390px navigation. Closed-page width at 320px equals the viewport. No account roles or course data were edited as part of these checks.
- All six PR checks passed, including the remote production build and Vercel preview. The local Windows build was stopped without completion; it must not be reported as passing. English-only course titles/descriptions are stored content, not translated by this navigation pass.

## 2026-09-30 — Navigation and workspace redesign (in progress)

- Request: simplify and modernize menus and page layouts, restore access to existing features, and verify English, Arabic, desktop, mobile, and role boundaries.
- Starting point: `4278a67` (PR #15), branch `codex/role-navigation-redesign`.
- Handover audit: only `src/lib/workspace-navigation.ts` was saved. Earlier attempts to add the shared workspace shell failed automatic approval review due to an account usage limit. No redesign was committed, pushed, or deployed.
- Preserve unrelated untracked `public/images/logo - Copy.png` and `~$README.md`.
- Known issues: competing public/workspace navigation, missing staff navigation on profile and course routes, missing learner journal/Telegram links, mobile editor links inconsistent with route permissions, and incomplete Arabic labels.
- Current scope: shared authenticated shell and route navigation; keep existing authorization checks and data operations intact.
- Implemented: one authenticated workspace shell across courses, profile, admin, teaching, reviewing, lessons, research, journal, and Telegram; grouped navigation with menu search; mobile drawer; Arabic direction/labels; account controls; responsive course filters/grid; compact dashboard cards and localized enrollment actions/dates.
- Fixed the header's administrator/editor role confusion that hid admin destinations. Restored website visibility controls in Website settings and corrected initial document-loading state to avoid initializing settings drafts before their data arrives.
- Verification: TypeScript passed, 19 role/navigation policy checks passed, and changed-file lint passed with 12 existing `any` warnings. Every menu destination exists. Browser fixture checks confirm menu search, active destination, Arabic mobile drawer, close behavior, and learner course navigation. The fixture uses real components with simulated identities and no Firebase connection; this is not login testing.
- Historical pending items from Sep 30 are superseded by the Oct 1 entry above.
- Real sign-in verification so far covers the administrator only; other roles must not be described as login-tested.

Update this entry when implementation, verification, or deployment state changes. Record concrete results separately from intended work.
# 2026-10-05 — Teacher role and recoverable permission errors

- Confirmed admin navigation/layout allowed teaching pages while page-level guards denied them. Both pages now admit admin and teacher, retaining assignment-filtered course queries and server authorization.
- Query failures now show an explicit bilingual retry state, not a misleading empty course list. Teacher dashboard action labels translated into Arabic.
- Removed the production-only fatal throw for Firestore permission denials; a dismissible, generic alert preserves the application shell without displaying sensitive error details or bypassing rules.
- Added six rendered-component regressions covering all five roles, query denial states, Arabic actions, and production permission-error rendering. Included in test:roles/CI.
- These changes fix confirmed source defects. The screenshot's exact runtime cause and real teacher sign-in are not yet verified. No live data or role assignments changed.
- PR20 ZIP importer was merged as 96eee121b72c727dc785144d49f5af4f593e9be7 with all PR checks passing; post-merge deployment verification is separate.

# 2026-10-03 — Deep layout audit: first repair batch

- Target: CloudAI Academy only. User requested implementation after the layout audit.
- User management: content-width adaptive cards, readable wrapping identities, full-width role controls below identity, neutral surfaces, localized empty states/dates, wrapping page actions.
- Session layout: wait for authentication before selecting public/workspace shell; removed public layout wrapper swapping. Authorization and role mutations unchanged.
- Initial checks: TypeScript and 19 existing role tests passed; targeted lint has no errors (existing warnings remain).
- Added two source-contract regressions. Browser geometry verification, production build, commit/push and deployment remain pending. Do not describe this batch as deployed or all-role verified.
- Remaining audit work: contrast, editorial table layout/Arabic, menu state/visibility, homepage settings loading, course content/pricing, shared page templates, real role visual QA.

# CloudAI Academy — verified roles and layout backlog

Created: 2026-10-12. Updated: 2026-10-13. Status: user authorized implementation and deployment on 2026-10-13; deploy only after validation.
Source: user's CloudAI_Academy_Roles_Layout_Codex_Report.md, checked against local Academy source.
Repository: C:/Users/dhnos/Downloads/studio-2/CloudAIAcademy.

## Scope and existing work

Preserve single-role Firestore records, Firebase authentication, profile-authoritative
authorization, course ownership, journal review boundaries, public pages, Cairo,
English/Arabic/RTL and dark/light themes. No roles[] migration. Deployment authorization supersedes the earlier local-only constraint.
Existing shared shells and route/navigation tests are foundations to extend, not rewrite.
Source inspection confirms code behavior; it is not proof of live role sign-ins or deployed Functions.

Security-header changes are already uncommitted in this checkout. Keep that diff
separate from the role/layout phases. Full CSP enforcement remains blocked by
data-frame inheritance and exact S3/embed origin inventory; see SECURITY_HEADERS.md.
The earlier build/Java blockers were resolved locally; see BUILD_VALIDATION.md
for the completed build and isolated Java21 emulator evidence. No phase may be
called release-ready without a successful build and relevant security tests.

## Capability/navigation checkpoint — 2026-10-13

Spark-only follow-up: user prohibits paid-plan upgrades. Active account creation
and claim synchronization now use existing Next APIs, not Firebase Functions.
Removed audit worker; added admin pending-audit recovery panel/current-role-only
retry endpoint, preserving durable audit and profile-authoritative controls.
136 broad tests/four optional skips, 14 transaction/query/recovery emulator tests,
build/typecheck/lint and built-server smoke pass. No offline automatic retry claim.
No Blaze requirement for active role workflow. Production-rule approval remains
independent; no rules redeployment or billing change attempted in this follow-up.

Latest release checkpoint: contextual workspace switching, width specificity fix,
bounded People paging/page-local search, confirmation/self-change UI and missing
review Arabic implemented. Five-role desktop/mobile bilingual browser checks pass;
132 broad tests, 57 rules tests and 12 transaction/query tests pass. Build passes.
See RELEASE_2026_10_13.md for precise included/remaining scope and release status.
Earlier foundation-only notes below describe the previous batch, not this update.

R07 foundation: added a typed single-role capability map and wired navigation
through it AND the existing explicit route policy. Server checks/rules remain
authoritative, with no stored role changes or new learner enrollment rights.
Before/after tests assert exact destination-set parity for all five roles.

R10 foundation: explicit per-role section order; administration overview precedes
settings, teaching is separate from learning, and editorial/review tools are
distinct groups. Both languages use the existing shared desktop/mobile shell.
No namespace migration or workspace switcher yet: R08/R09 and the remainder of
R10 remain open. No live sign-ins or visual browser acceptance claimed.

Local validation: TypeScript and targeted ESLint pass; 14 route/navigation tests
pass; broad non-emulator suite passes 129 tests with four optional skips.
Production build passes (47s compile, exit 0, built-in lint/type checks; existing
lint warnings remain). Diff whitespace check passes. No deployment.

## Findings: confirmations and corrections

| Report item | Source assessment |
| --- | --- |
| 1 Telegram mismatch | Confirmed: navigation/route target student+reviewer; page and provider APIs admin+teacher. Webhook/connect-confirm uses a separate integration trust boundary—do not blindly convert every Telegram endpoint to session-role authorization. |
| 2 stale callable claim | Confirmed: functions/src/index.ts adminCreateUser checks token.role; src/lib/user.ts calls it before the Next API. Requested role has a TS annotation, not runtime whitelist validation. |
| 3 repeated role definitions | Confirmed in models, route-access, roles, useCurrentRole, server resolver, APIs and Functions. |
| 4 capabilities | Proposed architecture, not an existing implemented layer. Preserve current effective privileges first. |
| 5 misleading admin namespace | Confirmed special cases for teaching dashboard/course edit and editorial desk. |
| 6 duplicate teacher dashboard | Confirmed: admin dashboard contains teacher queries/branches despite /teacher/dashboard existing. |
| 7 fail-open routes | Partially confirmed: null is treated as allowed. Unknown /admin/* and /teacher/* already inherit restricted roles, and /reviewer/* is restricted. Exact /admin returns null; /teacher is unmatched. Explicit registered policies still needed; do not claim every unknown protected subroute is currently open to all roles. |
| 8 contextual workspaces | Proposed UX improvement. Shared WorkspaceShell already exists; no need for five new shells. |
| 9 implicit section order | Confirmed: shell uses insertion order of links via Set. |
| 10 terminology | Audit task; inconsistent labels need a catalog, not blanket replacement of stored role keys. |
| 11 container specificity | Confirmed high-specificity workspace rule forces max-width:80rem over page max-w utilities. |
| 12 WorkspacePage | Proposed shared API; existing responsive spacing/heading rules must be migrated carefully. |
| 13 mobile tables | Risk confirmed by global overflow-x:clip; actual clipping not newly reproduced. Some previous responsive repairs already exist. Audit each page and fix only remaining failures. |
| 14 People scale | Confirmed all-users query and five role groups; no search/pagination/detail workflow in inspected page. |
| 15 role-change safeguards | Selector applies changes immediately. API permits admin role changes without last-admin guard; self-role edits are not categorically forbidden. Owner self-promotion is not gated by NODE_ENV; bootstrap uses a separate flag. |
| 16 audit trail | No dedicated role-change audit write in inspected API. Direct admin profile writes and owner profile deletion are allowed by current rules, so API-only safeguards can be bypassed. |

## Ordered task queue

### Build-gate checkpoint — 2026-10-12

G01 build gate now passes locally. Recursive credential-file tracing was the
confirmed stall source, fixed with literal equivalent paths in 16 implementations.
Standard production build, bundled TypeScript/lint and 127 non-emulator tests pass;
four optional cases skipped in the broad suite, with built-server smoke checks
separately passing in Report-Only and enforced modes. The smoke check found/fixed
framework nonce propagation by moving the unchanged baseline into static headers.
See BUILD_VALIDATION.md for evidence, changed files and remaining release gates.
No deployment. This supersedes the build-stalled statements in older checkpoints.

### Implementation checkpoint — batch 2, 2026-10-12

R04 locally implemented: explicit policies and unknown-route denial, preserving
the intentional /admin public login. R05/R06 core local safeguards implemented:
transactional profile/audit writes, serialized admin demotions, self-role refusal,
client role/delete bypass closure, idempotent request IDs and durable claim-sync
worker. See ROLE_CHANGE_SECURITY.md for boundaries and tests. No account-deletion
workflow, sensitive confirmation/audit-viewer UI or real staging verification yet.

Java21 test gate solved with temporary portable runtime; 57 rules/policy tests,
five teacher-query tests, five real transaction/API tests, 125 non-emulator tests
pass (one optional skip), TypeScript/lint/Functions build pass. Next build still
stalls in compile and is NOT passed. No commit/push/deployment. Earlier checkpoint
below describes the prior batch, not current verification. CSP enforcement gate
remains separate. Next focus: resolve production-build gate and manual role-change
acceptance before larger capability/navigation/layout refactoring.

### Implementation checkpoint — first security batch, 2026-10-12

Local changes only; no commit, push, Functions deploy, rules deploy or Vercel deploy.

| Task | Progress |
| --- | --- |
| R01 | Locally implemented: /teacher/telegram, shared existing UI, legacy redirect, teacher/admin-only navigation and new/legacy guards, new module-toggle path. Five-role navigation/page/API tests pass; live redirect/authenticated QA and production build remain required. |
| R02 | Locally implemented: callable requires current admin profile (missing/invalid/read failure denied), runtime requested-role validation, trigger role validation. Actual handler mocked-service regressions, Functions lint/build pass. No cloud users/data changed. |
| R03 | Initial adoption: one dependency-free roles source in functions/src/user-roles.ts, Next re-export, model/route types, claims/client/server normalization, admin API validators and People selector. Remaining repeated form schema/type aliases can be migrated in the next batch; no broad capability-policy changes yet. |
| G01 | TypeScript and broad non-emulator suite pass; lint zero errors/530 existing app warnings, Functions lint zero errors/one existing warning. Next production build retried but stopped in compile phase with high memory use and no completion. Java21 emulator gate remains unresolved. NOT release-ready. |
| R04-R17 | Not completed. Route fail-closed semantics, last-admin/audit paths, capabilities, new layouts and People redesign remain queued. |

Source/test-only diff: cloudai-roles-phase1-source.patch in the current thread's
visualizations directory. It intentionally excludes pre-existing CSP changes,
generated Functions outputs and mixed CI/template-test changes. Functions build
regenerated lib outputs. CI now includes callable/Telegram tests. API authorization
tests use mocked Firebase services, not actual production sign-ins.

All unchecked items are TODO. P0 precedes visual refactors. IDs stay stable for follow-up work.

### Phase 0 — baseline and release gates

- [ ] G01 — Preserve and separate existing CSP diff; establish a passing baseline.
  - Capture tracked/untracked changes without reading/copying secrets. Keep security headers out of role/layout commits unless explicitly integrated.
  - Arrange Java21 for emulator tests and enough resources for a successful npm run build.
  - Acceptance: baseline tests/lint/typecheck/build recorded; known failures explicitly categorized; no deployment.

### Phase 1 — security and policy consistency

- [ ] R01 (P0, report 1) — Repair Telegram route/navigation contradiction.
  - Prefer /teacher/telegram; legacy /dashboard/telegram redirect must work for authorized staff despite the current learner-only parent layout.
  - Teacher/admin only, teaching/communications section, preserve provider API checks and signed integration callbacks.
  - Acceptance: student/reviewer/editor see no link and cannot reach new or legacy protected content/API; teacher/admin can use both entry paths without redirect loops. Five-role navigation/guard/page/API tests agree.

- [ ] R02 (P0, report 2) — Eliminate stale-claim callable authorization.
  - Decision: retain and harden callable versus use Next API exclusively. Default planning preference: harden existing callable to avoid changing frontend fallback behavior without evidence.
  - If retained: authenticate, load current profile, require valid admin role, whitelist requested role at runtime, deny read failures and stale admin token after demotion. Decide missing-profile handling explicitly; never revive privilege from stale claims when a profile exists.
  - Inspect profile-created/updated triggers too; no invalid roles propagated into claims.
  - Acceptance: demoted caller denied without token refresh; active admin works; malformed role rejected before account creation; Functions tests/build pass; no live users created by tests.

- [ ] R03 (P1, report 3; supports R02) — Canonical roles and runtime validation.
  - Export USER_ROLES, UserRole and isUserRole from a dependency-light source. Replace duplicated types/validators/select options incrementally.
  - Share with separately built Functions only where packaging allows; otherwise verify parity with a contract test.
  - Acceptance: five unchanged role keys, no circular imports; existing profile-authority/fallback/error tests continue passing.

- [ ] R04 (P1, report 7) — Explicit fail-closed route policies.
  - Distinguish public, authenticated, role/capability restricted and denied/unregistered protected routes.
  - Cover exact namespace roots as well as nested URLs, route groups, /learn and intended generic /profile access.
  - Acceptance: unknown protected routes denied rather than silently generalized; public URLs stay public; correct unauthorized redirect/no-loop behavior for each role. Retain server/rule authorization independently.

- [ ] R05 (P0 review / P1 implementation, added finding + report 15) — Secure role-changing paths end-to-end.
  - Inventory API, callable, Firestore client writes, triggers, profile deletion, owner recovery and bootstrap paths.
  - Review production owner override and bootstrap gates; preserve deliberate recovery only through explicit controlled policy.
  - Design concurrent last-admin protection covering demotion AND deletion, including two-admin simultaneous changes.
  - Prevent direct client role writes/deletion bypassing the chosen server workflow. Preserve legitimate profile-name edits and existing admin non-role operations.
  - Acceptance: invalid/self/sensitive transitions have documented policy; no last-admin loss through any supported path; bootstrap/recovery tested; no widened rules.

- [ ] R06 (P1, report 16; depends R05) — Durable role-change audit and claim-sync reliability.
  - Dedicated server-written events: actor UID, target UID, previous/new role, server timestamp and optional bounded reason; email only if appropriate under privacy policy.
  - Atomically couple authoritative profile change and audit event; handle custom-claim failure with retry/idempotent recovery rather than half-finished privilege state.
  - Acceptance: ordinary users cannot write/edit/delete audit events; unauthorized attempts never change role; successful actions are attributable; retry does not duplicate events; demotion remains effective during claim-sync failure.

### Phase 2 — capability and route architecture

- [ ] R07 (P1, report 4; depends R03/R04) — Capability layer without data migration.
  - Derive learning, teaching, review, editorial, administration and Telegram capabilities from current single roles.
  - Produce and approve an explicit before/after privilege matrix; do not silently grant admin/teacher/editor learner enrollment or remove existing authorized lesson access.
  - Acceptance: UI/navigation/route helpers agree; server checks and Firestore ownership remain authoritative; no stored role changes.

- [ ] R08 (P1, report 5; depends R07) — Teaching/editorial route namespace migration.
  - Teacher course management -> /teacher/courses/[slug]/manage; editorial -> /editorial (final names finalized in route inventory).
  - Keep authorized legacy redirects, update links, active navigation, module toggles/middleware, imported-draft query parameters and route tests.
  - Acceptance: existing bookmarks/deep links still work, query parameters survive, teachers only manage assigned/owned courses; editor/admin editorial boundaries unchanged.

- [ ] R09 (P1, report 6; depends R08) — Single teacher dashboard.
  - Inventory and migrate useful teacher statistics from admin dashboard before removing branches.
  - /admin/dashboard becomes admin-only; authorized teacher legacy entry redirects to /teacher/dashboard before conflicting guards deny it.
  - Acceptance: no lost teaching metrics/actions, no duplicate queries/shells, non-teaching roles denied.

- [ ] R10 (P1, reports 8/9; depends R07-R09) — Contextual workspace navigation.
  - Shared shell; capability-derived Learning/Teaching/Reviewing/Editorial/Administration switcher where appropriate.
  - Explicit ordered section metadata, account area role badge, active route-derived workspace and accessible mobile switcher/search.
  - Acceptance: admin no longer sees every tool in one long undifferentiated menu; allowed destinations remain discoverable; Arabic/RTL/keyboard/mobile and direct-link behavior pass.

- [ ] R11 (P1, report 10) — Consistent bilingual vocabulary.
  - Catalog and standardize role/workspace/action labels; journal reviewer terminology uses محكّم where appropriate.
  - Acceptance: one approved English/Arabic vocabulary, no changed database keys, no missing labels or broken mixed-direction text.

### Phase 3 — layout and people UX

- [ ] R12 (P1, reports 11/12; depends route inventory) — WorkspacePage/PageHeader and width specificity.
  - Explicit form/standard/wide/full width intents; centralized padding/title/actions/loading behavior. Remove the high-specificity blanket 80rem override carefully.
  - Migrate admin users/courses/dashboard, teacher dashboard and reviewer first, one page at a time.
  - Acceptance: narrow forms remain narrow; wide dashboards remain wide; one H1, accessible hierarchy; mobile actions stack; no duplicate page/shell spacing; theme/Arabic/Cairo unchanged.

- [ ] R13 (P1, report 13; depends R12) — Remaining mobile table/overflow audit.
  - Users, courses, admin stats, teacher courses, journal/editorial and enrollment requests.
  - Scroll within named keyboard-accessible table regions or responsive cards. Do not mask lost content with overflow-x:clip.
  - Acceptance: all columns/actions reachable at 390px and wider; no page-level horizontal scroll, RTL scroll direction and focus visible; preserve already-fixed pages.

- [ ] R14 (P1, report 14; depends R12) — Scalable People directory.
  - Search, role filter, optional access/status filter, pagination/progressive querying and detail drawer; choose server/query strategy that actually avoids fetching every user.
  - Preserve secure admin-only access, indexes and bilingual labels.
  - Acceptance: bounded loading for large synthetic datasets, stable pagination/filter results, clear empty/error/loading states, accessible mobile details and role badges.

- [ ] R15 (P1, report 15; depends R05/R06/R14) — Sensitive role-change confirmation UX.
  - Confirm admin promotion/demotion and sensitive editorial grants; show privilege summary and selected user's identity.
  - Explain prohibited self-role edits/last-admin changes; cancellation makes no request; claim propagation/retry is clear.
  - Acceptance: UI matches server policy, no optimistic success on rejected/partial changes, audited transition visible only to authorized staff.

### Phase 4 — final verification and future-only design

- [ ] R16 (P1, report test requirements; applies to EVERY phase) — Unified five-role access regression matrix.
  - Telegram, teaching dashboard/course management, review queue, editorial desk, People, learning, generic profile and legacy redirects.
  - Cross-check navigation, guard, page, API/callable and relevant Firestore rules; include stale claims, ownership, failed reads and disabled modules.
  - Acceptance: no link advertises inaccessible functionality; no direct URL/API bypass; real staging sign-ins documented separately from mocked tests.

- [ ] R17 (P2, report future readiness) — Document multi-role extension design only.
  - Show future primaryRole/assignments integration with capabilities/workspaces, constraints and migration/rollback strategy.
  - Acceptance: no roles[] writes, schema migration or privilege change in this work. Implementation requires a separate explicit request.

## Phase completion gates

For each small implementation phase: show changed files/diff, behavior changes,
test outcomes and remaining risks. Run relevant existing/new tests, TypeScript,
lint, Firestore emulator tests when authorization/rules change, and npm run build.
Functions changes require Functions lint/build/tests too. No suppression of
build/type errors, no weakening rules to pass tests, no automatic deploy.

Final handoff: final role/capability, route and navigation matrices; legacy redirect
inventory; manual five-role checklist at desktop/mobile and English/Arabic; technical
debt and CSP follow-up status. Stop and investigate regressions before continuing.

## Recommended next implementation batch

G01 baseline -> R03 canonical runtime whitelist + R02 callable repair -> R01 Telegram
consistency -> R04 route policy tests. Review R05 security design early. Do not
begin the large People/sidebar redesign before these authorization paths agree.

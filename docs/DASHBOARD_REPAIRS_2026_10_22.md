# Dashboard repair release — 2026-10-22

Baseline / rollback: `524b9b4a9da8dd78f7e86395543189e0b0b42f6a` (PR35).

## Implemented

- Reviewer: clear prior comments, ignore stale responses, block submission after
  failed loads, prevent double submission, and preserve retry state.
- Payment/profile: block saves before reads succeed, retain edited values across
  snapshots, prevent duplicate writes and explain partial profile-save failure.
- Learning: course suggestions use published catalog matching; external AI execution
  is disabled even if an old key exists. Placeholder scored quizzes are replaced
  by an honest unavailable state; no teacher-authored question bank is claimed.
- Lists: explicit recoverable errors for courses, lessons, journal and profiles.
- ZIP imports: visible saved drafts with Resume import; validate draft-list responses
  and clear previous previews when resuming another draft.
- Telegram: queued is not delivered; visible load errors, refresh and send locks.
- Analytics: opt-in external iframe with title and a persistent fallback explanation.
- Journal: bilingual submissions retain `both`; editorial loading starts at 50 and
  exposes Load more. Search/filter scope is stated explicitly.
- Waitlist: fallback warnings persist; Load more exposes additional results.
- Overview: aggregate counts instead of downloading all users/enrollments; label
  lookups limited to 50 users/100 courses and recent enrollments to 50 dated records.
  Missing labels fall back to IDs; healthy panels survive other read failures.
- Arabic payment/reviewer copy, Research overview label, and truthful certificate
  record-created/PDF-unavailable notification without contradictory success toast.

## Verification and release boundaries

New regression tests execute the actual reviewer/payment handlers for failure,
late-response and duplicate-click cases. Browser tests cover ZIP save/retry/resume
and the five-role shell in English/Arabic at desktop/mobile sizes.

This does not constitute live sign-in acceptance of every destination. Analytics
hosting, Telegram worker health, certificate storage, production count indexes and
saved-plan generation/save remain live acceptance items. A queued Telegram job is
not proof of delivery. An unavailable quiz is not a completed assessment feature.

No production data, roles, billing, provider configuration, Firebase Functions or
Firestore rules are changed by this application release. Full CSP enforcement
remains parked. The previously tracked Firestore rules-release parity is unverified.

Preserve unrelated local SECURITY_HEADERS.md changes and CSP diagnostic files.

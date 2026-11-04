# Anonymous assignments and private Q&A

Public open-course pages offer PDF/JPEG/PNG submissions (2,000,000 bytes max) and private text questions. Administrators review them in **Admin > Open courses > Student assignments & Q&A**. Teachers have no blanket access because open courses have no authoritative teacher ownership mapping.

Students save a 256-bit secret receipt link, carried in the URL fragment and POSTed to the status API. Only its SHA-256 digest is stored. Anyone holding the link can read that entry: do not share it. No email or account recovery is provided. Status and replies are checked manually, not polled. Names/codes are optional and unverified. There is no public chat feed.

Confirmation occurs only after attachment storage AND Firestore state transition to `under_review`. Repeated requests with the same token and content return the same entry; altered retries conflict. A crash/storage failure leaves `processing`, never a false success. Administrators must investigate processing entries; automatic crash recovery is not implemented. No file is downloadable in that state.

## Security and cost boundaries

- Existing private S3-compatible bucket and Firestore Admin SDK; no Firebase Storage/Blaze dependency or paid service added. Private bucket inspection fails closed.
- New `studentInbox` and `studentInboxLimits` collections have no matching client Firestore allow rules; server APIs enforce access. Do not add public reads/writes.
- Administrator token revocation and current profile role checked on every list/download/reply. Revision checks prevent overwriting another administrator's reply.
- PDFs checked for executable actions/embedded payloads. PNG/JPEG decoded, pixel-bounded, stripped/reencoded to JPEG. No SVG/ZIP. **Not antivirus**; administrators must handle attachments as untrusted. Downloads use attachment/nosniff/sandbox headers.
- Questions/replies rendered as React text, never HTML. No student attachments or raw bucket keys in public responses.
- Hard durable UTC-day budgets: 20 attempts/IP/day, 200 attempts globally/day; 5 accepted entries/IP/day, 50 globally/day; 1,000 accepted entries and 100 MB reserved bytes for the lifetime of this feature. Status lookups: 2,000/day globally. Failed reservations consume budgets. Shared networks share an IP limit.
- IP keys use daily random HMAC salt; raw IPs are not stored. Vercel `x-real-ip` is used; non-Vercel/local requests share one key. These are availability/cost brakes, not comprehensive bot/DDoS prevention. Blocked attempts still incur request/database reads. Existing hosting quotas and security advisories remain relevant.
- No automatic deletion/retention job yet. Operators must define retention and reconcile failed reservations before increasing lifetime budgets. Do not reset counters or make buckets public to bypass limits.

## Verification

`node --test tests/roles/student-inbox.test.mjs`

`node --test tests/roles/student-inbox.browser.test.mjs`

Run typecheck, scoped lint, production build and existing role/layout/security CI. Then verify a harmless guest PDF/image and question on the deployed site, admin download/reply, private receipt status, unauthorized download/list denial and Arabic/mobile rendering. Never use real student personal data for QA.

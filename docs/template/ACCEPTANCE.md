# Academy release acceptance record

Never mark real-account tests passed based only on mocks or source inspection.

| Workflow | Automated evidence | Required real staging verification |
| --- | --- | --- |
| Role boundaries | Route matrix, teacher query emulator, profile rules | Sign in as all five roles; test direct URLs and denied writes |
| Course assignment | Owner/assigned query and unrelated draft tests | Admin assigns teacher; teacher sees only assigned draft courses |
| ZIP lessons | Parser and transactional API tests | Preview → save → reopen → publish; student reads content/images; retry without duplication |
| Live teaching | URL validation and role-aware controls | Host and enrolled learner join configured provider; camera/mic and screen sharing; deny unrelated course management |
| Payments | Billing/webhook regressions | Provider sandbox purchase, retry, cancel/refund, price/currency and access reconciliation |
| Certificates | Existing issuance flow | Issue, download, verify QR, multilingual text and new academy artwork |
| Modules | Configuration and middleware tests | Disabled URLs return unavailable; no dead navigation; payment portal/webhooks stay functional |
| Layout | Responsive contracts | 390px and desktop, Arabic RTL/Cairo, keyboard/focus, contrast, dialogs and long academy names |
| Recovery | Permission error render tests | Auth expiry, offline retry, backup restore and rollback drill |

## Current completion limits

- Teacher query denial reproduced and fixed in emulator, then deployed to Firebase (PR22).
- Live-control guidance passed automated checks (PR23); no actual host/student call verified.
- Template configuration export is not an instantaneous live branding editor. It requires a new build/deployment.
- Real five-role end-to-end sign-ins, external meeting, payment sandbox, certificate visual inspection and restore drill remain required before declaring a new academy production-ready.

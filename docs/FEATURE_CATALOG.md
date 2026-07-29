# Feature catalog

This catalog groups the application into stable work areas so each function can be inspected, tested, repaired, and released independently.

## Actors

| Actor | Primary capabilities |
| --- | --- |
| Public visitor | View landing content, published courses, research content, published journal articles, and certificate verification |
| Student | Manage a profile, enroll, purchase access, learn, track progress, use AI learning tools, and view certificates |
| Teacher | View assigned courses, manage lessons where authorized, and use provider communication tools |
| Reviewer | View assigned manuscripts and submit reviews |
| Editor | Manage journal workflow, reviewers, issues, and publication |
| Administrator | Manage users, roles, courses, payments, certificates, announcements, journal operations, and platform settings |
| n8n worker | Confirm Telegram connections, claim scheduled jobs, and record delivery results using a shared secret |

## F0 — Platform foundation

Functions:

- Firebase client configuration and providers
- Firebase Admin initialization and credential selection
- ID-token verification and role authorization
- Firestore rules and indexes
- S3-compatible client initialization
- API input validation and error responses
- Internationalization and language state
- Environment validation, logging, and audit events

Primary modules: `src/firebase/*`, `src/lib/roles.ts`, `src/lib/s3.ts`, `firestore.rules`, `firestore.indexes.json`, and server route helpers currently repeated inside API routes.

## F1 — Identity and access

User interfaces:

- `/login`, `/signup`, `/profile`
- `/admin/users`, `/admin/users/new`, `/admin/access`
- Teacher, reviewer, editor, and administrator route guards

Server functions:

- `POST /api/admin/create-user`
- `POST /api/admin/update-user-role`
- Firebase Functions `onUserCreate`, `onUserUpdate`, and `adminCreateUser`
- Client claim synchronization and current-role resolution

Data: `users/{uid}` and Firebase Authentication custom claims.

## F2 — Public website and content

Functions:

- Landing hero, feature list, pricing, FAQ, testimonials, statistics, research section, header, and footer
- Public course catalog and course detail pages
- Public research marketing, standards, mentor, partner, join, propose, and submission pages
- Administrator landing-content editor
- English/Arabic presentation

User interfaces: `/`, `/courses`, `/courses/[slug]`, `/research/*`, and `/admin/landing`.

Data: landing settings/content documents, public courses, and UI settings.

## F3 — Courses, lessons, and teaching

Functions:

- Create, edit, publish, draft, and delete courses
- Assign owners and instructor IDs
- Course image and pricing metadata
- Create, edit, order, and delete lessons
- English and Arabic lesson content
- Embedded whiteboard, coding, and lab tools
- Shared whiteboard PDF upload/copy
- Teacher dashboard and assigned-course view
- Administrative seed/reset operations

User interfaces: `/admin/courses*`, `/teacher/dashboard`, and `/teacher/courses`.

Server routes:

- `GET /api/courses/[courseId]/lessons/[lessonId]/pdf`
- `POST /api/lessons/whiteboard-template/presign`
- `POST /api/lessons/whiteboard-template/copy-from-lesson`
- Administrative and internal seed/reset routes

Data: `courses/{courseId}` and `courses/{courseId}/lessons/{lessonId}`.

## F4 — Enrollment, waitlist, entitlement, and progress

Functions:

- Direct enrollment into available courses
- Full-course waitlist requests and administrator approval
- Free-course, subscription, offline-payment, and per-course purchase access
- Student payment flags and global paywall defaults
- Lesson authorization
- Completed-lesson tracking and progress calculation
- Sequential lesson presentation

User interfaces: course details, `/learn/[slug]`, `/learn/[slug]/[lessonId]`, `/admin/waitlist`, and `/admin/access`.

Data:

- `users/{uid}/enrollments/{courseId}`
- `users/{uid}/enrollmentRequests/{courseId}`
- `users/{uid}/coursePurchases/{courseId}`
- `settings/payment`

## F5 — Student learning and AI

Functions:

- Student dashboard and announcements feed
- Course and lesson navigation
- Lesson completion and progress
- Lesson quizzes with local fallback
- Personalized learning-path generation
- AI-powered course recommendations
- Interactive code, PDF, whiteboard, and lab presentation

User interfaces: `/dashboard`, `/learning-path`, `/learn/*`, and dashboard recommendation components.

AI server actions:

- `generateQuiz`
- `generatePersonalizedLearningPath`
- `getCourseRecommendations`

External service: Genkit with Gemini, enabled by `GEMINI_API_KEY`.

## F6 — Billing and payments

Billing models:

- Subscription
- One-time platform payment
- Per-course payment

Providers: Stripe and PayPal. Offline payments are recorded by an administrator.

Server routes:

- `POST /api/billing/checkout`
- `POST /api/billing/course-checkout`
- `POST /api/billing/course-confirm`
- `POST /api/billing/portal`
- `POST /api/billing/webhook`
- `POST /api/billing/paypal-webhook`

Functions:

- Store payment settings
- Create Stripe customers and Checkout Sessions
- Create and capture PayPal orders
- Verify Stripe and PayPal webhooks
- Update subscription/paywall status
- Create course-purchase records
- Open Stripe Billing Portal
- Record offline, local, cash, or waived access

Data: `settings/payment`, billing fields on `users/{uid}`, and course purchase subcollections.

## F7 — Certificates

Functions:

- Generate certificate identifiers and sequences
- Render certificate PDFs and QR codes
- Upload PDFs to S3-compatible storage
- Create public verification and student-owned records
- List and download certificates
- Verify a certificate publicly
- Delete or revoke a certificate and its PDF
- Bulk administration

User interfaces: `/certificates`, `/admin/certificates`, `/verify/[certificateId]`, and `/print/qr`.

Server routes: all routes under `/api/certificates/*`.

Data: `certificates/{certificateId}` and `users/{uid}/certificates/{certificateId}`.

## F8 — Journal and research publishing

Author functions:

- Submit a manuscript PDF and metadata
- View personal submissions
- Replace a manuscript and submit a revision
- Delete an eligible submission

Reviewer functions:

- View assignments and authorized manuscripts
- Submit recommendation, author comments, and editor-only comments

Editor functions:

- Assign reviewers
- Start and manage review rounds
- Request revisions, accept, reject, and publish
- Manage issues and article assignment

Public functions:

- Browse published journal content
- View article metadata
- Download a published article PDF
- View guidelines and research information

User interfaces: `/journal/*`, `/reviewer`, `/admin/journal`, and `/research/*`.

Server routes: `/api/journal/*`, `/api/reviewer/assignments`, and `/api/s3/presign-upload`.

Data: `journalArticles`, server-only `journalReviewerAssignments`, article review subcollections, `journalIssues`, and `settings/ui`. Reviewer identity is not stored on author-readable article documents.

## F9 — Announcements, Telegram, n8n, and live sessions

Functions:

- Publish and display announcements
- Generate a Telegram connection code
- Confirm a Telegram group/channel connection through n8n
- Create, list, schedule, and cancel Telegram jobs
- Claim due jobs transactionally
- Mark delivery success or failure
- Present live-session rooms

User interfaces: `/admin/announcements`, dashboard feeds, `/dashboard/telegram`, and `/live/[roomId]`.

Server routes: `/api/telegram/*` and `/api/n8n/telegram/*`.

Data: `announcements`, user Telegram fields, `tg_connect_requests`, and `tg_jobs`.

## F10 — Administration and analytics

Functions:

- Administrator dashboard
- User, role, course, enrollment, and waitlist management
- Revenue and platform analytics
- Payment settings
- Landing-page content management
- Certificate and journal administration
- Seed/reset tools

User interfaces: `/admin`, `/admin/dashboard`, `/admin/analytics`, and all other `/admin/*` pages.

Destructive seed/reset operations must be treated as a separate privileged operational capability, not routine content editing.

## F11 — Deployment, operations, and quality

Functions:

- Root Next.js installation, type checking, linting, building, and runtime startup
- Firebase Functions installation, build, emulation, deployment, and logs
- Firestore rules and index deployment
- Firebase App Hosting/Hosting configuration
- Environment and secret management
- Backup, restoration, rollback, and disaster recovery
- Automated tests, CI, monitoring, and audit logging

Current gaps: no automated tests, no GitHub Actions workflow, limited README/runbook coverage before this documentation set, and no checked-in monitoring or backup automation.

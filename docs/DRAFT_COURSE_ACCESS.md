# Draft course access

Only courses explicitly marked PUBLISHED permit learner enrollment, waitlist
requests, course/lesson reads, lesson PDF links, or progress updates. Missing,
invalid and DRAFT statuses are closed. Admins and assigned teachers retain draft
course and lesson access for preparation. Payment and old enrollment records do
not override publication status.

Returning a published course to DRAFT keeps enrollment/progress history but
blocks learner content access and progress writes. Republishing restores access
subject to existing enrollment/payment checks. The learner dashboard filters its
course reads to skip permission-denied records, so one unpublished enrollment does not break the
remaining course cards. Enrollment courseId cannot be changed by its owner.

Validation: tests/firestore/course-lifecycle.rules.test.mjs covers normal flow,
draft enrollment denial, waitlist approval bypass denial, missing status,
unpublish/republish with existing purchases and enrollments, staff access and
published catalog queries. tests/roles/lesson-pdf-publication.test.mjs
checks the Admin SDK PDF route separately, because server SDK reads bypass rules.
Both are included in CI. No live course data migration or billing upgrade needed.

Release requires both the application deployment and Firestore rules deployment.
The previous QA report records the pre-fix failure and is retained as evidence.
Lesson-draft discovery, duplicated headings and Arabic copy are separate follow-ups.

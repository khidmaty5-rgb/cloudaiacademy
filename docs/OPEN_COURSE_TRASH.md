# Open-course removal

Admin > Open courses now separates active courses and Trash. This does not change the separate registered-course editor.

- **Withdraw** makes a course a private draft without moving it out of the active list.
- **Move to Trash** stops public access and previews immediately and prevents edits/new publishing. It retains uploaded packages and student work.
- **Restore as draft** restores the same URL privately. It never republishes automatically.
- **Delete permanently**, available only in Trash, requires the exact typed `DELETE <course-id>` confirmation. It removes current uploaded packages in that course's exact storage namespace and leaves a minimal non-public tombstone. The tombstone prevents the built-in Number Systems fallback from reappearing.
- Student assignment files, questions, replies and receipt links are never deleted by these operations. They remain in the private student inbox.
- Storage-provider version history/backups and the bundled Number Systems source are not erased. Already-downloaded student copies cannot be recalled. A rare ambiguous concurrent upload failure may leave an unreachable private object for operational cleanup.

Deletion locks the entry in `purging` before touching storage. Failures stay inaccessible and cannot be restored after partial deletion. Refresh the list and use **Continue deletion** to retry. Cleanup is bounded to five pages of 1,000 current storage objects per request; a 202 response requires continuation. Storage errors are not reported as successful deletion. Course IDs, revision checks and current administrator authorization are enforced server-side. No permissions or bucket ACLs are broadened.

Regression coverage: `tests/roles/open-course-management.test.mjs` and `tests/roles/manage-open-courses.browser.test.mjs`, including English/Arabic controls, typed confirmation, cancellation, restoration, authorization, stale updates, failed cleanup, built-in fallback suppression and student-work preservation. Permanent-delete tests use synthetic local fixtures, not real production courses.

# Open-course module management

Administrators use **Admin → Open courses → Manage modules** (إدارة الوحدات).

- Load saved modules without downloading/rebuilding a complete course archive.
- Add one HTML file, or one ZIP containing one HTML lesson and its bundled assets.
- Replace one module's content; its key and other modules are preserved.
- Rename, move up/down, or remove a module. At least one module must remain.
- Preview pending changes, then **Save details**. All edits remain local until saved.
- For published courses: Withdraw → Manage modules → Save details → Preview → Publish.
- The course ID/URL remains unchanged. Stored previous package versions are retained by the existing server API; there is no user-facing recovery interface yet.

This is module-level editing of the bounded package, not separate Firestore lesson records. Existing admin/current-role authorization, revision checks, private-storage checks, immutable object writes and atomic package-pointer updates remain unchanged. Concurrent changes fail with CONFLICT instead of silently overwriting.

The bundled Number Systems course is intentionally excluded: its content is source-controlled and its existing API prohibits package replacement. No permissions or billing changes.

Limits: 20 modules per course, 200-character module titles, 10 MB compressed file input, existing parser/expansion/HTML limits, and the existing aggregate request-size budget. A multi-HTML ZIP is rejected by an individual-module input. Use the existing whole-package input for a full course replacement.

Tests:

    node --test tests/roles/open-course-modules.test.mjs tests/roles/open-course-management.test.mjs tests/roles/manage-open-courses.browser.test.mjs
    npm run typecheck
    npm run test:roles
    npm run test:layout
    npm run build

Browser regression covers local-only add/rename/reorder/replace, rejection without mutation, saved round-trip, removal, last-module protection, public-course edit locking, and Arabic responsive controls.

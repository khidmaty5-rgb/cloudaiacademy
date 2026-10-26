# Public lecture resources

- Visitors: `/resources`, linked in the public menu. No account needed.
- Administrators: `/admin/resources` → upload PDF → Save private draft → Publish for everyone.
- PDFs only, maximum 3 MiB. Title required; topic and description optional. English/Arabic labels.
- Withdraw blocks subsequent downloads. Copies already downloaded cannot be recalled.
- Upload only material you are authorized to distribute; never upload student records.

## Storage and access

Uses existing MinIO/S3 configuration: `S3_BUCKET_LESSONS`, falling back to
`S3_BUCKET_JOURNAL`. It never uses the certificate bucket. Keys have a separate
`lecture-resources/{uuid}.pdf` prefix. Firestore metadata lives in `lectureResources`.
No client Firestore access is required; unmatched collections remain denied by
the existing rules. All management routes verify a Firebase token and the current
admin profile (no stale-claim fallback). Public APIs project safe metadata and
only serve explicitly published records. Downloads are attachments, not inline
embeds, and recheck publication on every request.

Before production deployment, confirm the selected storage bucket is private
(no anonymous object-read policy or public reverse-proxy file mapping) and the
configured credentials can read/write the new prefix. Public access is through
the application download endpoint, not bucket ACL changes. Existing private
lessons and certificates are not republished or migrated.

Uploads additionally fail closed at runtime unless the configured server confirms
no public ACL grants and no wildcard-Allow bucket policy. Missing inspection
permissions also block uploads with an explicit administrator-facing message.
The application does not change bucket ACLs or policies. This does not inspect
independently configured reverse proxies; those must not bypass storage auth.

No billing upgrade/new provider. Existing Firestore, hosting, and storage quotas
still apply. This is not malware scanning: PDFs are parsed, and recognized active
content/embedded payloads are rejected; administrators remain responsible for
trusted uploads. Files are intentionally not auto-published or deleted.

Tests: `node --test tests/roles/lecture-resources.test.mjs`, role/layout suites,
typecheck, lint and production build. Live upload/download with the production
bucket and administrator account remains a separate acceptance check.

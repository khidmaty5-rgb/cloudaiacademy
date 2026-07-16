# Backup and recovery

Backups must cover source history, working-tree files, production data, object storage, and secrets. A GitHub repository alone is not a complete application backup.

## Pre-documentation backup created

Date: 2026-07-16

Location:

```text
C:\Users\dhnos\Downloads\studio-2\backups
```

Artifacts:

- `CloudAIAcademy-2026-07-16-pre-documentation-source.zip`
- `CloudAIAcademy-2026-07-16-pre-documentation-history.bundle`

SHA-256 checksums:

| Artifact | SHA-256 |
| --- | --- |
| Source ZIP | `7CA326AFAC96736F3A4462F289F0CEEC51C55B13F5DB25E09443463836AC3B65` |
| Git bundle | `992F5FB015D2181D8B20ECCE1021E770DF508A9BA27F237CA51655C6CDE7CA4E` |

The source ZIP is a portable working-tree snapshot. The Git bundle contains repository history, branches, and tags.

The source ZIP intentionally excludes:

- `.git`
- `node_modules`
- `.next`
- Functions dependency folders
- `.env.local`
- `config/serviceAccount.local.json`
- ZIP archives already present in the source tree
- logs and TypeScript build-info caches

The untracked `public/images/logo - Copy.png` is included in the source ZIP because it was present in the working tree and did not match an exclusion.

## Integrity verification

Generate hashes:

```text
Get-FileHash -Algorithm SHA256 <backup-file>
```

Store hashes with the backup manifest. Periodically test both archive listing and restoration into an isolated directory.

Verify a Git bundle:

```text
git bundle verify CloudAIAcademy-2026-07-16-pre-documentation-history.bundle
```

## Restore the source archive

1. Create a new empty restoration directory.
2. Extract the ZIP into that directory.
3. Restore environment variables from the separately secured secret backup.
4. Run `npm ci` at the root.
5. Run `npm ci` in `functions` if Functions are needed.
6. Run type checking, linting, and builds.
7. Connect the restored tree to Git history if required.

## Restore from the Git bundle

Clone into a new empty directory:

```text
git clone CloudAIAcademy-2026-07-16-pre-documentation-history.bundle CloudAIAcademy-restored
```

Then restore intentionally untracked files from the source ZIP, excluding secret files unless the restoration environment is secure.

## Production data backups still required

The local source backup does not include:

- Firestore production documents
- Firebase Authentication users or password hashes
- Stripe or PayPal provider records
- S3 journal, lesson, or certificate objects
- n8n workflows and credentials
- Telegram bot credentials
- Firebase/App Hosting secret values
- Gemini credentials

Create separate operational procedures for:

1. Scheduled Firestore exports to a protected storage location.
2. S3 bucket versioning or replicated backups.
3. n8n workflow export without exposing credentials.
4. An encrypted secret inventory and recovery-owner process.
5. Payment reconciliation using provider records as an external source of truth.

## Recommended retention

- Pre-release source backup for every production release
- Daily production-data backups where supported
- Weekly isolated restore verification
- Monthly long-term backup
- Retain incident-related backups until the incident is fully closed

Keep at least one copy outside the development computer and restrict access according to the sensitivity of the data.

## Recovery acceptance checklist

- Repository history and intended branch restored
- Root and Functions dependencies installed from lockfiles
- Type checks and builds pass
- Correct Firebase project selected
- Firestore rules and indexes verified
- Authentication and role changes tested
- Payment providers remain in safe/sandbox mode until reconciled
- S3 objects accessible only to authorized flows
- Journal and certificate records match their corresponding objects
- Webhooks, n8n, and AI are re-enabled only after secrets are restored safely

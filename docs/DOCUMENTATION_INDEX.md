# Documentation index

This directory is the operational source of truth for CloudAI Academy. Secret values must never be placed in these documents.

## Core documents

| Document | Purpose | Update when |
| --- | --- | --- |
| `FEATURE_CATALOG.md` | Product areas, actors, functions, UI surfaces, and API ownership | A feature, page, route, or integration changes |
| `CONFIGURATION_REFERENCE.md` | Environment variables and checked-in configuration | A variable, provider, Firebase project, bucket, or config file changes |
| `DEPLOYMENT_RUNBOOK.md` | Validation, deployment, webhook setup, rollback, and verification | Deployment tooling or infrastructure changes |
| `BACKUP_RECOVERY.md` | Backup scope, exclusions, integrity checks, and restoration | Backup location, retention, or restoration procedure changes |
| `REPAIR_WORKSTREAMS.md` | Priorities, dependencies, work units, and completion criteria | A workstream starts, finishes, or changes priority |
| `payments.md` | Existing payment notes | Billing configuration or payment flow changes |
| `telegram-n8n.md` | Existing Telegram/n8n procedures | Telegram or n8n workflows change |

## Documentation rules

1. Record variable names, never secret values.
2. Separate current implementation from intended behavior.
3. Include the affected pages, API routes, Firestore collections, and external services.
4. Define how a function is tested and rolled back before marking it complete.
5. Record destructive operations such as seed, reset, delete, and role changes explicitly.
6. Update the deployment and recovery documents in the same change as infrastructure changes.

## Current architecture boundary

The repository contains two separately validated and deployed runtime areas:

- Root Next.js application: pages, route handlers, server actions, Firebase client code, and most server integrations.
- `functions/`: Firebase Functions used for claim synchronization and an administrative callable function.

Firestore rules and indexes are deployed independently of both application runtimes.

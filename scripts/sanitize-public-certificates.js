#!/usr/bin/env node
'use strict';
/**
 * Removes `userEmail` from top-level public certificate docs: `certificates/{certificateId}`.
 *
 * Usage:
 *   node scripts/sanitize-public-certificates.js --dry-run
 *   node scripts/sanitize-public-certificates.js
 *
 * Optional flags:
 *   --page-size=250   (1-500, default 250)
 *   --limit=0         (0 = unlimited, default 0)
 *
 * Requires Firebase Admin env vars (same as the Next.js server routes):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

require('dotenv').config({ path: '.env.local' });

const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldPath, FieldValue } = require('firebase-admin/firestore');

function getAdminAppWithCert() {
  const name = 'adminAppSanitizePublicCertificates';
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;

  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawKey
    ? rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '').replace(/^'|'$/g, '')
    : '';

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, name);
}

function parseFlag(name, defaultValue) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.slice(prefix.length);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const pageSize = Math.max(1, Math.min(500, Number.parseInt(parseFlag('page-size', '250'), 10) || 250));
  const rawLimit = Number.parseInt(parseFlag('limit', '0'), 10) || 0;
  const maxDocs = rawLimit > 0 ? rawLimit : null; // null = unlimited
  const batchMax = 450; // keep under Firestore 500 limit

  const app = getAdminAppWithCert();
  const db = getFirestore(app);

  let scanned = 0;
  let foundWithUserEmail = 0;
  let updated = 0;
  let lastDoc = null;

  // eslint-disable-next-line no-console
  console.log(
    `[sanitize-public-certificates] start dryRun=${dryRun} pageSize=${pageSize} limit=${maxDocs ?? 'unlimited'}`,
  );

  while (true) {
    let q = db
      .collection('certificates')
      .orderBy(FieldPath.documentId())
      .limit(pageSize)
      .select('userEmail');
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const docs = snap.docs;
    let batch = dryRun ? null : db.batch();
    let batchCount = 0;
    let reachedLimit = false;

    for (const d of docs) {
      scanned += 1;
      const hasField = d.get('userEmail') !== undefined;
      if (hasField) {
        foundWithUserEmail += 1;
        if (!dryRun && batch) {
          batch.update(d.ref, { userEmail: FieldValue.delete() });
          batchCount += 1;
          if (batchCount >= batchMax) {
            await batch.commit();
            updated += batchCount;
            batch = db.batch();
            batchCount = 0;
          }
        }
      }

      if (maxDocs && scanned >= maxDocs) {
        reachedLimit = true;
        break;
      }
    }

    lastDoc = docs[docs.length - 1];

    if (!dryRun && batch && batchCount > 0) {
      await batch.commit();
      updated += batchCount;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[sanitize-public-certificates] progress scanned=${scanned} foundWithUserEmail=${foundWithUserEmail}` +
        (dryRun ? '' : ` updated=${updated}`),
    );

    if (reachedLimit) break;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[sanitize-public-certificates] done scanned=${scanned} foundWithUserEmail=${foundWithUserEmail}` +
      (dryRun ? '' : ` updated=${updated}`),
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[sanitize-public-certificates] failed', err);
  // eslint-disable-next-line no-process-exit
  process.exit(1);
});


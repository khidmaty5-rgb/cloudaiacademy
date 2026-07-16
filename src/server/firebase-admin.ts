import 'server-only';

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const FIREBASE_ADMIN_APP_NAME = 'cloudAiAcademyAdmin';

type ServiceAccountFile = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

type ServiceAccountConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function clean(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizePrivateKey(value: string | undefined): string | undefined {
  const normalized = clean(value);
  if (!normalized) return undefined;

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const unquoted =
    normalized.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'"))
      ? normalized.slice(1, -1)
      : normalized;

  return unquoted.replace(/\\n/g, '\n');
}

function getConfiguredProjectId(): string | undefined {
  return (
    clean(process.env.FIREBASE_PROJECT_ID) ||
    clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) ||
    clean(process.env.GOOGLE_CLOUD_PROJECT) ||
    clean(process.env.GCLOUD_PROJECT)
  );
}

function setProjectEnvironment(projectId: string | undefined): void {
  if (!projectId) return;
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = projectId;
}

function usesFirebaseEmulators(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function getEnvironmentServiceAccount(projectId: string | undefined): ServiceAccountConfig | null {
  const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

function getServiceAccountPaths(): string[] {
  const candidates = new Set<string>();
  const explicitPath = clean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  if (explicitPath) candidates.add(path.resolve(process.cwd(), explicitPath));

  for (const level of ['', '..', '../..', '../../..', '../../../..']) {
    candidates.add(path.resolve(process.cwd(), level, 'config', 'serviceAccount.local.json'));
  }

  return [...candidates];
}

function getFileServiceAccount(fallbackProjectId: string | undefined): ServiceAccountConfig | null {
  for (const candidate of getServiceAccountPaths()) {
    try {
      if (!existsSync(candidate)) continue;

      const value = JSON.parse(readFileSync(candidate, 'utf8')) as ServiceAccountFile;
      const projectId = clean(value.project_id) || fallbackProjectId;
      const clientEmail = clean(value.client_email);
      const privateKey = normalizePrivateKey(value.private_key);

      if (projectId && clientEmail && privateKey) {
        return { projectId, clientEmail, privateKey };
      }
    } catch {
      // Preserve the current fallback behavior: try the next path, then ADC.
    }
  }

  return null;
}

function getFirebaseAdminOptions(): AppOptions {
  const configuredProjectId = getConfiguredProjectId();
  setProjectEnvironment(configuredProjectId);

  if (usesFirebaseEmulators()) {
    if (!configuredProjectId) {
      throw new Error('A Firebase project ID is required when using Firebase emulators.');
    }
    return { projectId: configuredProjectId };
  }

  const serviceAccount =
    getEnvironmentServiceAccount(configuredProjectId) || getFileServiceAccount(configuredProjectId);

  if (serviceAccount) {
    setProjectEnvironment(serviceAccount.projectId);
    return {
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    };
  }

  return {
    credential: applicationDefault(),
    ...(configuredProjectId ? { projectId: configuredProjectId } : {}),
  };
}

export function getFirebaseAdminApp(): App {
  const existing = getApps().find((app) => app.name === FIREBASE_ADMIN_APP_NAME);
  return existing || initializeApp(getFirebaseAdminOptions(), FIREBASE_ADMIN_APP_NAME);
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

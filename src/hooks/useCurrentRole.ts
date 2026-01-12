'use client';

import { useEffect, useState } from 'react';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import type { UserRole } from '@/types/models';
import { roleFromClaims } from '@/lib/roles';

const CLAIMS_REFRESH_KEY = 'cloudai:claimsRefreshedAt';
const CLAIMS_REFRESH_WINDOW_MS = 5 * 60 * 1000;

function normalizeRole(raw: unknown): UserRole | null {
  return raw === 'admin' || raw === 'teacher' || raw === 'editor' || raw === 'reviewer' || raw === 'student'
    ? (raw as UserRole)
    : null;
}

function mergeRoleClaimsAndProfile(claimRole: UserRole, profileRole: UserRole) {
  // Prefer the most privileged role we can observe; profile is authoritative when claims are missing/stale.
  if (claimRole === 'admin' || profileRole === 'admin') return 'admin' as const;
  if (claimRole === 'editor' || profileRole === 'editor') return 'editor' as const;
  if (claimRole === 'teacher' || profileRole === 'teacher') return 'teacher' as const;
  if (claimRole === 'reviewer' || profileRole === 'reviewer') return 'reviewer' as const;
  return 'student' as const;
}

export function useCurrentRole() {
  const [role, setRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const auth = getAuth();
    const firestore = getFirestore();
    let cancelled = false;
    let unsubscribeProfile: (() => void) | null = null;

    let lastClaimRole: UserRole = 'student';
    let lastProfileRole: UserRole = 'student';

    const applyMergedRole = () => {
      if (cancelled) return;
      setRole(mergeRoleClaimsAndProfile(lastClaimRole, lastProfileRole));
    };

    async function init() {
      try {
        const u = auth.currentUser;
        if (!u) {
          if (!cancelled) { setRole('student'); setLoading(false); }
          return;
        }

        // Subscribe to the user's profile role as a fallback when claims are missing or stale.
        // This avoids the UI showing "student" while Firestore rules treat the user as staff.
        try {
          unsubscribeProfile?.();
          const ref = doc(firestore, 'users', u.uid);
          unsubscribeProfile = onSnapshot(
            ref,
            (snap) => {
              if (cancelled) return;
              const next = normalizeRole(snap.data()?.role) ?? 'student';
              lastProfileRole = next;
              applyMergedRole();
            },
            () => {
              // Ignore profile listener errors; claims still provide a baseline.
            },
          );
        } catch {
          // Ignore profile listener setup errors.
        }

        let forceRefresh = false;
        try {
          const last = Number(sessionStorage.getItem(CLAIMS_REFRESH_KEY) || '0');
          if (!last || Date.now() - last > CLAIMS_REFRESH_WINDOW_MS) {
            forceRefresh = true;
            sessionStorage.setItem(CLAIMS_REFRESH_KEY, String(Date.now()));
          }
        } catch {}

        let tr;
        try {
          tr = await u.getIdTokenResult(forceRefresh);
        } catch {
          tr = await u.getIdTokenResult();
        }
        lastClaimRole = roleFromClaims(tr.claims);
        if (!cancelled) {
          applyMergedRole();
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setRole('student'); setLoading(false); }
      }
    }

    init();

    const unsub = onIdTokenChanged(auth, async (u) => {
      try {
        unsubscribeProfile?.();
        unsubscribeProfile = null;
        lastProfileRole = 'student';

        if (!u) { setRole('student'); setLoading(false); return; }

        // Re-subscribe for the new user.
        try {
          const ref = doc(firestore, 'users', u.uid);
          unsubscribeProfile = onSnapshot(
            ref,
            (snap) => {
              if (cancelled) return;
              const next = normalizeRole(snap.data()?.role) ?? 'student';
              lastProfileRole = next;
              applyMergedRole();
            },
            () => {},
          );
        } catch {}

        const tr = await u.getIdTokenResult();
        lastClaimRole = roleFromClaims(tr.claims);
        applyMergedRole();
      } catch { setRole('student'); }
    });

    return () => {
      cancelled = true;
      unsub();
      try {
        unsubscribeProfile?.();
      } catch {}
    };
  }, []);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isTeacher: role === 'teacher',
    isEditor: role === 'editor' || role === 'admin',
    isReviewer: role === 'reviewer' || role === 'admin',
    isStudent: role === 'student',
  } as const;
}

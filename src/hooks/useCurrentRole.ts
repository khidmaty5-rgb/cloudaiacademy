'use client';

import { useEffect, useState } from 'react';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import type { UserRole } from '@/types/models';
import { resolveCurrentRole, roleFromClaims } from '@/lib/roles';

const CLAIMS_REFRESH_KEY = 'cloudai:claimsRefreshedAt';
const CLAIMS_REFRESH_WINDOW_MS = 5 * 60 * 1000;

function normalizeRole(raw: unknown): UserRole | null {
  return raw === 'admin' || raw === 'teacher' || raw === 'editor' || raw === 'reviewer' || raw === 'student'
    ? (raw as UserRole)
    : null;
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
    let lastProfileRole: UserRole | null = null;
    let profileExists = false;
    let profileResolved = false;
    let claimResolved = false;

    const applyResolvedRole = () => {
      if (cancelled) return;
      if (!profileResolved || (!profileExists && !claimResolved)) return;
      setRole(resolveCurrentRole(lastClaimRole, lastProfileRole, profileExists));
      setLoading(false);
    };

    async function init() {
      try {
        const u = auth.currentUser;
        if (!u) {
          if (!cancelled) { setRole('student'); setLoading(false); }
          return;
        }

        // The current profile is authoritative. Claims are used only when the profile is absent;
        // profile read failures fall closed to the student role.
        try {
          unsubscribeProfile?.();
          const ref = doc(firestore, 'users', u.uid);
          unsubscribeProfile = onSnapshot(
            ref,
            (snap) => {
              if (cancelled) return;
              profileExists = snap.exists();
              profileResolved = true;
              lastProfileRole = profileExists
                ? normalizeRole(snap.data()?.role) ?? 'student'
                : null;
              applyResolvedRole();
            },
            () => {
              profileExists = true;
              profileResolved = true;
              lastProfileRole = 'student';
              applyResolvedRole();
            },
          );
        } catch {
          profileExists = true;
          profileResolved = true;
          lastProfileRole = 'student';
          applyResolvedRole();
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
        claimResolved = true;
        if (!cancelled) {
          applyResolvedRole();
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
        lastProfileRole = null;
        profileExists = false;
        profileResolved = false;
        claimResolved = false;

        if (!u) { setRole('student'); setLoading(false); return; }
        setLoading(true);

        // Re-subscribe for the new user.
        try {
          const ref = doc(firestore, 'users', u.uid);
          unsubscribeProfile = onSnapshot(
            ref,
            (snap) => {
              if (cancelled) return;
              profileExists = snap.exists();
              profileResolved = true;
              lastProfileRole = profileExists
                ? normalizeRole(snap.data()?.role) ?? 'student'
                : null;
              applyResolvedRole();
            },
            () => {
              profileExists = true;
              profileResolved = true;
              lastProfileRole = 'student';
              applyResolvedRole();
            },
          );
        } catch {
          profileExists = true;
          profileResolved = true;
          lastProfileRole = 'student';
          applyResolvedRole();
        }

        const tr = await u.getIdTokenResult();
        lastClaimRole = roleFromClaims(tr.claims);
        claimResolved = true;
        applyResolvedRole();
      } catch {
        if (!cancelled) {
          setRole('student');
          setLoading(false);
        }
      }
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
    isLearner: role === 'student' || role === 'reviewer',
    isStudent: role === 'student',
  } as const;
}

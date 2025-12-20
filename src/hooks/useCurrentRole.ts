'use client';

import { useEffect, useState } from 'react';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import type { UserRole } from '@/types/models';
import { roleFromClaims } from '@/lib/roles';

const CLAIMS_REFRESH_KEY = 'cloudai:claimsRefreshedAt';
const CLAIMS_REFRESH_WINDOW_MS = 5 * 60 * 1000;

export function useCurrentRole() {
  const [role, setRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const auth = getAuth();
    let cancelled = false;

    async function init() {
      try {
        const u = auth.currentUser;
        if (!u) {
          if (!cancelled) { setRole('student'); setLoading(false); }
          return;
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
        const r = roleFromClaims(tr.claims);
        if (!cancelled) { setRole(r); setLoading(false); }
      } catch {
        if (!cancelled) { setRole('student'); setLoading(false); }
      }
    }

    init();

    const unsub = onIdTokenChanged(auth, async (u) => {
      try {
        if (!u) { setRole('student'); return; }
        const tr = await u.getIdTokenResult();
        setRole(roleFromClaims(tr.claims));
      } catch { setRole('student'); }
    });

    return () => { cancelled = true; unsub(); };
  }, []);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isTeacher: role === 'teacher',
    isEditor: role === 'editor' || role === 'admin',
    isStudent: role === 'student',
  } as const;
}

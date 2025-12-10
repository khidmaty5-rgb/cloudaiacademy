'use client';

import { useEffect, useState } from 'react';
import { getAuth, onIdTokenChanged } from 'firebase/auth';
import type { UserRole } from '@/types/models';
import { roleFromClaims } from '@/lib/roles';

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
        const tr = await u.getIdTokenResult(true);
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
        const tr = await u.getIdTokenResult(true);
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
    isStudent: role === 'student',
  } as const;
}

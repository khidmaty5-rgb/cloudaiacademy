'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ManagedOpenCourse } from '@/lib/open-course-management';
export function usePublicOpenCourses() {
  const [items, setItems] = useState<ManagedOpenCourse[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async (after?: string) => {
    const run = ++generation.current; setLoading(true); setError(false);
    try {
      const response = await fetch('/api/open-courses' + (after ? '?after=' + encodeURIComponent(after) : ''), { cache: 'no-store' });
      if (!response.ok) throw new Error(); const data = await response.json();
      if (generation.current !== run) return;
      setItems(old => after ? [...old, ...data.items.filter((x: ManagedOpenCourse) => !old.some(y => y.id === x.id))] : data.items); setNext(data.next);
    } catch { if (generation.current === run) setError(true); }
    finally { if (generation.current === run) setLoading(false); }
  }, []);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void load(); return invalidate; }, [load, invalidate]);
  return { items, next, loading, error, load };
}

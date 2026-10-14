'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/firebase';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';

type Event = { id: string; targetUid: string; newRole: string };
export default function RoleClaimRecovery() {
  const { user } = useUser();
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(false);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/role-sync', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('Unavailable');
      const result = await response.json();
      setEvents(result.events);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  async function retry(id: string) {
    if (!user || inFlight.current) return;
    inFlight.current = true; setBusy(id); setError(false);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/role-sync', { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId: id }) });
      if (!response.ok) throw new Error('Unavailable');
      await load();
    } catch { setError(true); }
    finally { inFlight.current = false; setBusy(null); }
  }
  return <section aria-labelledby="claim-recovery-title" className="mb-6 space-y-3 rounded-xl border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="claim-recovery-title" className="text-lg font-semibold">{ar ? 'تحديث رموز الصلاحيات' : 'Role-token recovery'}</h2>
      <Button variant="outline" disabled={loading || !!busy} onClick={() => void load()}>{ar ? 'تحديث القائمة' : 'Refresh list'}</Button>
    </div>
    <p className="text-sm text-muted-foreground">{ar ? 'لا تحتاج هذه العملية إلى Cloud Functions. تعيد المحاولة مزامنة الدور الحالي فقط، ولا تستعيد صلاحيات قديمة. تعرض القائمة حتى ٢٠ عملية معلّقة.' : 'No Cloud Functions required. Retry synchronizes only the current role, never an old privilege. Up to 20 pending operations are shown.'}</p>
    {error && <p role="alert" className="text-sm text-destructive">{ar ? 'تعذّرت المزامنة أو تحميل القائمة. تبقى العمليات معلّقة؛ أعد المحاولة بعد التحقق من الاتصال والصلاحيات.' : 'Could not synchronize or load the list. Operations remain pending; check connectivity and permissions, then retry.'}</p>}
    {loading ? <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p> : !error && !events.length ? <p role="status" className="text-sm text-muted-foreground">{ar ? 'لا توجد عمليات مزامنة معلّقة.' : 'No pending synchronization.'}</p> : null}
    {events.map(event => <div key={event.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t pt-3">
      <span dir="auto" className="min-w-0 break-all text-sm">{event.targetUid}</span>
      <Button disabled={!!busy || loading} variant="outline" onClick={() => void retry(event.id)}>{busy === event.id ? (ar ? 'جارٍ المزامنة…' : 'Synchronizing…') : (ar ? 'إعادة مزامنة الدور الحالي' : 'Retry current role sync')}</Button>
    </div>)}
  </section>;
}

'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { InboxStatus } from '@/components/student-inbox';
import { type InboxItem } from '@/lib/student-inbox';

export function AdminStudentInbox() {
  const { user } = useUser(); const { lang } = useLang(); const t = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const [items, setItems] = useState<InboxItem[]>([]); const [next, setNext] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [loaded, setLoaded] = useState(false); const [notice, setNotice] = useState('');
  async function auth() { if (!user) throw new Error(); return { Authorization: `Bearer ${await user.getIdToken()}` }; }
  async function run(fn: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); setNotice(''); try { await fn(); } catch { setError(t('Could not complete the operation. Refresh before retrying; another administrator may have updated this entry.', 'تعذّر إكمال العملية. حدّث القائمة قبل إعادة المحاولة؛ ربما عدّل مسؤول آخر هذا الطلب.')); } finally { setBusy(false); } }
  async function load(after?: string) { const response = await fetch('/api/student-inbox' + (after ? '?after=' + after : ''), { headers: await auth(), cache: 'no-store' }); if (!response.ok) throw new Error(); const data = await response.json(); setItems(old => after ? [...old, ...data.items] : data.items); setNext(data.next); setLoaded(true); }
  useEffect(() => {
    if (user) void run(() => load());
    else { setItems([]); setLoaded(false); setNext(null); }
    // Load once per signed-in administrator, not on every render or draft reply edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
  return <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{t('Student assignments & Q&A', 'واجبات الطلاب والأسئلة والأجوبة')}</h2><Button disabled={busy} variant="outline" onClick={() => void run(() => load())}>{t('Load / refresh inbox', 'تحميل / تحديث الوارد')}</Button></div>
    <p className="text-sm text-muted-foreground">{t('Private administrator inbox. Student identities are not verified. Replies are visible only through each secret receipt link. Files are screened, not antivirus-certified; treat downloads as untrusted.', 'صندوق خاص بالمسؤولين. هويات الطلاب غير موثقة. تظهر الردود عبر روابط الإيصالات الخاصة فقط. تُفحص الملفات لكن لا يُضمن خلوها من البرمجيات الضارة؛ تعامل معها بحذر.')}</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}{notice && <p role="status">{notice}</p>}
    {busy && <p role="status">{t('Loading / updating inbox…', 'جارٍ تحميل / تحديث الوارد…')}</p>}
    {loaded && !items.length && <p>{t('No submissions yet.', 'لا توجد مشاركات بعد.')}</p>}
    <div className="grid gap-4 lg:grid-cols-2">{items.map(item => <form key={item.id + ':' + item.revision} className="min-w-0 space-y-3 rounded-xl border p-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(async () => {
      const response = await fetch('/api/student-inbox', { method: 'PATCH', headers: { ...await auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, revision: item.revision, status: form.get('status'), reply: form.get('reply') }) }); if (!response.ok) throw new Error(); await load(); setNotice(t('Reply and status saved.', 'تم حفظ الرد والحالة.'));
    }); }}>
      <h3 className="font-semibold break-words" dir="auto">{item.title}</h3><p className="text-sm">{item.kind === 'assignment' ? t('Assignment', 'واجب') : t('Question', 'سؤال')} · <InboxStatus status={item.status} /></p>
      <p className="text-sm break-words" dir="auto">{item.name || t('Anonymous', 'مجهول')} · {new Date(item.createdAt).toLocaleDateString(lang)}</p><a className="block text-sm underline break-all" href={'/open-courses/' + encodeURIComponent(item.courseId)}>{t('View course', 'عرض الدورة')} — {item.courseId}</a>
      <p className="whitespace-pre-wrap break-words" dir="auto">{item.message}</p>
      {item.hasFile && item.status !== 'processing' && <Button disabled={busy} type="button" variant="outline" onClick={() => void run(async () => { const response = await fetch('/api/student-inbox?file=' + item.id, { headers: await auth(), cache: 'no-store' }); if (!response.ok) throw new Error(); const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement('a'); anchor.href = url; anchor.download = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'assignment'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })}>{t('Download attachment', 'تنزيل المرفق')}</Button>}
{item.status !== 'processing' && <><label className="block text-sm">{t('Status', 'الحالة')}<select aria-label={t('Status', 'الحالة')} name="status" defaultValue={item.status} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="under_review">{t('Under review', 'قيد المراجعة')}</option><option value="reviewed">{t('Reviewed', 'تمت المراجعة')}</option><option value="needs_changes">{t('Changes requested', 'مطلوب تعديلات')}</option></select></label><label className="block text-sm">{t('Private reply', 'رد خاص')}<textarea name="reply" defaultValue={item.reply} maxLength={4000} rows={4} className="mt-1 w-full rounded-lg border bg-background p-2" /></label><Button disabled={busy} type="submit">{t('Save reply and status', 'حفظ الرد والحالة')}</Button></>}
    </form>)}</div>
    {next && <Button disabled={busy} variant="outline" onClick={() => void run(() => load(next))}>{t('Load more', 'عرض المزيد')}</Button>}
  </section>;
}

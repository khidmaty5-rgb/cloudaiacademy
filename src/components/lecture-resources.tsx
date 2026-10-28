'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/firebase';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OpenCoursesSection } from '@/components/open-courses-section';
import { MAX_LECTURE_PDF_BYTES, type LectureResource } from '@/lib/lecture-resources';

export default function LectureResources({ manage = false }: { manage?: boolean }) {
  const { lang, dir } = useLang(); const { user } = useUser(); const ar = lang === 'ar';
  const [items, setItems] = useState<LectureResource[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const lock = useRef(false); const generation = useRef(0);
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const headers = useCallback(async () => manage ? { Authorization: `Bearer ${await user?.getIdToken()}` } : undefined, [manage, user]);
  const load = useCallback(async (after?: string) => {
    const current = ++generation.current;
    setLoading(true); setError('');
    try {
      if (manage && !user) return;
      const params = new URLSearchParams(manage ? { manage: '1' } : {}); if (after) params.set('after', after);
      const response = await fetch(`/api/lecture-resources?${params}`, { headers: await headers(), cache: 'no-store' });
      if (!response.ok) throw new Error('LOAD_FAILED');
      const data = await response.json();
      if (current !== generation.current) return;
      setItems(previous => after ? [...previous, ...data.items.filter((item: LectureResource) => !previous.some(p => p.id === item.id))] : data.items);
      setNext(data.next);
    } catch { if (current === generation.current) setError('load'); }
    finally { if (current === generation.current) setLoading(false); }
  }, [manage, user, headers]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { setItems([]); setNext(null); void load(); return invalidate; }, [load, invalidate]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const form = event.currentTarget; const data = new FormData(form); const file = data.get('file');
    if (!(file instanceof File) || !file.size || file.size > MAX_LECTURE_PDF_BYTES || !file.name.toLowerCase().endsWith('.pdf')) { setError('file'); return; }
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/lecture-resources', { method: 'POST', headers: await headers(), body: data });
      if (!response.ok && (await response.json().catch(() => ({}))).error === 'STORAGE_PRIVACY_UNVERIFIED') { setError('privacy'); return; }
      if (!response.ok) throw new Error('UPLOAD_FAILED');
      form.reset(); await load(); setNotice('saved');
    } catch { setError('upload'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function publish(item: LectureResource) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/lecture-resources', { method: 'PATCH', headers: { ...await headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, published: !item.published }) });
      if (!response.ok) throw new Error('SAVE_FAILED');
      setItems(previous => previous.map(value => value.id === item.id ? { ...value, published: !item.published } : value));
      setNotice(item.published ? 'withdrawn' : 'published');
    } catch { setError('save'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main dir={dir} className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
    <header className="space-y-2"><h1 className="text-3xl font-bold">{tr('Lecture resources', 'أوراق المحاضرات')}</h1>
      <p className="text-muted-foreground">{manage ? tr('Upload a PDF as a private draft, then publish it for everyone. Published files require no account.', 'ارفع ملف PDF كمسودة خاصة، ثم انشره للجميع دون الحاجة إلى حساب.') : tr('Download lecture sheets shared by the academy. No registration required.', 'حمّل أوراق المحاضرات التي تنشرها الأكاديمية دون تسجيل أو إنشاء حساب.')}</p></header>
    <OpenCoursesSection />
    {manage && <form onSubmit={upload} className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-semibold">{tr('Upload a lecture sheet', 'رفع ورقة محاضرة')}</h2>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block space-y-2"><span>{tr('Title', 'العنوان')}</span><Input name="title" required maxLength={160} /></label>
        <label className="block space-y-2"><span>{tr('Topic or course (optional)', 'الموضوع أو الدورة (اختياري)')}</span><Input name="topic" maxLength={100} /></label>
        <label className="block space-y-2"><span>{tr('Description (optional)', 'الوصف (اختياري)')}</span><textarea name="description" maxLength={1000} className="min-h-24 w-full rounded-md border bg-background p-3" /></label>
        <label className="block space-y-2"><span>{tr('PDF file — up to 3 MB', 'ملف PDF — حتى 3 ميغابايت')}</span><Input name="file" type="file" accept="application/pdf,.pdf" required /></label>
        <p className="text-sm text-muted-foreground">{tr('Use lecture material you have permission to share. Do not upload student information. PDFs with scripts, forms or attachments may be rejected.', 'استخدم مواد محاضرات لديك حق مشاركتها، ولا ترفع بيانات الطلاب. قد تُرفض ملفات PDF التي تتضمن برامج أو نماذج أو مرفقات.')}</p>
        <Button type="submit">{busy ? tr('Saving…', 'جارٍ الحفظ…') : tr('Save private draft', 'حفظ مسودة خاصة')}</Button>
      </fieldset>
    </form>}
    {notice && <p role="status" className="rounded-xl border p-4">{notice === 'saved' ? tr('Draft saved. It is not public until you select Publish.', 'حُفظت المسودة. لن تظهر للجمهور حتى تختار نشر.') : notice === 'published' ? tr('Published. Anyone with the resources page can download this PDF.', 'تم النشر. يمكن لأي زائر لصفحة الموارد تنزيل الملف.') : tr('Withdrawn. New downloads are blocked; already downloaded copies cannot be recalled.', 'تم سحب النشر ومنع التنزيلات الجديدة. لا يمكن استرجاع النسخ التي نُزّلت سابقًا.')}</p>}
    {error === 'privacy' && <p role="alert" className="rounded-xl border border-destructive p-4">{tr('Upload blocked: storage privacy could not be verified. An administrator must check bucket policy/ACL inspection permissions and disable anonymous bucket access. No file was uploaded.', 'تم منع الرفع: تعذّر التحقق من خصوصية التخزين. يجب على المسؤول فحص صلاحيات قراءة سياسة الحاوية والتحكم بالوصول والتأكد من تعطيل الوصول العام. لم يُرفع أي ملف.')}</p>}
    {error && <div role="alert" className="space-y-3 rounded-xl border border-destructive p-4"><p>{error === 'file' ? tr('Choose a PDF no larger than 3 MB.', 'اختر ملف PDF لا يتجاوز 3 ميغابايت.') : error === 'load' ? tr('Resources could not be loaded. Please retry.', 'تعذّر تحميل الموارد. حاول مجددًا.') : tr('Could not confirm the operation. Refresh the list before retrying to avoid duplicate uploads. Check the PDF and your connection.', 'تعذّر تأكيد العملية. حدّث القائمة قبل المحاولة لتجنّب رفع نسخ مكررة، وتحقق من الملف والاتصال.')}</p>{error !== 'file' && <Button variant="outline" onClick={() => void load()} disabled={loading || busy}>{tr('Refresh list', 'تحديث القائمة')}</Button>}</div>}
    {loading && <p role="status">{tr('Loading resources…', 'جارٍ تحميل الموارد…')}</p>}
    {!loading && !error && !items.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{tr('No lecture sheets available yet.', 'لا توجد أوراق محاضرات متاحة بعد.')}</p>}
    <div className="grid gap-4 sm:grid-cols-2">{items.map(item => <article key={item.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{item.topic || tr('Lecture sheet', 'ورقة محاضرة')} · PDF · {Math.ceil(item.size / 1024)} KB</p>
      <h2 className="break-words text-xl font-semibold">{item.title}</h2><p className="whitespace-pre-wrap break-words text-muted-foreground">{item.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">{item.published && <Button asChild variant="outline"><a href={`/api/lecture-resources/${item.id}/download`}>{tr('Download PDF', 'تنزيل PDF')}</a></Button>}
        {manage && <><span className="text-sm">{item.published ? tr('Public', 'منشور') : tr('Private draft', 'مسودة خاصة')}</span><Button disabled={busy || loading} onClick={() => void publish(item)}>{item.published ? tr('Withdraw', 'سحب النشر') : tr('Publish for everyone', 'نشر للجميع')}</Button></>}
      </div></article>)}</div>
    {next && <Button variant="outline" disabled={loading || busy} onClick={() => void load(next)}>{tr('Load more', 'تحميل المزيد')}</Button>}
  </main>;
}

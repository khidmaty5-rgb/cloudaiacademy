'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/firebase';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OpenCoursesSection } from '@/components/open-courses-section';
import { MAX_LECTURE_PDF_BYTES, type LectureResource } from '@/lib/lecture-resources';

export default function LectureResources({ manage = false, courseId, regular = false }: { manage?: boolean; courseId?: string; regular?: boolean }) {
  const { lang, dir } = useLang(); const { user } = useUser(); const ar = lang === 'ar';
  const [items, setItems] = useState<LectureResource[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const lock = useRef(false); const generation = useRef(0);
  const [deleted, setDeleted] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'saved' | 'failed' | null>(null);
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const scopeQuery = courseId ? '?courseId=' + encodeURIComponent(courseId) + (regular ? '&kind=regular' : '') : '';
  const Container = courseId ? 'section' : 'main';
  const Heading = courseId ? 'h2' : 'h1';
  const headers = useCallback(async () => manage || regular ? { Authorization: `Bearer ${await user?.getIdToken()}` } : undefined, [manage, regular, user]);
  const load = useCallback(async (after?: string) => {
    const current = ++generation.current;
    setLoading(true); setError('');
    try {
      if ((manage || regular) && !user) { setError('auth'); return; }
      const params = new URLSearchParams(manage ? { manage: '1' } : {}); if (after) params.set('after', after);
      if (regular) params.set('kind','regular');
      if (courseId) params.set('courseId', courseId);
      const response = await fetch(`/api/lecture-resources?${params}`, { headers: await headers(), cache: 'no-store' });
      if ([401,403].includes(response.status)) { if(current === generation.current)setError('auth'); return; }
      if (!response.ok) throw new Error('LOAD_FAILED');
      const data = await response.json();
      if (current !== generation.current) return;
      setItems(previous => after ? [...previous, ...data.items.filter((item: LectureResource) => !previous.some(p => p.id === item.id))] : data.items);
      setNext(data.next);
    } catch { if (current === generation.current) setError('load'); }
    finally { if (current === generation.current) setLoading(false); }
  }, [manage, regular, user, headers, courseId]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => { setItems([]); setNext(null); void load(); return invalidate; }, [load, invalidate]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    setDeleted(false);
    const form = event.currentTarget; const data = new FormData(form); const file = data.get('file');
    if (!(file instanceof File) || !file.size || file.size > MAX_LECTURE_PDF_BYTES || !file.name.toLowerCase().endsWith('.pdf')) { setError('file'); return; }
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/lecture-resources' + scopeQuery, { method: 'POST', headers: await headers(), body: data });
      if (!response.ok && (await response.json().catch(() => ({}))).error === 'STORAGE_PRIVACY_UNVERIFIED') { setError('privacy'); return; }
      if (!response.ok) throw new Error('UPLOAD_FAILED');
      form.reset(); await load(); setNotice('saved');
    } catch { setError('upload'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function downloadPrivate(item: LectureResource) {
    try {
      const res = await fetch('/api/lecture-resources/'+item.id+'/download'+scopeQuery,{headers:await headers(),cache:'no-store'});
      if (!res.ok) throw Error();
      const url = URL.createObjectURL(await res.blob()); const a = document.createElement('a');
      a.href=url; a.download=item.title+'.pdf'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch {setError('download');}
  }
  async function edit(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget);
    lock.current = true; setBusy(true); setEditStatus(null); setNotice(''); setDeleted(false);
    try {
      const response = await fetch('/api/lecture-resources' + scopeQuery, {
        method: 'PUT', headers: { ...await headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: form.get('title'), topic: form.get('topic'), description: form.get('description') }),
      });
      if (!response.ok) throw new Error('EDIT_FAILED');
      const { title, topic, description } = await response.json();
      setItems(previous => previous.map(item => item.id === id ? { ...item, title, topic, description } : item));
      setEditing(null); setEditStatus('saved');
    } catch { setEditStatus('failed'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function remove(item: LectureResource) {
    if (lock.current || !window.confirm(tr('Permanently delete this instruction PDF? Student answers and questions will NOT be deleted. This cannot be undone.', 'حذف ملف التعليمات نهائيًا؟ لن تُحذف إجابات الطلاب أو أسئلتهم. لا يمكن التراجع عن الحذف.') + '\n\n' + item.title)) return;
    lock.current = true; setBusy(true); setError(''); setNotice(''); setDeleted(false);
    try {
      const response = await fetch('/api/lecture-resources' + scopeQuery, { method: 'DELETE', headers: { ...await headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, confirmation: 'DELETE ' + item.id }) });
      if (!response.ok) throw new Error('DELETE_FAILED');
      await load(); setNotice(''); setDeleted(true);
    } catch { await load(); setError('delete'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function publish(item: LectureResource) {
    setDeleted(false);
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/lecture-resources' + scopeQuery, { method: 'PATCH', headers: { ...await headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, published: !item.published }) });
      if (!response.ok) throw new Error('SAVE_FAILED');
      setItems(previous => previous.map(value => value.id === item.id ? { ...value, published: !item.published } : value));
      setNotice(item.published ? 'withdrawn' : 'published');
    } catch { setError('save'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Container dir={dir} aria-label={courseId ? tr('Assignment instructions', 'تعليمات الواجبات') : tr('Lecture resources', 'أوراق المحاضرات')} className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
    <header className="space-y-2"><Heading className="text-3xl font-bold">{courseId ? tr('Assignment instructions', 'تعليمات الواجبات') : tr('Lecture resources', 'أوراق المحاضرات')}</Heading>
      <p className="text-muted-foreground">{regular ? tr('Published assignments are for enrolled students only.', 'الواجبات المنشورة للطلاب المسجلين في الدورة فقط.') : manage ? tr('Upload a PDF as a private draft, then publish it for everyone. Published files require no account.', 'ارفع ملف PDF كمسودة خاصة، ثم انشره للجميع دون الحاجة إلى حساب.') : tr('Download lecture sheets shared by the academy. No registration required.', 'حمّل أوراق المحاضرات التي تنشرها الأكاديمية دون تسجيل أو إنشاء حساب.')}</p></header>
    {courseId && <a className="underline" href={'/assignments/'+(regular?'regular':'open')+'/'+encodeURIComponent(courseId)}>{tr('Student assignment page (permanent link)', 'صفحة واجبات الطلاب (رابط دائم)')}</a>}
    {!courseId && <OpenCoursesSection />}
    {deleted && <p role="status">{tr('Instruction PDF deleted. Student submissions are unchanged.', 'تم حذف ملف التعليمات. لم تتغير مشاركات الطلاب.')}</p>}
    {error === 'delete' && <p role="alert">{tr('Deletion could not be confirmed. Refresh and use Continue deletion if shown. Public access is blocked once deletion starts.', 'تعذّر تأكيد الحذف. حدّث القائمة واستخدم متابعة الحذف إن ظهر. يُحظر الوصول العام عند بدء الحذف.')}</p>}
    {courseId && !regular && <p className="text-sm">{manage ? tr('These instructions belong to this course. Save a PDF draft, then publish. To replace a file, upload the new version and withdraw the old one. Student answers remain private in the inbox.', 'تخص هذه التعليمات هذه الدورة. احفظ مسودة PDF ثم انشرها. لاستبدال ملف، ارفع النسخة الجديدة واسحب القديمة. تبقى إجابات الطلاب خاصة في الوارد.') : tr('Download your assignment below. Then use the submission form below the instructions, entering the same assignment title. Keep the private receipt to check your review.', 'نزّل واجبك أدناه ثم استخدم نموذج الإرسال أسفل التعليمات وأدخل عنوان الواجب نفسه. احتفظ بالإيصال الخاص لمتابعة المراجعة.')}</p>}
    {manage && !loading && error !== 'auth' && <form onSubmit={upload} className="space-y-4 rounded-2xl border bg-card p-5">
      <h3 className="text-xl font-semibold">{courseId ? tr('Upload assignment instructions', 'رفع تعليمات الواجب') : tr('Upload a lecture sheet', 'رفع ورقة محاضرة')}</h3>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block space-y-2"><span>{tr('Title', 'العنوان')}</span><Input name="title" required maxLength={160} /></label>
        <label className="block space-y-2"><span>{tr('Topic or course (optional)', 'الموضوع أو الدورة (اختياري)')}</span><Input name="topic" maxLength={100} /></label>
        <label className="block space-y-2"><span>{tr('Description (optional)', 'الوصف (اختياري)')}</span><textarea name="description" maxLength={1000} className="min-h-24 w-full rounded-md border bg-background p-3" /></label>
        <label className="block space-y-2"><span>{tr('PDF file — up to 3 MB', 'ملف PDF — حتى 3 ميغابايت')}</span><Input name="file" type="file" accept="application/pdf,.pdf" required /></label>
        <p className="text-sm text-muted-foreground">{tr('Use lecture material you have permission to share. Do not upload student information. PDFs with scripts, forms or attachments may be rejected.', 'استخدم مواد محاضرات لديك حق مشاركتها، ولا ترفع بيانات الطلاب. قد تُرفض ملفات PDF التي تتضمن برامج أو نماذج أو مرفقات.')}</p>
        <Button type="submit">{busy ? tr('Saving…', 'جارٍ الحفظ…') : tr('Save private draft', 'حفظ مسودة خاصة')}</Button>
      </fieldset>
    </form>}
    {notice && <p role="status" className="rounded-xl border p-4">{notice === 'saved' ? tr('Draft saved. It is not public until you select Publish.', 'حُفظت المسودة. لن تظهر للجمهور حتى تختار نشر.') : notice === 'published' ? regular ? tr('Published to enrolled students.', 'تم النشر للطلاب المسجلين.') : tr('Published. Anyone with the resources page can download this PDF.', 'تم النشر. يمكن لأي زائر لصفحة الموارد تنزيل الملف.') : tr('Withdrawn. New downloads are blocked; already downloaded copies cannot be recalled.', 'تم سحب النشر ومنع التنزيلات الجديدة. لا يمكن استرجاع النسخ التي نُزّلت سابقًا.')}</p>}
    {error === 'privacy' && <p role="alert" className="rounded-xl border border-destructive p-4">{tr('Upload blocked: storage privacy could not be verified. An administrator must check bucket policy/ACL inspection permissions and disable anonymous bucket access. No file was uploaded.', 'تم منع الرفع: تعذّر التحقق من خصوصية التخزين. يجب على المسؤول فحص صلاحيات قراءة سياسة الحاوية والتحكم بالوصول والتأكد من تعطيل الوصول العام. لم يُرفع أي ملف.')}</p>}
    {error && <div role="alert" className="space-y-3 rounded-xl border border-destructive p-4"><p>{error === 'auth' ? tr('Sign in with an account that has access to this course.', 'سجّل الدخول بحساب يملك صلاحية الوصول إلى الدورة.') : error === 'download' ? tr('Download failed. Please retry.', 'تعذّر التنزيل. حاول مجددًا.') : error === 'file' ? tr('Choose a PDF no larger than 3 MB.', 'اختر ملف PDF لا يتجاوز 3 ميغابايت.') : error === 'load' ? tr('Resources could not be loaded. Please retry.', 'تعذّر تحميل الموارد. حاول مجددًا.') : tr('Could not confirm the operation. Refresh the list before retrying to avoid duplicate uploads. Check the PDF and your connection.', 'تعذّر تأكيد العملية. حدّث القائمة قبل المحاولة لتجنّب رفع نسخ مكررة، وتحقق من الملف والاتصال.')}</p>{error !== 'file' && <Button variant="outline" onClick={() => void load()} disabled={loading || busy}>{tr('Refresh list', 'تحديث القائمة')}</Button>}</div>}
    {loading && <p role="status">{tr('Loading resources…', 'جارٍ تحميل الموارد…')}</p>}
    {!loading && !error && !items.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{courseId ? tr('No assignment instructions published yet.', 'لم تُنشر تعليمات واجبات بعد.') : tr('No lecture sheets available yet.', 'لا توجد أوراق محاضرات متاحة بعد.')}</p>}
    {editStatus === 'saved' && <p role="status">{tr('Assignment details saved.', 'تم حفظ تفاصيل الواجب.')}</p>}
    <div className="grid gap-4 sm:grid-cols-2">{items.map(item => <article key={item.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{item.topic || tr('Lecture sheet', 'ورقة محاضرة')} · PDF · {Math.ceil(item.size / 1024)} KB</p>
      {manage && courseId && !item.deleting && (editing === item.id ?
        <form className="space-y-3" onSubmit={e => void edit(e, item.id)}>
          <fieldset disabled={busy} className="space-y-3">
            <label className="block">{tr('Assignment title', 'عنوان الواجب')}<Input autoFocus name="title" defaultValue={item.title} required maxLength={160}/></label>
            <label className="block">{tr('Topic', 'الموضوع')}<Input name="topic" defaultValue={item.topic} maxLength={100}/></label>
            <label className="block">{tr('Description', 'الوصف')}<textarea className="block w-full rounded-md border bg-background p-2" name="description" defaultValue={item.description} maxLength={1000}/></label>
            {editStatus === 'failed' && <p role="alert">{tr('Changes could not be saved. Check the title and try again.', 'تعذّر حفظ التغييرات. تحقق من العنوان وحاول مجددًا.')}</p>}
            <Button type="submit">{tr('Save changes', 'حفظ التغييرات')}</Button>{' '}
            <Button variant="outline" type="button" onClick={() => {setEditing(null); setEditStatus(null);}}>{tr('Cancel','إلغاء')}</Button>
          </fieldset>
        </form> :
        <Button variant="outline" disabled={busy || loading} onClick={() => {setEditing(item.id); setEditStatus(null);}}>{tr('Edit details','تعديل التفاصيل')}</Button>)}
      <h2 className="break-words text-xl font-semibold">{item.title}</h2><p className="whitespace-pre-wrap break-words text-muted-foreground">{item.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">{item.published && regular && <Button variant="outline" onClick={()=>void downloadPrivate(item)}>{tr('Download PDF','تنزيل PDF')}</Button>}{item.published && !regular && <Button asChild variant="outline"><a href={`/api/lecture-resources/${item.id}/download` + scopeQuery}>{tr('Download PDF', 'تنزيل PDF')}</a></Button>}
        {manage && <><span className="text-sm">{item.deleting ? tr('Deletion pending', 'الحذف معلق') : item.published ? tr('Public', 'منشور') : tr('Private draft', 'مسودة خاصة')}</span>{!item.deleting && <Button disabled={busy || loading} onClick={() => void publish(item)}>{item.published ? tr('Withdraw', 'سحب النشر') : regular ? tr('Publish to enrolled students','نشر للطلاب المسجلين') : tr('Publish for everyone', 'نشر للجميع')}</Button>}<Button variant="destructive" disabled={busy || loading} onClick={() => void remove(item)}>{item.deleting ? tr('Continue deletion', 'متابعة الحذف') : tr('Delete', 'حذف')}</Button></>}
      </div></article>)}</div>
    {next && <Button variant="outline" disabled={loading || busy} onClick={() => void load(next)}>{tr('Load more', 'تحميل المزيد')}</Button>}
  </Container>;
}

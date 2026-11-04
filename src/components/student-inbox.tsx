'use client';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { INBOX_FILE_LIMIT, type InboxItem } from '@/lib/student-inbox';

const field = 'w-full rounded-lg border bg-background p-3 text-sm';
function useWords() { const { lang, dir } = useLang(); return { dir, t: (en: string, ar: string) => lang === 'ar' ? ar : en }; }
export function InboxStatus({ status }: { status: string }) { const { t } = useWords(); return <span>{status === 'under_review' ? t('Under review', 'قيد المراجعة') : status === 'reviewed' ? t('Reviewed', 'تمت المراجعة') : status === 'needs_changes' ? t('Changes requested', 'مطلوب تعديلات') : t('Upload not confirmed — contact the instructor with this receipt.', 'لم يتم تأكيد الرفع — تواصل مع المدرّس باستخدام هذا الإيصال.')}</span>; }
export function StudentInbox({ courseId }: { courseId: string }) {
  const { t, dir } = useWords(); const [kind, setKind] = useState('assignment'); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [receipt, setReceipt] = useState(''); const [item, setItem] = useState<InboxItem | null>(null);
  const pending = useRef<{ token: string; body: string } | null>(null); const lock = useRef(false);
  async function submit(form: HTMLFormElement) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      if (!pending.current) {
        const data = new FormData(form); const file = data.get('file') as File | null; let attachment;
        if (kind === 'assignment') {
          if (!file || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || !file.size || file.size > INBOX_FILE_LIMIT) throw new Error('FILE');
          const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          attachment = { type: file.type, data: btoa(binary) };
        }
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
        pending.current = { token, body: JSON.stringify({ action: 'submit', token, courseId, kind, name: data.get('name'), title: data.get('title'), message: data.get('message'), website: data.get('website'), file: attachment }) };
      }
      const response = await fetch('/api/student-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: pending.current.body });
      if (!response.ok) { if ([400, 413, 404, 429].includes(response.status)) pending.current = null; throw new Error(response.status === 429 ? 'LIMIT' : 'SAVE'); }
      const result = await response.json(); setItem(result); setReceipt(`${location.origin}/submission-status#${pending.current.token}`); pending.current = null;
    } catch (e) { setError(e instanceof Error && e.message === 'FILE' ? t('Choose one PDF, PNG or JPEG up to 2 MB.', 'اختر ملف PDF أو PNG أو JPEG واحدًا بحجم حتى 2 ميغابايت.') : e instanceof Error && e.message === 'LIMIT' ? t('Submission limit reached. Please contact your instructor.', 'تم بلوغ حد الإرسال. تواصل مع المدرّس.') : t('Upload has not been confirmed. Retry sends the same submission, not a duplicate.', 'لم يتم تأكيد الرفع. إعادة المحاولة ترسل نفس الطلب دون تكرار.')); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section dir={dir} className="rounded-2xl border bg-card p-5 sm:p-8 space-y-4" aria-label={t('Assignments and questions', 'الواجبات والأسئلة')}>
    <h2 className="text-2xl font-bold">{t('Assignments & questions', 'الواجبات والأسئلة')}</h2>
    <p className="text-sm text-muted-foreground">{t('No account needed. Only Academy administrators can read your submission. Keep your private receipt link to see status and replies; anyone with the link can read them. No email is sent.', 'لا يلزم حساب. يطّلع مسؤولو الأكاديمية فقط على مشاركتك. احتفظ برابط الإيصال الخاص لمتابعة الحالة والردود؛ يمكن لأي شخص يملك الرابط قراءتها. لا يُرسل بريد إلكتروني.')}</p>
    {item ? <div role="status" className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">{item.status === 'processing' ? t('Submission pending', 'الإرسال قيد المعالجة') : t('Received successfully', 'تم الاستلام بنجاح')}</h3><InboxStatus status={item.status} /><p>{t('Save this private link now. It cannot be recovered without an account.', 'احفظ هذا الرابط الخاص الآن. لا يمكن استعادته دون حساب.')}</p><a className="block break-all underline" href={receipt}>{receipt}</a><Button variant="outline" onClick={() => { setItem(null); setReceipt(''); }}>{t('New submission', 'إرسال جديد')}</Button></div> : <form className="space-y-4 max-w-2xl" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }}>
      <fieldset disabled={busy || Boolean(pending.current)} className="space-y-4">
        <label className="block">{t('I want to', 'أريد')}<select aria-label={t('I want to', 'أريد')} className={field} value={kind} onChange={e => setKind(e.target.value)}><option value="assignment">{t('Upload an assignment', 'رفع واجب')}</option><option value="question">{t('Ask a private question', 'طرح سؤال خاص')}</option></select></label>
        <label className="block">{t('Name or student code (optional)', 'الاسم أو رمز الطالب (اختياري)')}<input className={field} name="name" maxLength={100} /></label>
        <label className="block">{t('Assignment / lesson title', 'عنوان الواجب / الدرس')}<input className={field} name="title" required maxLength={160} /></label>
        <label className="block">{t('Question or note', 'السؤال أو الملاحظة')}<textarea className={field} name="message" required={kind === 'question'} maxLength={4000} rows={4} /></label>
        {kind === 'assignment' && <label className="block">{t('PDF, PNG or JPEG — maximum 2 MB', 'PDF أو PNG أو JPEG — حتى 2 ميغابايت')}<input className={field} name="file" type="file" accept="application/pdf,image/png,image/jpeg" required /></label>}
        <div hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" />{t('I agree to send this material to the Academy for review. I will not include passwords, identity documents or sensitive personal information.', 'أوافق على إرسال هذه المادة للأكاديمية للمراجعة، ولن أضمّن كلمات مرور أو وثائق هوية أو معلومات شخصية حساسة.')}</label>
      </fieldset>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? t('Sending…', 'جارٍ الإرسال…') : pending.current ? t('Retry same submission', 'إعادة محاولة نفس الطلب') : t('Send privately', 'إرسال خاص')}</Button>
    </form>}
  </section>;
}
export function SubmissionStatus() {
  const { t, dir } = useWords(); const [token, setToken] = useState(''); const [item, setItem] = useState<InboxItem | null>(null); const [error, setError] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { setToken(location.hash.slice(1)); }, []);
  async function load() { setBusy(true); setError(false); try { const response = await fetch('/api/student-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', token }), cache: 'no-store' }); if (!response.ok) throw new Error(); setItem(await response.json()); } catch { setItem(null); setError(true); } finally { setBusy(false); } }
  return <main dir={dir} className="mx-auto max-w-2xl p-6 space-y-5"><h1 className="text-3xl font-bold">{t('Your private receipt', 'إيصالك الخاص')}</h1><p>{t('Do not share this link. Check manually for your instructor’s reply.', 'لا تشارك هذا الرابط. تحقّق يدويًا من رد المدرّس.')}</p><Button disabled={busy || !token} onClick={() => void load()}>{busy ? t('Loading…', 'جارٍ التحميل…') : t('Check status and reply', 'عرض الحالة والرد')}</Button>{error && <p role="alert">{t('Receipt unavailable. Check your saved link or try later.', 'الإيصال غير متاح. تحقق من الرابط المحفوظ أو حاول لاحقًا.')}</p>}{item && <article className="rounded-xl border p-5 space-y-4"><h2 className="font-bold" dir="auto">{item.title}</h2><InboxStatus status={item.status} /><p className="whitespace-pre-wrap" dir="auto">{item.message}</p><h3 className="font-semibold">{t('Instructor reply', 'رد المدرّس')}</h3><p className="whitespace-pre-wrap" dir="auto">{item.reply || t('No reply yet.', 'لا يوجد رد بعد.')}</p></article>}</main>;
}

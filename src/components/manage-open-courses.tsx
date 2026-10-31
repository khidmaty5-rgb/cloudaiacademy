'use client';
/* eslint-disable @next/next/no-img-element -- Thumbnails are validated local data URLs, never remote image-optimizer inputs. */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseInteractiveZip } from '@/lib/parse-interactive-zip';
import type { LessonPackage } from '@/lib/lesson-package';
import { OPEN_COURSE_REQUEST_LIMIT, type CourseMetadata, type ManagedOpenCourse } from '@/lib/open-course-management';
import { OpenCourseLessons } from '@/components/open-course-player';
import { BookOpen, UploadCloud, ShieldCheck, CheckCircle2 } from 'lucide-react';

const empty = (): CourseMetadata => ({ title: { en: '', ar: '' }, description: { en: '', ar: '' }, language: 'ar', minutes: 90, image: '' });
async function thumbnail(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5_000_000) throw new Error('IMAGE_INVALID');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 25_000_000) throw new Error('IMAGE_INVALID');
    const canvas = document.createElement('canvas'); const scale = Math.min(1, 640 / bitmap.width, 360 / bitmap.height);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('IMAGE_INVALID');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.4]) { const url = canvas.toDataURL('image/jpeg', quality); if (url.length <= 80_000) return url; }
    throw new Error('IMAGE_INVALID');
  } finally { bitmap.close(); }
}
export default function ManageOpenCourses() {
  const { user } = useUser(); const { lang, dir } = useLang(); const ar = lang === 'ar';
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const [items, setItems] = useState<ManagedOpenCourse[]>([]); const [next, setNext] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<CourseMetadata>(empty); const [selected, setSelected] = useState<ManagedOpenCourse | null>(null);
  const [pkg, setPkg] = useState<LessonPackage | null>(null); const [preview, setPreview] = useState(false);
  const [replacement, setReplacement] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const lock = useRef(false); const fileInput = useRef<HTMLInputElement>(null);
  const token = async () => { if (!user) throw new Error('UNAUTHORIZED'); return { Authorization: 'Bearer ' + await user.getIdToken() }; };
  async function load(after?: string) {
    const response = await fetch('/api/open-courses?manage=1' + (after ? '&after=' + encodeURIComponent(after) : ''), { headers: await token(), cache: 'no-store' });
    if (!response.ok) throw new Error('LOAD_FAILED'); const data = await response.json();
    setItems(old => after ? [...old, ...data.items.filter((x: ManagedOpenCourse) => !old.some(y => y.id === x.id))] : data.items); setNext(data.next);
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'FAILED'); }
    finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => { if (user) void run(() => load()); /* token refresh is resolved for each action */ }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  function reset() { setSelected(null); setMetadata(empty()); setPkg(null); setPreview(false); setReplacement(false); if (fileInput.current) fileInput.current.value = ''; }
  async function patch(item: ManagedOpenCourse, update: { metadata?: CourseMetadata; published?: boolean }) {
    const response = await fetch('/api/open-courses', { method: 'PATCH', headers: { ...await token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, revision: item.revision, ...update }) });
    if (!response.ok) throw new Error((await response.json()).error || 'SAVE_FAILED');
    reset(); await load(); setNotice(tr('Changes saved.', 'تم حفظ التغييرات.'));
  }
  const errorText = error === 'CONFLICT' ? tr('This course changed elsewhere. Refresh the list and reopen it before saving.', 'عُدّلت الدورة من مكان آخر. حدّث القائمة وافتحها مجددًا قبل الحفظ.') :
    error === 'INTERACTIVE_CSS_IMPORT' || error === 'EXTERNAL_DEPENDENCY' ? tr('The ZIP uses external CSS/fonts/scripts. Bundle these assets inside the ZIP before importing. Nothing was saved.', 'يتضمن الملف موارد خارجية. ضمّن ملفات التنسيق والخطوط والبرامج داخل ZIP قبل الاستيراد. لم يُحفظ شيء.') :
    error === 'STORAGE_PRIVACY_UNVERIFIED' ? tr('Storage privacy could not be verified. Upload blocked; no draft created.', 'تعذّر التحقق من خصوصية التخزين. تم منع الرفع.') :
    error === 'IMAGE_INVALID' ? tr('Choose a PNG, JPEG or WebP image under 5 MB and 25 megapixels.', 'اختر صورة PNG أو JPEG أو WebP أصغر من 5 ميغابايت و25 ميغابكسل.') :
    tr('Could not complete this operation. Check the package and your connection; refresh before retrying to avoid duplicates.', 'تعذّر إكمال العملية. تحقق من الملف والاتصال وحدّث القائمة قبل المحاولة لتجنب التكرار.');
  return <main dir={dir} className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:py-10">
    <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl space-y-3"><p className="text-xs font-semibold uppercase tracking-widest text-primary">{tr('Academy management', 'إدارة الأكاديمية')}</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tr('Manage open courses', 'إدارة الدورات المفتوحة')}</h1><p className="text-sm leading-7 text-muted-foreground">{tr('Publish interactive courses for everyone, without registration. New uploads are private drafts.', 'انشر دورات تفاعلية للجميع دون تسجيل. تُحفظ الملفات الجديدة كمسودات خاصة.')}</p></div>
      <Button asChild variant="outline" className="shrink-0"><Link href="/#open-courses"><BookOpen className="me-2 h-4 w-4" aria-hidden="true" />{tr('View public courses', 'عرض الدورات العامة')}</Link></Button>
    </header>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm leading-6">{errorText}</p>}{notice && <p role="status" className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />{notice}</p>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
    <form className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm" onSubmit={e => { e.preventDefault(); void run(async () => {
      if (selected && !replacement) return patch(selected, { metadata });
      if (!pkg) throw new Error('INVALID_PACKAGE');
      const body = JSON.stringify({ metadata, package: pkg, ...(selected ? { id: selected.id, revision: selected.revision } : {}) }); if (new TextEncoder().encode(body).length > OPEN_COURSE_REQUEST_LIMIT) throw new Error('FILE_TOO_LARGE');
      const response = await fetch('/api/open-courses', { method: selected ? 'PUT' : 'POST', headers: { ...await token(), 'Content-Type': 'application/json' }, body });
      if (!response.ok) throw new Error((await response.json()).error || 'SAVE_FAILED');
      reset(); await load(); setNotice(tr('Private draft saved. Preview it from the list before publishing.', 'تم حفظ المسودة الخاصة. عاينها من القائمة قبل النشر.'));
    }); }}>
      <div className="border-b px-5 py-5 sm:px-6"><h2 className="text-lg font-semibold">{selected ? tr('Edit course details', 'تعديل تفاصيل الدورة') : tr('Upload a new course', 'رفع دورة جديدة')}</h2><p className="mt-1 text-sm text-muted-foreground">{selected ? tr('Update the information learners see in the course catalogue.', 'حدّث المعلومات التي يراها المتعلمون في دليل الدورات.') : tr('Start with your ZIP, then add the course details below.', 'ابدأ بملف ZIP، ثم أضف تفاصيل الدورة أدناه.')}</p></div>
      <fieldset disabled={busy} className="space-y-6 p-5 text-sm disabled:opacity-70 sm:p-6">
        {selected && !selected.published && selected.id !== 'number-systems' && <div className="space-y-2 rounded-xl border border-dashed p-4"><label className="block space-y-2"><span>{tr('Replace draft ZIP (optional)', 'استبدال ملف المسودة ZIP (اختياري)')}</span><Input key={selected.id} type="file" accept=".zip" onChange={e => { const file = e.target.files?.[0]; if (!file) return; setReplacement(false); setPkg(null); setPreview(false); void run(async () => {
          if (!file.name.toLowerCase().endsWith('.zip') || file.size > 10_000_000) throw new Error('FILE_TOO_LARGE');
          const result = parseInteractiveZip(new Uint8Array(await file.arrayBuffer()));
          if (new TextEncoder().encode(JSON.stringify(result)).length > OPEN_COURSE_REQUEST_LIMIT - 100_000) throw new Error('FILE_TOO_LARGE');
          setPkg(result); setReplacement(true); setPreview(true);
        }); }} /></label><p className="text-xs text-muted-foreground">{replacement ? tr('New package ready. Save details to replace the private draft; it will not be published.', 'الحزمة الجديدة جاهزة. احفظ التفاصيل لاستبدال محتوى المسودة الخاصة دون نشرها.') : tr('Replaces all lessons together. The course URL stays the same and prior stored content is retained for recovery.', 'يستبدل جميع الدروس معًا. يبقى رابط الدورة كما هو ويُحتفظ بالمحتوى السابق للاسترجاع.')}</p></div>}
        {!selected && <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5"><UploadCloud className="mb-3 h-7 w-7 text-primary" aria-hidden="true" /><label className="block space-y-3 font-medium"><span>{tr('Interactive ZIP (up to 10 MB)', 'ملف ZIP تفاعلي (حتى 10 ميغابايت)')}</span><Input className="h-auto min-h-11 bg-card py-2 file:me-3 file:rounded file:bg-muted file:px-3 file:py-1" ref={fileInput} type="file" accept=".zip" onChange={e => { const file = e.target.files?.[0]; setPkg(null); setPreview(false); if (file) void run(async () => {
          if (!file.name.toLowerCase().endsWith('.zip') || file.size > 10_000_000) throw new Error('FILE_TOO_LARGE');
          const result = parseInteractiveZip(new Uint8Array(await file.arrayBuffer()));
          if (new TextEncoder().encode(JSON.stringify(result)).length > OPEN_COURSE_REQUEST_LIMIT - 100_000) throw new Error('FILE_TOO_LARGE');
          setPkg(result); setMetadata(old => ({ ...old, title: { en: old.title.en || result.lessons[0].title, ar: old.title.ar } }));
        }); }} /></label><p className="mt-3 text-xs leading-5 text-muted-foreground">{pkg ? tr(`${pkg.lessons.length} lesson(s) ready to preview. Not saved yet.`, `${pkg.lessons.length} درس جاهز للمعاينة. لم يُحفظ بعد.`) : tr('Include HTML, CSS, scripts and assets in one self-contained package.', 'ضمّن HTML والتنسيق والبرامج والموارد في حزمة مكتملة.')}</p></div>}
        <div className="grid gap-4 sm:grid-cols-2">{(['en', 'ar'] as const).map(l => <div key={l} className="space-y-3">
          <label className="block space-y-2"><span>{l === 'en' ? tr('Title (required; any language)', 'العنوان (مطلوب؛ بأي لغة)') : tr('Arabic title (optional)', 'العنوان العربي (اختياري)')}</span><Input required={l === 'en'} maxLength={160} value={metadata.title[l]} onChange={e => setMetadata({ ...metadata, title: { ...metadata.title, [l]: e.target.value } })} /></label>
          <label className="block space-y-2"><span>{l === 'en' ? tr('Description', 'الوصف') : tr('Arabic description (optional)', 'الوصف العربي (اختياري)')}</span><textarea maxLength={1000} className="min-h-24 w-full rounded-md border bg-background p-3" value={metadata.description[l]} onChange={e => setMetadata({ ...metadata, description: { ...metadata.description, [l]: e.target.value } })} /></label>
        </div>)}</div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2">{tr('Language', 'اللغة')}<select className="block h-10 w-full rounded-md border bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={metadata.language} onChange={e => setMetadata({ ...metadata, language: e.target.value as CourseMetadata['language'] })}><option value="ar">العربية</option><option value="en">English</option><option value="both">العربية / English</option></select></label><label className="space-y-2">{tr('Duration (minutes)', 'المدة (دقائق)')}<Input type="number" min={1} max={10000} required value={metadata.minutes} onChange={e => setMetadata({ ...metadata, minutes: Number(e.target.value) })} /></label></div>
        <label className="block space-y-2"><span>{tr('Course image (optional)', 'صورة الدورة (اختياري)')}</span><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { const image = await thumbnail(file); setMetadata(old => ({ ...old, image })); }); }} /></label>
        {metadata.image && <div className="space-y-2"><img src={metadata.image} alt={tr('Course image preview', 'معاينة صورة الدورة')} className="max-h-40 rounded-lg" /><Button type="button" variant="outline" onClick={() => setMetadata({ ...metadata, image: '' })}>{tr('Remove image', 'إزالة الصورة')}</Button></div>}
        <div className="flex flex-wrap gap-3 border-t pt-5"><Button type="submit" disabled={!selected && !pkg}>{busy ? tr('Working…', 'جارٍ العمل…') : selected ? tr('Save details', 'حفظ التفاصيل') : tr('Save private draft', 'حفظ مسودة خاصة')}</Button><Button type="button" variant="outline" onClick={reset}>{tr('Clear / new course', 'مسح / دورة جديدة')}</Button>{pkg && <Button type="button" variant="outline" aria-expanded={preview} onClick={() => setPreview(x => !x)}>{tr('Toggle preview', 'عرض / إخفاء المعاينة')}</Button>}</div>
      </fieldset>
    </form>
    <aside className="space-y-5 rounded-2xl border bg-card p-5 text-sm">
      <h2 className="font-semibold">{tr('From upload to classroom', 'من الرفع إلى التعلم')}</h2>
      <ol className="space-y-5">{[
        [tr('Upload & describe', 'ارفع وأضف التفاصيل'), tr('Add the package, cover and course information.', 'أضف الحزمة والصورة ومعلومات الدورة.')],
        [tr('Save & preview', 'احفظ وعاين'), tr('Keep it private while you test every lesson.', 'تظل الدورة خاصة أثناء اختبار كل درس.')],
        [tr('Publish when ready', 'انشر عندما تصبح جاهزة'), tr('Use Publish on the saved course below.', 'استخدم زر النشر على الدورة المحفوظة أدناه.')],
      ].map(([title, description], i) => <li key={i} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span><div><p className="font-medium">{title}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p></div></li>)}</ol>
      <div className="space-y-2 border-t pt-4"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /><h3 className="font-medium">{tr('Safe, isolated lessons', 'دروس آمنة ومعزولة')}</h3><p className="text-xs leading-6 text-muted-foreground">{tr('External services, form submissions, network requests and persistent quiz scores are not supported. Bundle all assets locally. Compiled content must be under 2.9 MB.', 'الخدمات الخارجية وإرسال النماذج وطلبات الشبكة وحفظ نتائج الاختبارات غير مدعومة. ضمّن جميع الموارد محليًا. يجب أن يقل المحتوى المجمّع عن 2.9 ميغابايت.')}</p></div>
    </aside></div>
    {preview && pkg && <section className="space-y-3 rounded-xl border p-4"><h2 className="text-xl font-bold">{tr('Private preview', 'معاينة خاصة')}</h2><OpenCourseLessons pkg={pkg} /></section>}
    <div className="flex items-center justify-between"><h2 className="text-2xl font-bold">{tr('Your open courses', 'دوراتك المفتوحة')}</h2><Button disabled={busy} variant="outline" onClick={() => void run(async () => { reset(); await load(); })}>{tr('Refresh list', 'تحديث القائمة')}</Button></div>
    {busy && <p role="status">{tr('Working…', 'جارٍ العمل…')}</p>}
    {!busy && !error && items.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center"><BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" /><p className="font-medium">{tr('Your first open course starts here', 'ابدأ أول دورة مفتوحة هنا')}</p><p className="mt-2 text-sm text-muted-foreground">{tr('Upload a ZIP above and save a private draft to get started.', 'ارفع ملف ZIP أعلاه واحفظ مسودة خاصة للبدء.')}</p></div>}
    <div className="grid gap-5 lg:grid-cols-2">{items.map(item => <article key={item.id} className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-start gap-4">{item.image ? <img src={item.image} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen className="h-7 w-7" aria-hidden="true" /></div>}<div className="min-w-0 space-y-2"><h3 className="break-words text-lg font-semibold">{item.title[lang]}</h3><p className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{item.published ? tr('Public — no registration', 'منشورة — دون تسجيل') : tr('Private draft', 'مسودة خاصة')}</p><p className="text-xs text-muted-foreground">{item.details[lang]}</p></div></div>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} variant="outline" onClick={() => { reset(); setSelected(item); setMetadata(item); }}>{tr('Edit details', 'تعديل التفاصيل')}</Button>
        <Button disabled={busy} variant="outline" onClick={() => void run(async () => {
          const response = await fetch(`/api/open-courses/${item.id}?preview=1`, { headers: await token(), cache: 'no-store' }); if (!response.ok) throw new Error('PREVIEW_FAILED');
          const data = await response.json(); setSelected(data.course); setMetadata(data.course); setPkg(data.package); setReplacement(false); setPreview(true);
        })}>{tr('Preview saved course', 'معاينة الدورة المحفوظة')}</Button>
        <Button disabled={busy} variant={item.published ? 'outline' : 'default'} onClick={() => {
          if (window.confirm(item.published ? tr('Withdraw this course? New public loads will be blocked; already loaded copies cannot be recalled.', 'سحب نشر الدورة؟ ستُمنع عمليات التحميل الجديدة ولا يمكن استرجاع النسخ المحمّلة.') : tr('Publish the saved course for everyone without registration? Preview and check every lesson first.', 'نشر الدورة المحفوظة للجميع دون تسجيل؟ عاين كل الدروس وتحقق منها أولًا.'))) void run(() => patch(item, { published: !item.published }));
        }}>{item.published ? tr('Withdraw', 'سحب النشر') : tr('Publish', 'نشر')}</Button>
        {item.published && <Button asChild variant="outline"><Link href={item.href}>{tr('Open public course', 'فتح الدورة العامة')}</Link></Button>}
      </div></article>)}</div>
    {next && <Button disabled={busy} onClick={() => void run(() => load(next))}>{tr('Load more', 'تحميل المزيد')}</Button>}
  </main>;
}

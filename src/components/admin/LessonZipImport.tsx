'use client';
import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { Upload, ArrowUp, ArrowDown } from 'lucide-react';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ImportedLessonContent } from '@/components/learn/imported-lesson-content';
import { InteractiveLessonPlayer } from '@/components/learn/interactive-lesson-player';
import { PACKAGE_LIMITS, validatePackage, type LessonPackage } from '@/lib/lesson-package';

type Draft = {id:string;name:string;count:number};
export default function LessonZipImport({courseId}:{courseId:string}) {
  const {lang}=useLang(); const ar=lang==='ar';
  const t=(en:string,arabic:string)=>ar?arabic:en;
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [preview,setPreview]=useState<LessonPackage|null>(null);
  const [name,setName]=useState('');
  const [importId,setImportId]=useState('');
  const [saved,setSaved]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [mode,setMode]=useState<'standard'|'interactive'>('standard');
  const [previewKey,setPreviewKey]=useState<string|null>(null);
  const endpoint='/api/courses/'+encodeURIComponent(courseId)+'/lesson-imports';
  function report(e:unknown) {
    const code=e instanceof Error?e.message:'IMPORT_FAILED';
    const messages:Record<string,[string,string]>={
      ZIP_TOO_LARGE:['ZIP must be 60 MB or smaller.','يجب ألا يتجاوز ملف ZIP حجم 60 ميغابايت.'],
      INVALID_LESSONS:['Choose a ZIP containing 1–20 HTML lessons.','اختر ملف ZIP يحتوي على درس إلى 20 درسًا بصيغة HTML.'],
      CONTENT_TOO_LARGE:['A lesson exceeds the safe content size. Reduce its images or split it.','يتجاوز أحد الدروس الحجم المسموح. صغّر الصور أو قسّم الدرس.'],
      PACKAGE_TOO_LARGE:['Converted content exceeds 3 MB. Split this package into smaller imports.','يتجاوز المحتوى المحوّل 3 ميغابايت. قسّم الحزمة إلى ملفات أصغر.'],
      IMPORT_CONFLICT:['This draft was already saved or changed. Reopen it from Saved drafts.','حُفظت هذه المسودة أو تغيّرت. افتحها من المسودات المحفوظة.'],
      UNAUTHORIZED:['Sign in again before importing.','سجّل الدخول مجددًا قبل الاستيراد.'],
      FORBIDDEN:['Only an administrator or this course’s assigned teacher can import.','الاستيراد متاح للمشرف أو المدرّس المعيّن لهذه الدورة فقط.'],
      EXTERNAL_DEPENDENCY:['Interactive lessons must include their scripts, styles and images in the package. External resources cannot be loaded.','يجب تضمين السكربتات والتنسيقات والصور داخل الحزمة. لا يمكن تحميل موارد خارجية.'],
      MISSING_ASSET:['A referenced file is missing from the package. Include it and retry.','أحد الملفات المطلوبة غير موجود في الحزمة. أضفه وأعد المحاولة.'],
      UNSUPPORTED_ASSET:['This interactive package contains an unsupported file type. Use HTML, CSS, JavaScript, images and WOFF fonts.','تحتوي الحزمة على نوع ملف غير مدعوم. استخدم HTML وCSS وJavaScript والصور وخطوط WOFF.'],
      INTERACTIVE_CSS_IMPORT:['Bundle CSS imports into your stylesheet before uploading.','ادمج ملفات CSS المستوردة داخل ملف التنسيق قبل الرفع.'],
      INTERACTIVE_MODULE_IMPORT:['Bundle JavaScript module imports into a standalone script before uploading.','ادمج وحدات JavaScript في سكربت مستقل قبل الرفع.'],
      HTML_TOO_LARGE:['An HTML or script file exceeds 250 KB. Split the package.','يتجاوز ملف HTML أو سكربت 250 كيلوبايت. قسّم الحزمة.'],
    };
    setError(messages[code]?.[ar?1:0] || t('Could not process this package. It may contain unsupported, unsafe or oversized files. Your existing lessons were not changed.','تعذرت معالجة الحزمة. قد تحتوي على ملفات غير مدعومة أو غير آمنة أو كبيرة. لم تتغير دروسك الحالية.'));
  }
  async function request(action?:Record<string,unknown>, query='') {
    const user=getAuth().currentUser;
    if(!user) throw new Error('UNAUTHORIZED');
    const response=await fetch(endpoint+query,{method:action?'POST':'GET',headers:{Authorization:'Bearer '+await user.getIdToken(),'Content-Type':'application/json'},...(action?{body:JSON.stringify(action)}:{})});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'IMPORT_FAILED');
    return data;
  }
  async function show() {
    setOpen(true); setBusy(true); setError(''); setMessage(''); setPreview(null); setConfirm(false);
    try {const data=await request(); setDrafts(data.imports);} catch(e){report(e);} finally{setBusy(false);}
  }
  async function read(file:File) {
    setBusy(true); setError(''); setMessage(''); setPreview(null); setSaved(false); setConfirm(false);
    try {
      if(file.size>PACKAGE_LIMITS.zip) throw new Error('ZIP_TOO_LARGE');
      let parsed:LessonPackage;
      if(mode==='interactive') {
        const {parseInteractiveHtml,parseInteractiveZip}=await import('@/lib/parse-interactive-zip');
        parsed=/\.html?$/i.test(file.name) ? parseInteractiveHtml(await file.text(),file.name) : parseInteractiveZip(new Uint8Array(await file.arrayBuffer()));
      } else {
        const {parseLessonZip}=await import('@/lib/parse-lesson-zip');
        parsed=parseLessonZip(new Uint8Array(await file.arrayBuffer()));
      }
      setPreviewKey(null);
      setPreview(parsed); setName(file.name); setImportId(crypto.randomUUID());
    } catch(e){report(e);} finally{setBusy(false);}
  }
  async function resume(draft:Draft) {
    setBusy(true); setError(''); setMessage(''); setConfirm(false);
    try {const data=await request(undefined,'?importId='+draft.id); const clean=validatePackage(data); setPreview(clean); setMode(clean.lessons.some(l=>l.interactiveHtml !== undefined)?'interactive':'standard'); setPreviewKey(null); setName(draft.name); setImportId(draft.id); setSaved(true);} catch(e){report(e);} finally{setBusy(false);}
  }
  async function save() {
    if(!preview) return;
    setBusy(true); setError('');
    try {
      const clean=validatePackage(preview);
      const result=await request({action:'save',importId,name,lessons:clean.lessons});
      if(result.status!=='DRAFT') throw new Error('IMPORT_CONFLICT');
      setSaved(true); setMessage(t('Drafts saved. Students cannot see them until you publish.','حُفظت المسودات. لن يراها الطلاب حتى تنشرها.'));
      setDrafts(items=>[{id:importId,name,count:clean.lessons.length},...items.filter(d=>d.id!==importId)]);
    } catch(e){report(e);} finally{setBusy(false);}
  }
  async function publish() {
    setBusy(true); setError('');
    try {
      await request({action:'publish',importId});
      setPreview(null); setConfirm(false); setDrafts(items=>items.filter(d=>d.id!==importId));
      setMessage(t('Lessons published. Existing lessons were preserved.','نُشرت الدروس مع الحفاظ على الدروس الحالية.'));
    } catch(e){report(e);} finally{setBusy(false);}
  }
  function move(index:number,delta:number) {
    if(!preview) return;
    const lessons=[...preview.lessons]; [lessons[index],lessons[index+delta]]=[lessons[index+delta],lessons[index]];
    setPreview({...preview,lessons});
  }
  const warningCopy:Record<string,[string,string]>={
    INTERACTIVE_ISOLATION:['Original styling, animations and scripts are preserved. Network services, external embeds, storage, clipboard and form submissions are unavailable in the isolated player.','يُحفظ التنسيق والرسوم المتحركة والسكربتات الأصلية. لا تتاح خدمات الشبكة والتضمينات الخارجية والتخزين والحافظة وإرسال النماذج في المشغّل المعزول.'],
    ACTIVE_CONTENT_REMOVED:['Scripts, forms, embedded players and original styling are excluded. Links open separately.','تُستبعد السكربتات والنماذج والمشغلات المضمّنة والتنسيقات الأصلية. تفتح الروابط بشكل منفصل.'],
    LARGE_IMAGES_SKIPPED:['Images larger than 400 KB were skipped. Reduce referenced images before importing if needed.','تُجاوزت الصور الأكبر من 400 كيلوبايت. صغّر الصور المطلوبة قبل الاستيراد عند الحاجة.'],
    MISSING_IMAGES:['Some images are external, missing or unsupported; review each lesson before saving.','بعض الصور خارجية أو مفقودة أو غير مدعومة؛ راجع كل درس قبل الحفظ.'],
    UNSUPPORTED_LINKS:['Some local attachments or anchor links could not be preserved. Their text remains.','تعذر الاحتفاظ ببعض روابط المرفقات المحلية أو الروابط الداخلية. احتُفظ بنصوصها.'],
  };
  return <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}>
    <DialogTrigger asChild><Button variant="outline" onClick={show}><Upload className="size-4"/>{t('Import ZIP','استيراد ZIP')}</Button></DialogTrigger>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader><DialogTitle>{t('Import course lessons','استيراد دروس الدورة')}</DialogTitle><DialogDescription>{t('Preview → save drafts → publish. Existing lessons are never replaced. Only import content you have permission to use.','معاينة ← حفظ المسودات ← نشر. لن تُستبدل الدروس الحالية. استورد المحتوى الذي لديك إذن باستخدامه فقط.')}</DialogDescription></DialogHeader>
      <div className="min-w-0 space-y-5">
        <div className="space-y-2 rounded-lg border p-4">
          <label className="block space-y-2 text-sm font-medium"><span>{t('Lesson mode','نوع الدرس')}</span>
            <select value={mode} disabled={busy} className="w-full rounded-md border bg-background p-2" onChange={e=>{setMode(e.target.value as 'standard'|'interactive');setPreview(null);setSaved(false);setConfirm(false);setPreviewKey(null);setError('');setMessage('');}}>
              <option value="standard">{t('Standard lessons — simplified content','دروس قياسية — محتوى مبسّط')}</option>
              <option value="interactive">{t('Interactive HTML — preserve design and quizzes','HTML تفاعلي — حفظ التصميم والاختبارات')}</option>
            </select>
          </label>
          <label htmlFor={'lesson-zip-'+courseId} className="text-sm font-medium">{mode==='interactive'?t('HTML file or ZIP','ملف HTML أو ZIP'):t('HTML lesson ZIP','ملف ZIP لدروس HTML')}</label>
          <Input id={'lesson-zip-'+courseId} type="file" accept={mode==='interactive'?'.zip,.html,.htm,application/zip,text/html':'.zip,application/zip'} disabled={busy} onChange={e=>{const file=e.target.files?.[0]; if(file)void read(file); e.target.value='';}}/>
          {mode==='interactive'&&<p className="text-xs text-muted-foreground">{t('Upload a self-contained HTML file or a ZIP with HTML, CSS, scripts and local images. Preview before publishing.','ارفع ملف HTML مستقلًا أو ZIP يحتوي على HTML وCSS والسكربتات والصور المحلية. عاين الدرس قبل النشر.')}</p>}
          <p className="text-xs text-muted-foreground">{t('Up to 60 MB ZIP, 20 lessons, 400 KB per image and 3 MB converted content. ZIP is processed on your device; only the reviewed content is saved.','حتى 60 ميغابايت للملف، و20 درسًا، و400 كيلوبايت للصورة، و3 ميغابايت للمحتوى المحوّل. يُعالج ZIP على جهازك؛ ويُحفظ المحتوى الذي تراجعه فقط.')}</p>
        </div>
        {busy&&<p role="status">{t('Processing…','جارٍ المعالجة…')}</p>}
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
        {message&&<p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p>}
        {preview&&<>
          <h3 className="break-words font-semibold">{name} · {preview.lessons.length} {t('lessons','دروس')}</h3>
          {preview.warnings.length>0&&<ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">{preview.warnings.map(w=><li key={w}>{warningCopy[w]?.[ar?1:0]||w}</li>)}</ul>}
          <div className="space-y-3">{preview.lessons.map((lesson,index)=><section key={lesson.key} id={'import-'+lesson.key} className="min-w-0 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">{index+1}.</span>
              <Input dir="auto" className="min-w-0 flex-1 basis-40" value={lesson.title} maxLength={200} disabled={busy||saved} aria-label={t('Lesson title','عنوان الدرس')+' '+(index+1)} onChange={e=>setPreview({...preview,lessons:preview.lessons.map((l,i)=>i===index?{...l,title:e.target.value}:l)})}/>
              {!saved&&<><Button variant="outline" size="icon" disabled={busy||index===0} aria-label={t('Move up','نقل لأعلى')+' '+lesson.title} onClick={()=>move(index,-1)}><ArrowUp className="size-4"/></Button><Button variant="outline" size="icon" disabled={busy||index===preview.lessons.length-1} aria-label={t('Move down','نقل لأسفل')+' '+lesson.title} onClick={()=>move(index,1)}><ArrowDown className="size-4"/></Button></>}
            </div>
            {lesson.interactiveHtml !== undefined ? <div className="mt-3 space-y-3"><Button type="button" variant="outline" size="sm" onClick={()=>setPreviewKey(key=>key===lesson.key?null:lesson.key)}>{previewKey===lesson.key?t('Close preview','إغلاق المعاينة'):t('Preview interactive lesson','معاينة الدرس التفاعلي')}</Button>{previewKey===lesson.key&&<InteractiveLessonPlayer html={lesson.interactiveHtml} title={lesson.title}/>}</div> : <details className="mt-3"><summary className="cursor-pointer text-sm text-accent">{t('Preview lesson','معاينة الدرس')}</summary><ImportedLessonContent nodes={lesson.nodes}/></details>}
          </section>)}</div>
          {!saved?<Button onClick={save} disabled={busy} className="w-full">{t('Save as drafts','حفظ كمسودات')}</Button>:!confirm?<Button onClick={()=>setConfirm(true)} disabled={busy} className="w-full">{t('Review publication','مراجعة النشر')}</Button>:<div className="space-y-3 rounded-lg border p-4"><p>{t('Publish these lessons now? They will become available to learners who can access this course.','هل تريد نشر هذه الدروس الآن؟ ستتاح للطلاب الذين لديهم صلاحية الوصول إلى الدورة.')}</p><div className="flex flex-wrap gap-2"><Button onClick={publish} disabled={busy}>{t('Publish lessons','نشر الدروس')}</Button><Button variant="outline" onClick={()=>setConfirm(false)} disabled={busy}>{t('Keep as drafts','الاحتفاظ كمسودات')}</Button></div></div>}
        </>}
        {drafts.length>0&&<section className="space-y-2 border-t pt-4"><h3 className="font-semibold">{t('Saved drafts','المسودات المحفوظة')}</h3>{drafts.map(d=><div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-3"><span className="min-w-0 break-words text-sm">{d.name} ({d.count})</span><Button size="sm" variant="outline" onClick={()=>resume(d)} disabled={busy}>{t('Review','مراجعة')}</Button></div>)}</section>}
      </div>
    </DialogContent>
  </Dialog>;
}

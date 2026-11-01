'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseInteractiveHtml, parseInteractiveZip } from '@/lib/parse-interactive-zip';
import type { LessonPackage, PackageLesson } from '@/lib/lesson-package';
import { changeModule, type ModuleChange } from '@/lib/open-course-modules';

export function OpenCourseModuleEditor({ pkg, disabled, ar, onChange, run }: {
  pkg: LessonPackage; disabled: boolean; ar: boolean;
  onChange: (pkg: LessonPackage) => void;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const [rename, setRename] = useState<{ key: string; title: string } | null>(null);
  function apply(change: ModuleChange) { void run(async () => { onChange(changeModule(pkg, change)); setRename(null); }); }
  async function read(file: File): Promise<PackageLesson> {
    if (file.size > 10_000_000) throw new Error('FILE_TOO_LARGE');
    const result = /\.zip$/i.test(file.name) ? parseInteractiveZip(new Uint8Array(await file.arrayBuffer())) :
      /\.html?$/i.test(file.name) ? parseInteractiveHtml(await file.text(), file.name) : null;
    if (!result || result.lessons.length !== 1) throw new Error('SINGLE_MODULE_REQUIRED');
    return result.lessons[0];
  }
  function fileInput(key?: string) {
    return <label className="block space-y-2 text-sm"><span>{key ? tr('Replace module HTML / ZIP', 'استبدال الوحدة HTML / ZIP') : tr('Add module HTML / ZIP', 'إضافة وحدة HTML / ZIP')}</span>
      <Input type="file" accept=".html,.htm,.zip" disabled={disabled} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (file) void run(async () => { const lesson = await read(file); onChange(changeModule(pkg, key ? { kind:'replace', key, lesson } : { kind:'add', lesson })); setRename(null); });
      }} /></label>;
  }
  return <section aria-label={tr('Course modules', 'وحدات الدورة')} className="space-y-4 rounded-xl border p-4">
    <h3 className="text-lg font-semibold">{tr('Course modules', 'وحدات الدورة')} ({pkg.lessons.length})</h3>
    <p className="text-sm leading-6 text-muted-foreground">{tr('Add, replace, rename, reorder or remove individual modules. Changes are local until Save details. Preview before saving. ZIP files must contain exactly one HTML lesson and its local assets.', 'أضف أو استبدل أو أعد تسمية أو ترتيب أو أزل الوحدات منفردة. التغييرات محلية حتى حفظ التفاصيل. عاين قبل الحفظ. يجب أن يحتوي ZIP على درس HTML واحد وموارده المحلية.')}</p>
    {fileInput()}
    <ol className="space-y-3">{pkg.lessons.map((lesson, index) => <li key={lesson.key} className="space-y-3 rounded-lg border bg-background p-3">
      <p dir="auto" className="break-words font-medium">{index + 1}. {lesson.title}</p>
      {rename?.key === lesson.key ? <div className="space-y-2"><label className="block">{tr('Module title', 'عنوان الوحدة')}<Input disabled={disabled} maxLength={200} value={rename.title} onChange={e => setRename({ key:lesson.key, title:e.target.value })} /></label>
        <Button type="button" disabled={disabled || !rename.title.trim()} onClick={() => apply({ kind:'rename', key:lesson.key, title:rename.title })}>{tr('Apply title', 'تطبيق العنوان')}</Button>
        <Button type="button" variant="outline" disabled={disabled} onClick={() => setRename(null)}>{tr('Cancel title edit', 'إلغاء تعديل العنوان')}</Button></div> :
        <Button type="button" variant="outline" disabled={disabled} onClick={() => setRename({ key:lesson.key, title:lesson.title })}>{tr('Rename module', 'إعادة تسمية الوحدة')}</Button>}
      {fileInput(lesson.key)}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={disabled || index === 0} onClick={() => apply({ kind:'move', key:lesson.key, direction:-1 })}>{tr('Move up', 'نقل لأعلى')}</Button>
        <Button type="button" variant="outline" disabled={disabled || index === pkg.lessons.length - 1} onClick={() => apply({ kind:'move', key:lesson.key, direction:1 })}>{tr('Move down', 'نقل لأسفل')}</Button>
        <Button type="button" variant="outline" disabled={disabled || pkg.lessons.length === 1} onClick={() => {
          if (window.confirm(tr('Remove this module from the pending draft? Nothing changes on the server until Save details. Prior stored packages are retained.', 'إزالة هذه الوحدة من المسودة المعلقة؟ لن يتغير الخادم حتى حفظ التفاصيل. تُحتفظ الحزم السابقة.'))) apply({ kind:'remove', key:lesson.key });
        }}>{tr('Remove module', 'إزالة الوحدة')}</Button>
      </div>
    </li>)}</ol>
  </section>;
}

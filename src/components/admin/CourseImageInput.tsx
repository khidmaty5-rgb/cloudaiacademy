'use client';
import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { prepareCourseImage } from '@/lib/course-image-upload';

export function CourseImageInput({ value, onChange, disabled, arabic, onBusyChange }: {
  value: string; onChange: (value: string) => void; disabled: boolean; arabic: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const copy = (en: string, ar: string) => arabic ? ar : en;
  return <div className="space-y-3">
    {value && <img src={value} alt={copy('Course image preview', 'معاينة صورة الدورة')} className="max-h-48 w-full rounded-lg border object-contain" />}
    <label className="block space-y-2 text-sm">
      <span>{copy('Choose course image', 'اختر صورة الدورة')}</span>
      <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file) return;
        const request = ++generation.current;
        setBusy(true); onBusyChange(true); setError('');
        try { const image = await prepareCourseImage(file); if (request === generation.current) onChange(image); }
        catch { setError(copy('Could not read this image. Choose a JPG, PNG or WebP file up to 8 MB.', 'تعذّرت قراءة الصورة. اختر ملف JPG أو PNG أو WebP بحجم لا يتجاوز 8 ميغابايت.')); }
        finally { setBusy(false); onBusyChange(false); }
      }} />
    </label>
    <p className="text-xs text-muted-foreground">{copy('JPG, PNG or WebP, up to 8 MB. Optimized automatically. The image is saved when you save the course.', 'JPG أو PNG أو WebP حتى 8 ميغابايت. تُحسّن الصورة تلقائيًا وتُحفظ عند حفظ الدورة.')}</p>
    {busy && <p role="status">{copy('Preparing image…', 'جارٍ تجهيز الصورة…')}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!value.startsWith('data:') && <Input aria-label={copy('Or enter an image URL', 'أو أدخل رابط الصورة')} value={value} placeholder="https://… or /images/…" disabled={disabled || busy} onChange={event => onChange(event.target.value)} />}
    {value && <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => { onChange(''); setError(''); }}>{copy('Remove image', 'إزالة الصورة')}</Button>}
  </div>;
}

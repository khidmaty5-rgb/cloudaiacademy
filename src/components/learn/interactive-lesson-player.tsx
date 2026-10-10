'use client';
import { useRef, useState } from 'react';
import { interactiveUrl } from '@/lib/interactive-lesson';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';

export function InteractiveLessonPlayer({ html, title }: { html: string; title: string }) {
  const { lang } = useLang(); const ar = lang === 'ar';
  const container = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);
  const [expanded, setExpanded] = useState(false);
  let src: string;
  try { src = interactiveUrl(html); } catch {
    return <p role="alert">{ar ? 'تعذّر عرض الدرس التفاعلي.' : 'The interactive lesson could not be displayed.'}</p>;
  }
  return <div ref={container} className="min-w-0 space-y-3 rounded-xl bg-background">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{ar ? 'درس HTML تفاعلي' : 'Interactive HTML lesson'}</span>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setExpanded(value => !value)}>{ar ? (expanded ? 'عرض مدمج' : 'توسيع العرض') : (expanded ? 'Compact view' : 'Expand view')}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setVersion(value => value + 1)}>{ar ? 'إعادة تشغيل الدرس' : 'Restart lesson'}</Button>
      </div>
    </div>
    <iframe key={version} title={title} src={src} sandbox="allow-scripts"
      referrerPolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'; payment 'none'"
      className={`w-full rounded-lg border bg-white ${expanded ? 'h-[85dvh] min-h-[32rem]' : 'h-[65dvh] min-h-[24rem]'}`}/>
  </div>;
}

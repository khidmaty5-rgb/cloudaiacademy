'use client';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';

export function DataLoadError() {
  const { lang } = useLang();
  return <div role="alert" className="space-y-3 rounded-lg border p-6">
    <p>{lang === 'ar' ? 'تعذّر تحميل البيانات. هذا لا يعني عدم وجود سجلات. تحقّق من الاتصال والصلاحيات ثم أعد المحاولة.' : 'Data could not be loaded. This does not mean there are no records. Check your connection and access, then retry.'}</p>
    <Button variant="outline" onClick={() => window.location.reload()}>{lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}</Button>
  </div>;
}

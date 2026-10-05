'use client';
import { useState } from 'react';
import { academy } from '@/lib/academy';
import { academySchema } from '@/lib/academy-schema';
import { useLang } from '@/components/i18n/lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const labels: Record<string, [string,string]> = {
  certificateLogoPath: ['Certificate logo path','مسار شعار الشهادة'],
  name: ['Academy name','اسم الأكاديمية'], description: ['Description','الوصف'], siteUrl: ['Website URL','رابط الموقع'],
  logoPath: ['Logo path','مسار الشعار'], contactEmail: ['Contact email','البريد الإلكتروني'], phone: ['Phone','الهاتف'], address: ['Address','العنوان'],
  facebookUrl: ['Facebook URL','رابط فيسبوك'], journalName: ['Journal name','اسم المجلة'], journalEmail: ['Journal email','بريد المجلة'],
  certificatePrefix: ['Certificate prefix','بادئة الشهادة'], certificateTemplatePath: ['Certificate PDF path','مسار قالب الشهادة'],
  meetingPrefix: ['Meeting prefix','بادئة الاجتماع'], defaultLanguage: ['Language: en or ar','اللغة: en أو ar'],
  accentLight: ['Light accent (H S% L%)','اللون الفاتح (H S% L%)'], accentDark: ['Dark accent (H S% L%)','اللون الداكن (H S% L%)'], analyticsUrl: ['Analytics URL','رابط التحليلات'],
  journal: ['Journal','المجلة'], research: ['Research','الأبحاث'], liveTeaching: ['Live teaching','التدريس المباشر'], certificates: ['Certificates','الشهادات'],
  learningPaths: ['Learning paths','مسارات التعلّم'], telegram: ['Telegram','تيليجرام'], payments: ['New payments','مدفوعات جديدة'], testimonials: ['Testimonials','آراء المتعلّمين'],
};
export default function AcademySettingsPage() {
  const { lang } = useLang(); const ar = lang === 'ar';
  const [draft, setDraft] = useState(academy); const [message, setMessage] = useState('');
  function download() {
    const result = academySchema.safeParse(draft);
    if (!result.success) { setMessage(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n')); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(result.data, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'academy.config.json'; link.click(); URL.revokeObjectURL(url);
    setMessage(ar ? 'تم التصدير. استبدل ملف الإعدادات في النسخة الجديدة ثم انشرها. لم يتغير الموقع الحالي.' : 'Exported. Replace the configuration in the new deployment and redeploy. This live site is unchanged.');
  }
  return <div className="mx-auto max-w-4xl space-y-6">
    <h1 className="text-3xl font-bold">{ar ? 'قالب الأكاديمية' : 'Academy template'}</h1>
    <p>{ar ? 'إعدادات عامة فقط، دون كلمات مرور أو مفاتيح. كل أكاديمية تحتاج إلى قاعدة بيانات وحسابات خدمات مستقلة. التصدير لا يغير الموقع الحالي.' : 'Public configuration only—never passwords or API secrets. Each academy requires a separate database and service accounts. Export does not change this live site.'}</p>
    <div className="grid gap-5 sm:grid-cols-2">{Object.entries(draft).filter(([key]) => key !== 'features').map(([key,value]) => <label className="space-y-2" key={key}>
      <span>{labels[key]?.[ar ? 1 : 0] || key}</span><Input dir="auto" value={String(value)} onChange={e => setDraft(previous => ({ ...previous, [key]: e.target.value }))}/>
    </label>)}</div>
    <fieldset className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2"><legend>{ar ? 'الوحدات' : 'Modules'}</legend>
      {Object.entries(draft.features).map(([key,value]) => <label className="flex items-center gap-3" key={key}><input type="checkbox" checked={value} onChange={e => setDraft(previous => ({ ...previous, features: { ...previous.features, [key]: e.target.checked } }))}/>{labels[key]?.[ar ? 1 : 0] || key}</label>)}
    </fieldset>
    <p className="text-sm text-muted-foreground">{ar ? 'الأسعار والعملات ومحتوى الموقع تُدار من صفحات الإعدادات الحالية. اختبر تباين الألوان والشعار والشهادات قبل النشر.' : 'Prices, currencies, and site content remain in their existing settings pages. Verify color contrast, logo, and certificates before launch.'}</p>
    <Button onClick={download}>{ar ? 'تصدير إعدادات الأكاديمية' : 'Export academy configuration'}</Button>
    {message && <p role="status" className="whitespace-pre-wrap rounded-xl border p-4">{message}</p>}
  </div>;
}

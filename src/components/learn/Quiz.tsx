'use client';

import { useLang } from '@/components/i18n/lang';

export default function Quiz(_props: { lessonContent: string }) {
  void _props;
  const { lang } = useLang();
  return <div role="status" className="space-y-3 p-6 text-center">
    <h3 className="text-lg font-semibold">{lang === 'ar' ? 'الاختبار غير متاح حاليًا' : 'Quiz not currently available'}</h3>
    <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'لا تتوفر أسئلة معتمدة لهذا الدرس هنا. راجع المادة وتدرّب على أمثلتها. لا تُمنح درجة اختبار أو إكمال تلقائي من هذه اللوحة.' : 'Reviewed questions for this lesson are not available here. Review the material and practise its examples. This panel does not award a quiz score or automatically complete the lesson.'}</p>
  </div>;
}

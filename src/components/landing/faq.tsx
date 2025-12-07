'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useLang } from '@/components/i18n/lang';

export default function Faq() {
  const { lang } = useLang();
  const heading = lang === 'ar' ? 'الأسئلة الشائعة' : 'Frequently Asked Questions';
  const sub = lang === 'ar'
    ? 'اعثر على إجابات لأكثر الأسئلة شيوعًا حول منصتنا.'
    : 'Find answers to common questions about our platform.';
  const faqs = lang === 'ar'
    ? [
        {
          question: 'هل تقدمون تجربة مجانية؟',
          answer:
            'نعم، نوفر تجربة مجانية لمدة 7 أيام للطلاب الجدد. ستحصل على وصول إلى الدورات التمهيدية ويمكنك استكشاف المنصة قبل الاشتراك.',
        },
        {
          question: 'ماذا لو لم أستطع مجاراة وتيرة التعلم؟',
          answer:
            'جميع دوراتنا ذاتية السرعة، يمكنك التعلم وفق وتيرتك. ستحصل على وصول مدى الحياة إلى المواد بعد التسجيل.',
        },
        {
          question: 'هل شهاداتكم معترف بها لدى أصحاب العمل؟',
          answer:
            'نعم، شهاداتنا معترف بها لدى الشركاء وأصحاب العمل. كما نُعدّك لشهادات رسمية من AWS وMicrosoft وGoogle.',
        },
        {
          question: 'ما نوع الدعم الذي تقدّمونه؟',
          answer:
            'نقدّم دعم المجتمع لجميع الطلاب، ودعم أولوية لمشتركي خطة Pro، وإرشاد فردي 1-1 لمشتركي خطة Enterprise.',
        },
      ]
    : [
        {
          question: 'Do you offer a free trial?',
          answer:
            "Yes, we offer a 7-day free trial for all new students. You'll get access to our introductory courses and can explore the platform before committing to a paid plan.",
        },
        {
          question: "What if I can't keep up with the course pace?",
          answer:
            "All our courses are self-paced, so you can learn at your own speed. You'll have lifetime access to course materials once you enroll.",
        },
        {
          question: 'Are the certificates recognized by employers?',
          answer:
            'Yes, our certificates are recognized by industry partners and employers. We also prepare you for official certifications from AWS, Microsoft, and Google.',
        },
        {
          question: 'What kind of support do you offer?',
          answer:
            'We offer community support for all students, priority support for Pro plan subscribers, and 1-on-1 mentoring for Enterprise plan subscribers.',
        },
      ];
  return (
    <section id="faq" className="py-20 md:py-28 bg-muted/50">
      <div className="container max-w-3xl">
        <div className="text-center">
          <h2 className="font-headline text-3xl md:text-4xl font-bold">
            {heading}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {sub}
          </p>
        </div>
        <Accordion type="single" collapsible className="w-full mt-12">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border-l-4 border-accent bg-background px-4 rounded-lg mb-2 shadow-sm"
            >
              <AccordionTrigger className="text-lg text-left hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

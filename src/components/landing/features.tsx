"use client";

import { Laptop, GraduationCap, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLang } from '@/components/i18n/lang';

export default function Features() {
  const { lang } = useLang();
  const heading = lang === 'ar' ? 'لماذا تختار CloudAI Academy؟' : 'Why Choose CloudAI Academy?';
  const sub = lang === 'ar'
    ? 'نقدّم تجربة تعلّم شاملة لإعداد محترفي السحابة والذكاء الاصطناعي للمستقبل.'
    : "We provide the most comprehensive learning experience for tomorrow's top cloud and AI professionals.";
  const features = (
    lang === 'ar'
      ? [
          {
            icon: <Laptop className="h-10 w-10" />,
            title: 'تعلّم عملي',
            description: 'اكتسب خبرة عملية عبر مشاريع واقعية وبيئات سحابية.',
          },
          {
            icon: <GraduationCap className="h-10 w-10" />,
            title: 'مدرّسون خبراء',
            description: 'تعلّم من محترفين ذوي خبرة في السحابة والذكاء الاصطناعي.',
          },
          {
            icon: <Award className="h-10 w-10" />,
            title: 'شهادات معتمدة',
            description: 'استعد لشهادات AWS وAzure وGoogle Cloud وغيرها.',
          },
        ]
      : [
          {
            icon: <Laptop className="h-10 w-10" />,
            title: 'Hands-on Learning',
            description:
              'Gain practical experience with real-world projects and cloud environments.',
          },
          {
            icon: <GraduationCap className="h-10 w-10" />,
            title: 'Expert Instructors',
            description:
              'Learn from industry professionals with years of experience in cloud and AI.',
          },
          {
            icon: <Award className="h-10 w-10" />,
            title: 'Industry Certifications',
            description:
              'Prepare for AWS, Azure, Google Cloud, and other industry certifications.',
          },
        ]
  );
  return (
    <section id="features" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-headline text-3xl md:text-4xl font-bold">
            {heading}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {sub}
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="text-center group hover:shadow-lg transition-shadow duration-300 border-t-4 border-accent bg-card/50"
            >
              <CardHeader>
                <div className="mx-auto bg-accent/10 text-accent p-4 rounded-full w-fit group-hover:bg-accent group-hover:text-accent-foreground transition-colors duration-300">
                  {feature.icon}
                </div>
                <CardTitle className="font-headline mt-4">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

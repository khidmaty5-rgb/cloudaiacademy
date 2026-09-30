'use client';

import Link from 'next/link';
import { Handshake, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';

export default function ResearchPartnerPage() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const title = ar ? 'كن شريكاً معنا' : 'Partner with Us';
  const sub = ar
    ? 'ادعم مبادرات مرحلة الإطلاق بمشكلات واقعية أو مجموعات بيانات أو أرصدة حوسبة أو إرشاد.'
    : 'Support launch-phase initiatives with real-world problem statements, datasets, compute credits, or mentorship.';
  const partnershipWays = ar
    ? ['مشكلات واقعية ليعمل عليها الطلاب', 'مجموعات بيانات بصلاحيات استخدام واضحة', 'أرصدة حوسبة أو موارد سحابية', 'محاضرات ضيوف وإرشاد ودعم للمراجعة', 'رعاية ورش العمل والفعاليات المجتمعية']
    : ['Problem statements for students to build against', 'Datasets (with clear usage permissions)', 'Compute credits / cloud resources', 'Guest talks, mentorship, and review support', 'Sponsorship for workshops and community events'];

  const email = 'info@cloudaiacademy.ca';
  const mailto = `mailto:${email}?subject=${encodeURIComponent('Research partnership (CloudAI Academy)')}`;

  return (
    <>
      <main className="flex-1">
        <section className="bg-muted/40 py-12 md:py-16">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center space-y-4">
              <h1 dir="auto" className="font-headline text-3xl md:text-4xl font-bold">
                {title}
              </h1>
              <p dir="auto" className="text-muted-foreground text-lg">
                {sub}
              </p>
              <div className="pt-2 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <a href={mailto}>
                    {ar ? 'ابدأ محادثة' : 'Start a conversation'}
                    <Handshake className="ms-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/research">{ar ? 'العودة إلى الأبحاث' : 'Back to Research'}</Link>
                </Button>
                <Button asChild variant="link" className="text-accent">
                  <Link href="/research/join">{ar ? 'انضم إلى مشروع' : 'Join a Project'}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-background py-16 md:py-20">
          <div className="container">
            <div className="mx-auto max-w-4xl grid gap-6 md:grid-cols-2">
              <Card className="bg-card/50 border-accent/30">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">{ar ? 'طرق الشراكة' : 'Ways to partner'}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <ul className="list-disc ps-5 space-y-2">
                    {partnershipWays.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-accent/30">
                <CardHeader>
                  <CardTitle className="font-headline text-xl">{ar ? 'التواصل' : 'Contact'}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                  <p>
                    {ar ? 'راسلنا بوصف مختصر لما ترغب في دعمه ونوع التعاون الذي تفضله.' : 'Email us with a short description of what you’d like to support and the type of collaboration you prefer.'}
                  </p>
                  <Button asChild variant="outline">
                    <a href={mailto}>
                      {ar ? `مراسلة ${email}` : `Email ${email}`}
                      <Mail className="ms-2 h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

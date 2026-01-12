'use client';

import Link from 'next/link';
import { Cpu, Database, Globe, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/components/i18n/lang';

type ResearchVariant = 'home' | 'page';

type ResearchProps = {
  variant?: ResearchVariant;
  sectionId?: string;
};

const tracks = {
  en: [
    {
      id: 'llm',
      title: 'AI & LLM Systems',
      icon: Cpu,
      points: ['RAG & evaluation', 'Fine-tuning & safety', 'Agents & automation'],
      tags: ['LLMs', 'RAG', 'Eval'],
    },
    {
      id: 'cloud',
      title: 'Cloud & MLOps',
      icon: Globe,
      points: ['Cloud-native ML', 'Observability & monitoring', 'Cost/latency optimization'],
      tags: ['MLOps', 'Cloud', 'Ops'],
    },
    {
      id: 'data',
      title: 'Applied Data & Analytics',
      icon: Database,
      points: ['Real-world datasets', 'Responsible data use', 'Reproducible pipelines'],
      tags: ['Data', 'Pipelines', 'Repro'],
    },
    {
      id: 'rai',
      title: 'Responsible AI',
      icon: ShieldCheck,
      points: ['Risk & governance', 'Security & privacy', 'Documentation & transparency'],
      tags: ['Safety', 'Policy', 'Security'],
    },
  ],
  ar: [
    {
      id: 'llm',
      title: 'أنظمة الذكاء الاصطناعي وLLM',
      icon: Cpu,
      points: ['RAG والتقييم', 'الضبط الدقيق والسلامة', 'الوكلاء (Agents) والأتمتة'],
      tags: ['LLMs', 'RAG', 'التقييم'],
    },
    {
      id: 'cloud',
      title: 'السحابة وMLOps',
      icon: Globe,
      points: ['تعلم آلي سحابي الأصل', 'الملاحظة والمراقبة', 'تحسين التكلفة/الزمن'],
      tags: ['MLOps', 'السحابة', 'العمليات'],
    },
    {
      id: 'data',
      title: 'البيانات والتحليلات التطبيقية',
      icon: Database,
      points: ['مجموعات بيانات واقعية', 'استخدام مسؤول للبيانات', 'مسارات قابلة لإعادة الإنتاج'],
      tags: ['البيانات', 'المسارات', 'قابلية الإعادة'],
    },
    {
      id: 'rai',
      title: 'الذكاء الاصطناعي المسؤول',
      icon: ShieldCheck,
      points: ['المخاطر والحوكمة', 'الأمن والخصوصية', 'التوثيق والشفافية'],
      tags: ['السلامة', 'السياسات', 'الأمن'],
    },
  ],
} as const;

export default function Research({ variant = 'home', sectionId }: ResearchProps) {
  const { lang } = useLang();

  const copy = {
    home: {
      en: {
        title: 'Research (Launch)',
        sub: 'Launch-phase initiatives in AI + cloud—built around reproducibility, evaluation, and open collaboration.',
        cta1: 'Join a Project',
        cta2: 'Propose a Project',
      },
      ar: {
        title: 'البحث (إطلاق)',
        sub: 'مبادرات بحثية في مرحلة الإطلاق في الذكاء الاصطناعي والسحابة—تركّز على قابلية الإعادة والتقييم والتعاون المفتوح.',
        cta1: 'انضم إلى مشروع',
        cta2: 'اقترح مشروعًا',
      },
    },
    page: {
      en: {
        title: 'Focus areas',
        sub: 'Themes we work on across projects and pilot technical reports.',
      },
      ar: {
        title: 'مجالات التركيز',
        sub: 'مواضيع نعمل عليها عبر المشاريع والتقارير التقنية التجريبية.',
      },
    },
  } as const;

  const t = copy[variant][lang];

  const items = tracks[lang];
  const id = sectionId || (variant === 'home' ? 'research' : 'focus-areas');

  return (
    <section id={id} className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto">
          <h2 dir="auto" className="font-headline text-3xl md:text-4xl font-bold">
            {t.title}
          </h2>
          <p dir="auto" className="mt-4 text-lg text-muted-foreground">
            {t.sub}
          </p>
          {variant === 'home' && (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/research/join">{copy.home[lang].cta1}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/research/propose">{copy.home[lang].cta2}</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((track) => {
            const Icon = track.icon;
            return (
              <Card
                key={track.id}
                className="group hover:shadow-lg transition-shadow duration-300 border-t-4 border-accent bg-card/50"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-center">
                    <div className="rounded-full bg-accent/10 text-accent p-3 group-hover:bg-accent group-hover:text-accent-foreground transition-colors duration-300">
                      <Icon className="h-7 w-7" />
                    </div>
                  </div>
                  <CardTitle dir="auto" className="text-center font-headline text-base">
                    {track.title}
                  </CardTitle>
                  <div className="flex flex-wrap justify-center gap-2">
                    {track.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="bg-accent/10 text-accent">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground" dir="auto">
                    {track.points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}


'use client';

import { Award, GraduationCap, Laptop } from 'lucide-react';
import { doc, getFirestore } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLang } from '@/components/i18n/lang';
import { useDoc, useMemoFirebase } from '@/firebase';
import { DEFAULT_FEATURES, sanitizeFeaturesConfig, type FeatureIconId } from '@/lib/landing-features';

const iconMap = {
  laptop: Laptop,
  graduationCap: GraduationCap,
  award: Award,
} as const satisfies Record<FeatureIconId, unknown>;

export default function Features() {
  const { lang } = useLang();

  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui } = useDoc<any>(settingsDocRef);
  const showFeatures = ui?.showFeatures !== false; // default: show

  if (!showFeatures) return null;

  const content = sanitizeFeaturesConfig(ui?.features?.[lang], DEFAULT_FEATURES[lang]);

  return (
    <section id="features" className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto">
          <h2 dir="auto" className="font-headline text-3xl md:text-4xl font-bold">
            {content.heading}
          </h2>
          <p dir="auto" className="mt-4 text-lg text-muted-foreground">
            {content.sub}
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {content.items.map((feature) => {
            const Icon = (iconMap[feature.icon] ?? Laptop) as any;
            return (
              <Card
                key={feature.id}
                className="text-center group hover:shadow-lg transition-shadow duration-300 border-t-4 border-accent bg-card/50"
              >
                <CardHeader>
                  <div className="mx-auto bg-accent/10 text-accent p-4 rounded-full w-fit group-hover:bg-accent group-hover:text-accent-foreground transition-colors duration-300">
                    <Icon className="h-10 w-10" />
                  </div>
                  <CardTitle dir="auto" className="font-headline mt-4">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p dir="auto" className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}


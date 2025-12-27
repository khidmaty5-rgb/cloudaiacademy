'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useLang } from '@/components/i18n/lang';
import { useDoc, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';
import { DEFAULT_FAQ, sanitizeFaqConfig } from '@/lib/landing-faq';

export default function Faq() {
  const { lang } = useLang();
  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui } = useDoc<any>(settingsDocRef);

  const showFaq = ui?.showFaq !== false; // default: show
  if (!showFaq) return null;

  const config = sanitizeFaqConfig(ui?.faq?.[lang], DEFAULT_FAQ[lang]);
  const faqs = config.items.length > 0 ? config.items : DEFAULT_FAQ[lang].items;

  return (
    <section id="faq" className="py-20 md:py-28 bg-muted/50">
      <div className="container max-w-3xl">
        <div className="text-center">
          <h2 className="font-headline text-3xl md:text-4xl font-bold">
            {config.heading}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {config.sub}
          </p>
        </div>
        <Accordion type="single" collapsible className="w-full mt-12">
          {faqs.map((faq) => (
            <AccordionItem
              key={faq.id}
              value={faq.id}
              className="border-l-4 border-accent bg-background px-4 rounded-lg mb-2 shadow-sm"
            >
              <AccordionTrigger dir="auto" className="text-lg text-start hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent dir="auto" className="text-muted-foreground text-base">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}


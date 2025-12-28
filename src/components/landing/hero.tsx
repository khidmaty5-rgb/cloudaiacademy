'use client';

import { Button } from '@/components/ui/button';
import { useDoc, useMemoFirebase, useUser } from '@/firebase';
import Link from 'next/link';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useLang } from '@/components/i18n/lang';
import { CheckCircle2, QrCode, Sparkles } from 'lucide-react';
import { doc, getFirestore } from 'firebase/firestore';
import { DEFAULT_HERO, sanitizeHeroConfig } from '@/lib/landing-hero';

export default function Hero() {
  const { user, isUserLoading } = useUser();
  const { lang, dir } = useLang();
  const isRTL = dir === 'rtl';
  const textAlign = isRTL ? 'lg:text-right' : 'lg:text-left';
  const textOrder = isRTL ? 'lg:order-2' : 'lg:order-1';
  const imageOrder = isRTL ? 'lg:order-1' : 'lg:order-2';

  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero-background');
  const browserImage = PlaceHolderImages.find((img) => img.id === 'hero-browser');

  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui } = useDoc<any>(settingsDocRef);

  const showHero = ui?.showHero !== false; // default: show
  if (!showHero) return null;

  const content = sanitizeHeroConfig(ui?.hero?.[lang], DEFAULT_HERO[lang]);

  return (
    <section className="relative bg-primary text-primary-foreground py-20 md:py-32">
      {heroImage && (
        <Image
          src={heroImage.imageUrl}
          alt={heroImage.description}
          fill
          className="object-cover -z-20 opacity-10 blur-2xl scale-110"
          data-ai-hint={heroImage.imageHint}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-orange-900/80 -z-10" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--accent)/0.22),transparent_45%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_30%,hsl(var(--chart-3)/0.18),transparent_55%)]" />

      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <svg
          className="absolute left-[max(50%,25rem)] top-0 h-full w-full -translate-x-1/2 stroke-gray-200/20 [mask-image:radial-gradient(64rem_64rem_at_top,white,transparent)]"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="e813992c-7d03-4cc4-a2bd-151760b470a0"
              width={200}
              height={200}
              x="50%"
              y={-1}
              patternUnits="userSpaceOnUse"
            >
              <path d="M100 200V.5M.5 .5H200" fill="none" />
            </pattern>
          </defs>
          <svg x="50%" y={-1} className="overflow-visible fill-gray-500/10">
            <path
              d="M-100.5 0h201v201h-201Z M699.5 0h201v201h-201Z M499.5 400h201v201h-201Z M-300.5 600h201v201h-201Z"
              strokeWidth={0}
            />
          </svg>
          <rect width="100%" height="100%" strokeWidth={0} fill="url(#e813992c-7d03-4cc4-a2bd-151760b470a0)" />
        </svg>
      </div>

      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className={`text-center ${textAlign} ${textOrder}`}>
            <div
              className={`mx-auto lg:mx-0 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-sm text-primary-foreground/90 backdrop-blur-sm ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Sparkles className="h-4 w-4 text-accent" />
              <span dir="auto">{content.badge}</span>
            </div>

            <h1
              dir="auto"
              className="mt-5 font-headline text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]"
            >
              {content.title}
            </h1>

            <p dir="auto" className="mt-6 text-lg md:text-xl text-primary-foreground/80 max-w-xl mx-auto lg:mx-0">
              {content.desc}
            </p>

            {content.highlights.length > 0 && (
              <ul
                className={`mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-primary-foreground/80 justify-center ${isRTL ? 'lg:justify-end' : 'lg:justify-start'}`}
              >
                {content.highlights.map((item) => (
                  <li
                    key={item}
                    className={`inline-flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span dir="auto">{item}</span>
                  </li>
                ))}
              </ul>
            )}

            <div
              className={`mt-10 flex flex-col sm:flex-row justify-center ${isRTL ? 'lg:justify-end' : 'lg:justify-start'} gap-4`}
            >
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/courses">{content.explore}</Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-accent/40 bg-accent/10 text-primary-foreground hover:bg-accent/15 hover:text-primary-foreground"
              >
                <Link href="/print/qr" className={isRTL ? 'flex-row-reverse' : ''}>
                  <QrCode className="h-4 w-4" />
                  <span dir="auto">{lang === 'ar' ? '\u0637\u0628\u0627\u0639\u0629 QR' : 'Print QR'}</span>
                </Link>
              </Button>

              {isUserLoading ? (
                <div className="h-11 w-44 animate-pulse rounded-md bg-white/20" />
              ) : user ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
                >
                  <Link href="/dashboard">{content.dashboard}</Link>
                </Button>
              ) : (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
                >
                  <Link href="/signup">{content.trial}</Link>
                </Button>
              )}
            </div>

            {false && (
            <div className={`mt-4 ${isRTL ? 'lg:text-right' : 'lg:text-left'} text-center`}>
              <Link
                href="/print/qr"
                className={`inline-flex items-center gap-2 text-sm text-primary-foreground/80 hover:text-accent hover:underline underline-offset-4 ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <QrCode className="h-4 w-4" />
                <span dir="auto">{lang === 'ar' ? 'طباعة ومشاركة QR' : 'Print & share QR'}</span>
              </Link>
            </div>
            )}
          </div>

          <div
            className={`relative mx-auto w-full max-w-[300px] sm:max-w-[360px] md:max-w-[420px] lg:max-w-[480px] ${imageOrder}`}
          >
            <div className="absolute -inset-10 rounded-[2.5rem] bg-gradient-to-br from-accent/35 via-chart-3/20 to-chart-1/20 blur-3xl opacity-70" />
            <div className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0" />
              <div className="relative h-full w-full overflow-hidden rounded-xl bg-white shadow-lg">
                <div className="absolute inset-6 pb-6 sm:inset-8 sm:pb-8">
                  <div className="relative h-full w-full">
                    {browserImage && (
                      <Image
                        src={browserImage.imageUrl}
                        alt={browserImage.description}
                        fill
                        sizes="(max-width: 1024px) 70vw, 520px"
                        className="object-contain object-center transition-transform duration-300 group-hover:scale-[1.02]"
                        priority
                        data-ai-hint={browserImage.imageHint}
                      />
                    )}
                  </div>
                </div>
              </div>
              <div
                className={`pointer-events-none absolute top-6 ${isRTL ? 'right-6' : 'left-6'} inline-flex items-center gap-2 rounded-full bg-primary/70 px-3 py-1 text-xs text-primary-foreground ring-1 ring-white/15 backdrop-blur-md ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span>CloudAI Academy</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

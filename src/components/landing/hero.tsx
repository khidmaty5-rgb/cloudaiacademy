'use client';

import { Button } from '@/components/ui/button';
import { useDoc, useMemoFirebase, useUser } from '@/firebase';
import Link from 'next/link';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useLang } from '@/components/i18n/lang';
import { CheckCircle2, FlaskConical, QrCode, Sparkles } from 'lucide-react';
import { doc, getFirestore } from 'firebase/firestore';
import { DEFAULT_HERO, sanitizeHeroConfig } from '@/lib/landing-hero';

export default function Hero() {
  const { user, isUserLoading } = useUser();
  const { lang, dir } = useLang();
  const isRTL = dir === 'rtl';
  const textAlign = isRTL ? 'md:text-right' : 'md:text-left';
  const textOrder = isRTL ? 'md:order-2' : 'md:order-1';
  const imageOrder = isRTL ? 'md:order-1' : 'md:order-2';

  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero-background');
  const browserImage = PlaceHolderImages.find((img) => img.id === 'hero-browser');

  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui } = useDoc<any>(settingsDocRef);

  const showHero = ui?.showHero !== false; // default: show
  if (!showHero) return null;

  const content = sanitizeHeroConfig(ui?.hero?.[lang], DEFAULT_HERO[lang]);

  return (
    <section className="relative overflow-hidden bg-primary py-14 text-primary-foreground sm:py-16 lg:py-24">
      {heroImage && (
        <Image
          src={heroImage.imageUrl}
          alt={heroImage.description}
          fill
          className="-z-20 object-cover opacity-10 blur-2xl"
          data-ai-hint={heroImage.imageHint}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-orange-900/80 -z-10" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--accent)/0.22),transparent_45%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_30%,hsl(var(--chart-3)/0.18),transparent_55%)]" />

      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <svg
          className="absolute inset-0 h-full w-full stroke-gray-200/20 [mask-image:radial-gradient(64rem_64rem_at_top,white,transparent)]"
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
          <svg x="50%" y={-1} className="fill-gray-500/10">
            <path
              d="M-100.5 0h201v201h-201Z M699.5 0h201v201h-201Z M499.5 400h201v201h-201Z M-300.5 600h201v201h-201Z"
              strokeWidth={0}
            />
          </svg>
          <rect width="100%" height="100%" strokeWidth={0} fill="url(#e813992c-7d03-4cc4-a2bd-151760b470a0)" />
        </svg>
      </div>

      <div className="container relative">
        <div className="grid min-w-0 items-center gap-10 md:grid-cols-[minmax(0,1.08fr)_minmax(16rem,0.92fr)] xl:gap-16">
          <div className={`text-center ${textAlign} ${textOrder}`}>
            <div
                className={`mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-sm text-primary-foreground/90 backdrop-blur-sm md:mx-0 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Sparkles className="h-4 w-4 text-accent" />
              <span dir="auto">{content.badge}</span>
            </div>

            <h1
              dir="auto"
              className="mt-5 font-headline text-[clamp(2.25rem,5vw,4rem)] font-bold leading-[1.08] tracking-tight"
            >
              {content.title}
            </h1>

            <p dir="auto" className="mx-auto mt-6 max-w-xl text-lg text-primary-foreground/80 md:mx-0 md:text-xl">
              {content.desc}
            </p>

            {content.highlights.length > 0 && (
              <ul
                className={`mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-primary-foreground/80 ${isRTL ? 'md:justify-end' : 'md:justify-start'}`}
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

            <div className={`mt-9 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap ${isRTL ? 'md:justify-end' : 'md:justify-start'}`}>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/courses">{content.explore}</Link>
              </Button>

              {isUserLoading ? (
                <div className="h-11 w-40 animate-pulse rounded-md bg-white/15" />
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

            <div className={`mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-primary-foreground/75 ${isRTL ? 'md:justify-end' : 'md:justify-start'}`}>
              <Link
                href="/research"
                className={`inline-flex items-center gap-2 transition-colors hover:text-accent ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <FlaskConical className="h-4 w-4" />
                <span dir="auto">{lang === 'ar' ? 'استكشف الأبحاث' : 'Explore research'}</span>
              </Link>
              <Link
                href="/print/qr"
                className={`inline-flex items-center gap-2 transition-colors hover:text-accent ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <QrCode className="h-4 w-4" />
                <span dir="auto">{lang === 'ar' ? 'طباعة رمز QR ومشاركته' : 'Print and share the course QR'}</span>
              </Link>
            </div>
          </div>

          <div
            className={`relative mx-auto hidden w-full max-w-[300px] sm:block lg:max-w-[400px] ${imageOrder}`}
          >
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-accent/30 via-chart-3/15 to-chart-1/15 opacity-60 blur-3xl" />
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

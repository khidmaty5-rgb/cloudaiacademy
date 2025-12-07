'use client';

import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import Link from 'next/link';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useLang } from '@/components/i18n/lang';

export default function Hero() {
  const { user, isUserLoading } = useUser();
  const { lang } = useLang();
  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero-background');
  const browserImage = PlaceHolderImages.find((img) => img.id === 'hero-browser');
  const text = {
    en: {
      title: 'Unlock Your Potential in Cloud & AI',
      desc:
        "Join thousands of professionals advancing their careers with our industry-leading courses and hands-on projects.",
      explore: 'Explore Courses',
      dashboard: 'Go to Dashboard',
      trial: 'Free Trial',
    },
    ar: {
      title: 'أطلق إمكاناتك في السحابة والذكاء الاصطناعي',
      desc:
        'انضم إلى آلاف المهنيين الذين يطوّرون مسيرتهم عبر دوراتنا الرائدة ومشاريع تطبيقية.',
      explore: 'استكشف الدورات',
      dashboard: 'اذهب إلى لوحة التحكم',
      trial: 'تجربة مجانية',
    },
  } as const;

  return (
    <section className="relative bg-primary text-primary-foreground py-20 md:py-32">
      {heroImage && (
        <Image
          src={heroImage.imageUrl}
          alt={heroImage.description}
          fill
          className="object-cover -z-20"
          data-ai-hint={heroImage.imageHint}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-orange-900/80 -z-10" />

      <div
        className="absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
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
          <rect
            width="100%"
            height="100%"
            strokeWidth={0}
            fill="url(#e813992c-7d03-4cc4-a2bd-151760b470a0)"
          />
        </svg>
      </div>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className='text-center lg:text-left'>
                 <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tighter">
                    {text[lang].title}
                </h1>
                <p className="mt-6 text-lg md:text-xl text-primary-foreground/80 max-w-xl mx-auto lg:mx-0">
                    {text[lang].desc}
                </p>
                <div className="mt-10 flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
                    <Button
                        asChild
                        size="lg"
                        className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                        <Link href="/courses">{text[lang].explore}</Link>
                    </Button>
                    {isUserLoading ? (
                        <div className="h-11 w-40 animate-pulse rounded-md bg-white/20" />
                    ) : user ? (
                        <Button
                        asChild
                        size="lg"
                        variant="outline"
                        className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                        >
                        <Link href="/dashboard">{text[lang].dashboard}</Link>
                        </Button>
                    ) : (
                        <Button
                        asChild
                        size="lg"
                        variant="outline"
                        className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                        >
                        <Link href="/signup">{text[lang].trial}</Link>
                        </Button>
                    )}
                </div>
            </div>
           <div className="relative max-w-xs mx-auto lg:max-w-sm">
  {browserImage && (
    <Image
      src={browserImage.imageUrl}
      alt={browserImage.description}
      width={320}
      height={180}
      sizes="(max-width: 1024px) 70vw, 320px"
      className="w-full h-auto rounded-lg shadow-2xl"
      data-ai-hint={browserImage.imageHint}
    />
  )}
</div>

        </div>
      </div>
    </section>
  );
}

"use client";

import type { ComponentType } from 'react';
import { Logo } from '@/components/logo';
import {
  Twitter,
  Linkedin,
  Youtube,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/components/i18n/lang';
import { useDoc, useMemoFirebase } from '@/firebase';
import { doc, getFirestore } from 'firebase/firestore';

type IconComponent = ComponentType<{ className?: string }>;

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M22.675 0h-21.35C0.597 0 0 0.597 0 1.326v21.348C0 23.403 0.597 24 1.325 24h11.495v-9.294H9.691v-3.622h3.129V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463 0.099 2.795 0.143v3.24l-1.918 0.001c-1.504 0-1.795 0.715-1.795 1.763v2.313h3.587l-0.467 3.622h-3.12V24h6.116C23.403 24 24 23.403 24 22.675V1.326C24 0.597 23.403 0 22.675 0z"
      />
    </svg>
  );
}

export default function Footer() {
  const { lang } = useLang();
  const firestore = getFirestore();
  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'ui'), [firestore]);
  const { data: ui } = useDoc<any>(settingsDocRef);
  const showPricing = ui?.showPricing !== false; // default: show
  const showFaq = ui?.showFaq !== false; // default: show

  const socialLinks: Array<{ label: string; href: string; Icon: IconComponent }> = [
    { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61585817696624', Icon: FacebookIcon },
    { label: 'Twitter', href: '#', Icon: Twitter },
    { label: 'LinkedIn', href: '#', Icon: Linkedin },
    { label: 'YouTube', href: '#', Icon: Youtube },
  ];

  const t = {
    en: {
      tagline: 'An online learning platform for Cloud and AI courses.',
      quick: 'Quick Links',
      home: 'Home',
      courses: 'Courses',
      pricing: 'Pricing',
      testimonials: 'Testimonials',
      faq: 'FAQ',
      categories: 'Categories',
      catCloud: 'Cloud Computing',
      catAI: 'Artificial Intelligence',
      catML: 'Machine Learning',
      catDS: 'Data Science',
      catDevOps: 'DevOps',
      contact: 'Contact Us',
      rights: 'All rights reserved.',
    },
    ar: {
      tagline: 'منصة تعليمية عبر الإنترنت لدورات السحابة والذكاء الاصطناعي.',
      quick: 'روابط سريعة',
      home: 'الرئيسية',
      courses: 'الدورات',
      pricing: 'الأسعار',
      testimonials: 'قصص النجاح',
      faq: 'الأسئلة الشائعة',
      categories: 'الفئات',
      catCloud: 'الحوسبة السحابية',
      catAI: 'الذكاء الاصطناعي',
      catML: 'تعلّم الآلة',
      catDS: 'علم البيانات',
      catDevOps: 'عمليات التطوير (DevOps)',
      contact: 'تواصل معنا',
      rights: 'جميع الحقوق محفوظة.',
    },
  } as const;
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Logo textClassName="text-primary-foreground" />
            <p className="text-sm text-primary-foreground/70">
              {t[lang].tagline}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {socialLinks.map(({ label, href, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noreferrer noopener' : undefined}
                  onClick={(e) => {
                    if (href === '#') e.preventDefault();
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-primary-foreground/70 transition-colors hover:border-accent/40 hover:bg-accent/15 hover:text-accent"
                  aria-label={label}
                  title={label}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-headline text-lg font-semibold border-b-2 border-accent pb-2 inline-block">
              {t[lang].quick}
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].home}
                </Link>
              </li>
              <li>
                <Link
                  href="/courses"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].courses}
                </Link>
              </li>
              <li>
                <Link
                  href="/print/qr"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {lang === 'ar' ? 'طباعة QR' : 'Print QR'}
                </Link>
              </li>
              {showPricing && (
                <li>
                  <Link
                    href="#pricing"
                    className="text-primary-foreground/70 hover:text-accent"
                  >
                    {t[lang].pricing}
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href="#testimonials"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].testimonials}
                </Link>
              </li>
              {showFaq && (
                <li>
                  <Link
                    href="#faq"
                    className="text-primary-foreground/70 hover:text-accent"
                  >
                    {t[lang].faq}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-headline text-lg font-semibold border-b-2 border-accent pb-2 inline-block">
              {t[lang].categories}
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/courses"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].catCloud}
                </Link>
              </li>
              <li>
                <Link
                  href="/courses"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].catAI}
                </Link>
              </li>
              <li>
                <Link
                  href="/courses"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].catML}
                </Link>
              </li>
              <li>
                <Link
                  href="/courses"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].catDS}
                </Link>
              </li>
              <li>
                <Link
                  href="/courses"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].catDevOps}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-headline text-lg font-semibold border-b-2 border-accent pb-2 inline-block">
              {t[lang].contact}
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-2 text-primary-foreground/70">
                <Mail className="h-4 w-4" />{' '}
                <Link
                  href="mailto:info@cloudaiacademy.ca"
                  className="hover:text-accent"
                >
                  <bdi dir="ltr">info@cloudaiacademy.ca</bdi>
                </Link>
              </li>
              <li className="flex items-center gap-2 text-primary-foreground/70">
                <Phone className="h-4 w-4" />{' '}
                <Link href="tel:+15196942661" className="hover:text-accent">
                  <bdi dir="ltr">+1 (519) 694-2661</bdi>
                </Link>
              </li>
              <li className="flex items-center gap-2 text-primary-foreground/70">
                <MapPin className="h-4 w-4" />{' '}
                <Link
                  href="https://www.google.com/maps/search/?api=1&query=London%20Ontario%20Canada"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-accent"
                >
                  <bdi dir="ltr">London Ontario, CA</bdi>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-primary-foreground/20 pt-8 text-center text-sm text-primary-foreground/70">
          <p>
            &copy; <bdi dir="ltr">{new Date().getFullYear()} CloudAI Academy</bdi>. {t[lang].rights}
          </p>
        </div>
      </div>
    </footer>
  );
}

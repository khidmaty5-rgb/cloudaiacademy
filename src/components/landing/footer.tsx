"use client";

import { Logo } from '@/components/logo';
import {
  Twitter,
  Linkedin,
  Youtube,
  Github,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/components/i18n/lang';

export default function Footer() {
  const { lang } = useLang();
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
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Logo textClassName="text-primary-foreground" />
            <p className="text-sm text-primary-foreground/70">
              {t[lang].tagline}
            </p>
            <div className="flex space-x-4">
              <Link
                href="#"
                className="text-primary-foreground/70 hover:text-accent"
                aria-label="Twitter"
              >
                <Twitter className="text-accent hover:text-white" />
              </Link>
              <Link
                href="#"
                className="text-primary-foreground/70 hover:text-accent"
                aria-label="LinkedIn"
              >
                <Linkedin className="text-accent hover:text-white" />
              </Link>
              <Link
                href="#"
                className="text-primary-foreground/70 hover:text-accent"
                aria-label="YouTube"
              >
                <Youtube className="text-accent hover:text-white" />
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-headline text-lg font-semibold border-b-2 border-accent pb-2 inline-block">
              {t[lang].quick}
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="#"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].home}
                </Link>
              </li>
              <li>
                <Link
                  href="#courses"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].courses}
                </Link>
              </li>
              <li>
                <Link
                  href="#pricing"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].pricing}
                </Link>
              </li>
              <li>
                <Link
                  href="#testimonials"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].testimonials}
                </Link>
              </li>
              <li>
                <Link
                  href="#faq"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].faq}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-headline text-lg font-semibold border-b-2 border-accent pb-2 inline-block">
              {t[lang].categories}
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="#"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].catCloud}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].catAI}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].catML}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-primary-foreground/70 hover:text-accent"
                >
                  {t[lang].catDS}
                </Link>
              </li>
              <li>
                <Link
                  href="#"
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
                <Mail className="h-4 w-4" /> info@cloudai.academy
              </li>
              <li className="flex items-center gap-2 text-primary-foreground/70">
                <Phone className="h-4 w-4" /> +1 (519) 694-2661
              </li>
              <li className="flex items-center gap-2 text-primary-foreground/70">
                <MapPin className="h-4 w-4" /> London Ontario, CA
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-primary-foreground/20 pt-8 text-center text-sm text-primary-foreground/70">
          <p>
            &copy; {new Date().getFullYear()} CloudAI Academy. {t[lang].rights}
          </p>
        </div>
      </div>
    </footer>
  );
}

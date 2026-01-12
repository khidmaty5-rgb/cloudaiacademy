'use client';

import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';
import { Globe, Mail, Phone, Printer } from 'lucide-react';
import { Logo } from '@/components/logo';

const FALLBACK_SITE = 'https://www.cloudaiacademy.ca';
const FALLBACK_EMAIL = 'info@cloudaiacademy.ca';
const FALLBACK_PHONE = '+1 (519) 694-2661';

function normalizeSiteUrl(value: string) {
  const trimmed = (value || '').trim();
  if (!trimmed) return FALLBACK_SITE;
  return trimmed.replace(/\/+$/, '');
}

function normalizePhoneHref(value: string) {
  return (value || '').trim().replace(/[^\d+]/g, '');
}

export default function PrintableQrFlyerPage() {
  const { lang, dir } = useLang();
  const isRTL = dir === 'rtl';

  const site = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE);
  const email = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || FALLBACK_EMAIL).trim();
  const phone = (process.env.NEXT_PUBLIC_CONTACT_PHONE || FALLBACK_PHONE).trim();
  const phoneHref = normalizePhoneHref(phone);

  const printCopies = 10;

  const t = {
    en: {
      title: 'QR Business Cards',
      print: 'Print',
      org: 'CloudAI Academy',
      tagline: 'Cloud + AI courses, labs, and launch-phase research programs.',
      scan: 'Scan the QR to visit.',
      websiteLabel: 'Website',
      emailLabel: 'Email',
      phoneLabel: 'Phone',
    },
    ar: {
      title: 'بطاقات QR',
      print: 'طباعة',
      org: 'CloudAI Academy',
      tagline: 'دورات ومختبرات في السحابة والذكاء الاصطناعي + مبادرات بحثية (إطلاق).',
      scan: 'امسح رمز QR لزيارة الموقع.',
      websiteLabel: 'الموقع',
      emailLabel: 'البريد',
      phoneLabel: 'الهاتف',
    },
  }[lang];

  const BusinessCard = () => (
    <div
      className={[
        'qr-business-card grid w-full gap-4 overflow-hidden rounded-2xl border border-accent/20 border-t-4 border-t-accent bg-white shadow-sm',
        'grid-cols-[1fr_auto]',
      ].join(' ')}
      dir={dir}
    >
      <div className="flex min-w-0 flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Logo size={30} hideText />
          <div className="min-w-0">
            <div className="font-headline text-sm font-bold text-foreground">
              <bdi dir="ltr">{t.org}</bdi>
            </div>
            <div className="text-[10px] text-muted-foreground" dir="auto">
              {t.tagline}
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold leading-tight text-foreground">
            <Globe className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            <a href={site} target="_blank" rel="noreferrer noopener" className="hover:underline">
              <span className="sr-only">{t.websiteLabel}</span>
              <bdi dir="ltr">{site}</bdi>
            </a>
          </div>

          <div className="flex items-center gap-2 text-[10px] leading-tight text-muted-foreground">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            <a href={`mailto:${email}`} className="hover:underline">
              <span className="sr-only">{t.emailLabel}</span>
              <bdi dir="ltr">{email}</bdi>
            </a>
          </div>

          <div className="flex items-center gap-2 text-[10px] leading-tight text-muted-foreground">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            <a href={`tel:${phoneHref}`} className="hover:underline">
              <span className="sr-only">{t.phoneLabel}</span>
              <bdi dir="ltr">{phone}</bdi>
            </a>
          </div>

          <div className="text-[10px] leading-tight text-muted-foreground" dir="auto">
            {t.scan}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-4">
        <div className="qr-business-card__qr rounded-lg border bg-white p-2">
          <QRCode
            value={site}
            style={{ height: '100%', width: '100%' }}
            viewBox="0 0 256 256"
            title={site}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40 py-8 pb-28 print:bg-white print:py-0 print:pb-0 md:pb-8">
      <style jsx global>{`
        @page {
          size: auto;
          margin: 0.25in;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html,
          body {
            height: 100%;
          }
          body {
            background: white !important;
            margin: 0 !important;
          }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(2, 3.5in);
            grid-auto-rows: 2in;
            gap: 0.1in;
            justify-content: center;
            align-content: start;
          }
          .qr-business-card {
            width: 3.5in !important;
            height: 2in !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: hidden;
            break-inside: avoid;
          }
          .qr-business-card__qr {
            width: 1.35in !important;
            height: 1.35in !important;
          }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 hidden max-w-5xl items-center justify-between gap-3 px-4 md:flex">
        <h1 className="font-headline text-lg font-semibold">{t.title}</h1>
        <Button
          onClick={() => window.print()}
          className={[
            'bg-accent hover:bg-accent/90 text-accent-foreground',
            isRTL ? 'flex-row-reverse gap-2' : 'gap-2',
          ].join(' ')}
        >
          <Printer className="h-4 w-4" />
          <span dir="auto">{t.print}</span>
        </Button>
      </div>

      <div className="no-print fixed bottom-4 left-4 right-4 z-50 md:hidden">
        <div className="mx-auto flex max-w-md rounded-2xl border bg-background/90 p-2 shadow-xl backdrop-blur">
          <Button
            onClick={() => window.print()}
            className={[
              'flex-1 bg-accent hover:bg-accent/90 text-accent-foreground',
              isRTL ? 'flex-row-reverse gap-2' : 'gap-2',
            ].join(' ')}
          >
            <Printer className="h-4 w-4" />
            <span dir="auto">{t.print}</span>
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 print:hidden">
        <BusinessCard />
      </div>

      <div className="hidden print:block">
        <div className="print-grid">
          {Array.from({ length: printCopies }).map((_, idx) => (
            <BusinessCard key={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

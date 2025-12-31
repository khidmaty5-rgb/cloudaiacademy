'use client';

import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';
import { Printer } from 'lucide-react';
import { Logo } from '@/components/logo';

const FALLBACK_SITE = 'https://www.cloudaiacademy.ca';

function normalizeSiteUrl(value: string) {
  const trimmed = (value || '').trim();
  if (!trimmed) return FALLBACK_SITE;
  return trimmed.replace(/\/+$/, '');
}

export default function PrintableQrFlyerPage() {
  const { lang, dir } = useLang();
  const isRTL = dir === 'rtl';

  const site = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE);
  const printCopies = 10;

  const t = {
    en: {
      title: 'Printable QR Flyer',
      print: 'Print',
      share: 'Share',
      openSite: 'Open website',
      hint: 'Scan the QR code to visit:',
      copied: 'Link copied',
      alt: 'CloudAI Academy flyer background',
    },
    ar: {
      title: 'صفحة QR للطباعة',
      print: 'طباعة',
      share: 'مشاركة',
      openSite: 'فتح الموقع',
      hint: 'امسح رمز الاستجابة السريعة لزيارة:',
      copied: 'تم نسخ الرابط',
      alt: 'خلفية ملصق CloudAI Academy',
    },
  }[lang];

  const PrintCard = () => (
    <div
      className={[
        'qr-business-card grid w-full gap-4 overflow-hidden rounded-2xl border bg-white shadow-sm',
        isRTL ? 'grid-cols-[auto_1fr]' : 'grid-cols-[1fr_auto]',
      ].join(' ')}
      dir={dir}
    >
      <div className="flex min-w-0 flex-col justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Logo size={30} hideText />
          <div className="min-w-0">
            <div className="truncate font-headline text-sm font-bold text-foreground">
              CloudAI Academy
            </div>
            <div className="text-[10px] text-muted-foreground" dir="auto">
              {t.hint}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-semibold leading-tight text-foreground">
            <bdi dir="ltr">{site}</bdi>
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
        <div
          className={[
            'qr-business-card grid w-full gap-4 overflow-hidden rounded-2xl border bg-white shadow-sm',
            isRTL ? 'grid-cols-[auto_1fr]' : 'grid-cols-[1fr_auto]',
          ].join(' ')}
          dir={dir}
        >
          <div className="flex min-w-0 flex-col justify-between gap-3 p-4">
            <div className="flex items-center gap-2">
              <Logo size={30} hideText />
              <div className="min-w-0">
                <div className="truncate font-headline text-sm font-bold text-foreground">
                  CloudAI Academy
                </div>
                <div className="text-[10px] text-muted-foreground" dir="auto">
                  {t.hint}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-semibold leading-tight text-foreground">
                <bdi dir="ltr">{site}</bdi>
              </div>
              <div className="text-[10px] leading-tight text-muted-foreground" dir="auto">
                {lang === 'ar' ? 'امسح رمز الاستجابة السريعة.' : 'Scan the QR code.'}
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
      </div>

      <div className="hidden print:block">
        <div className="print-grid">
          {Array.from({ length: printCopies }).map((_, idx) => (
            <PrintCard key={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

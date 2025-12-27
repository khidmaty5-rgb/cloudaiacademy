'use client';

import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { useLang } from '@/components/i18n/lang';
import { useToast } from '@/hooks/use-toast';

const FALLBACK_SITE = 'https://www.cloudaiacademy.ca';

function normalizeSiteUrl(value: string) {
  const trimmed = (value || '').trim();
  if (!trimmed) return FALLBACK_SITE;
  return trimmed.replace(/\/+$/, '');
}

export default function PrintableQrFlyerPage() {
  const { lang, dir } = useLang();
  const isRTL = dir === 'rtl';
  const { toast } = useToast();

  const site = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE);
  const flyerUrl = `${site}/print/qr`;

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

  const handleShare = async () => {
    const shareData = {
      title: 'CloudAI Academy',
      text: flyerUrl,
      url: flyerUrl,
    };

    try {
      if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
        await (navigator as any).share(shareData);
        return;
      }
    } catch (e: any) {
      // Ignore user-cancelled shares
      if (e?.name === 'AbortError') return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(flyerUrl);
        toast({ title: t.copied });
        return;
      }
    } catch {}

    if (typeof window !== 'undefined') {
      window.prompt('Copy this link:', flyerUrl);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 py-8 print:bg-white print:py-0">
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-5xl items-center justify-between gap-3 px-4">
        <h1 className="font-headline text-lg font-semibold">{t.title}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void handleShare()}>
            {t.share}
          </Button>
          <Button variant="outline" asChild>
            <Link href={site} target="_blank" rel="noreferrer noopener">
              {t.openSite}
            </Link>
          </Button>
          <Button onClick={() => window.print()}>{t.print}</Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 print:max-w-none print:px-0">
        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="relative w-full bg-black" style={{ aspectRatio: '1655/751' }}>
            <Image
              src="/images/QR.png"
              alt={t.alt}
              fill
              priority
              className="object-contain"
              sizes="100vw"
            />

            <div
              className={[
                'absolute bottom-4 z-10 w-[190px] rounded-xl border bg-white/95 p-3 shadow-lg',
                isRTL ? 'left-4' : 'right-4',
              ].join(' ')}
            >
              <div className="grid place-items-center rounded-lg bg-white p-2">
                <QRCode
                  value={site}
                  size={150}
                  style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  viewBox="0 0 256 256"
                  title={site}
                />
              </div>
              <p dir="auto" className="mt-2 text-center text-xs text-muted-foreground">
                {t.hint}
              </p>
              <p className="mt-1 text-center text-[11px] font-semibold text-foreground">
                <bdi dir="ltr">{site}</bdi>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

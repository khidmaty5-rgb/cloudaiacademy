import { academy } from '@/lib/academy';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk, Cairo } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { LangProvider } from '@/components/i18n/lang';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: academy.name,
  description: academy.description,
  metadataBase: new URL(academy.siteUrl),
};

const arabic = Cairo({ subsets: ['arabic'], display: 'swap', variable: '--font-arabic' });

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props;
  return (
    <html
      lang={academy.defaultLanguage}
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${arabic.variable}`}
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var s=localStorage.getItem('theme');var d=s? s==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; if(d) document.documentElement.classList.add('dark');}catch(e){}})();`}
        </Script>
        <Script id="lang-dir-init" strategy="beforeInteractive">
          {`(function(){try{var l=localStorage.getItem('appLang')||${JSON.stringify(academy.defaultLanguage)}; if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl';} else {document.documentElement.lang='en';document.documentElement.dir='ltr';}}catch(e){}})();`}
        </Script>
      </head>
      <body className="antialiased">
        <style>{`:root { --accent: ${academy.accentLight}; } .dark { --accent: ${academy.accentDark}; }`}</style>
        <FirebaseClientProvider>
          <LangProvider>
            {children}
            <Toaster />
          </LangProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}

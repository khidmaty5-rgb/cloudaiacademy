import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
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
  title: 'CloudAI Academy',
  description: 'Unlock Your Potential in Cloud & AI.',
};

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var s=localStorage.getItem('theme');var d=s? s==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; if(d) document.documentElement.classList.add('dark');}catch(e){}})();`}
        </Script>
      </head>
      <body className="antialiased">
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

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type Lang = 'en' | 'ar';

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  dir: 'ltr' | 'rtl';
};

const LangContext = createContext<LangContextValue | undefined>(undefined);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');

  // Load saved preference
  useEffect(() => {
    try {
      const saved =
        typeof window !== 'undefined'
          ? (localStorage.getItem('appLang') as Lang | null)
          : null;
      if (saved === 'en' || saved === 'ar') setLang(saved);
    } catch {
      // ignore
    }
  }, []);

  // Persist preference
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('appLang', lang);
      }
    } catch {
      // ignore
    }
  }, [lang]);

  // Apply language + direction globally so layouts don't need to manually set `dir`.
  useEffect(() => {
    try {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      }
    } catch {
      // ignore
    }
  }, [lang]);

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, dir: lang === 'ar' ? 'rtl' : 'ltr' }),
    [lang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within a LangProvider');
  return ctx;
}

export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={`inline-flex h-9 items-center gap-1 rounded-full border border-primary-foreground/10 bg-primary-foreground/5 p-1 ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        className={`h-7 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
          lang === 'en'
            ? 'bg-accent text-accent-foreground shadow-sm'
            : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLang('ar')}
        aria-pressed={lang === 'ar'}
        className={`h-7 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
          lang === 'ar'
            ? 'bg-accent text-accent-foreground shadow-sm'
            : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground'
        }`}
      >
        العربية
      </button>
    </div>
  );
}

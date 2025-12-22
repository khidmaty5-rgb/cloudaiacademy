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
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`rounded-full border px-2 py-1 text-xs font-medium transition ${
          lang === 'en'
            ? 'bg-accent text-accent-foreground border-accent'
            : 'bg-background text-foreground hover:bg-muted'
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLang('ar')}
        className={`rounded-full border px-2 py-1 text-xs font-medium transition ${
          lang === 'ar'
            ? 'bg-accent text-accent-foreground border-accent'
            : 'bg-background text-foreground hover:bg-muted'
        }`}
      >
        العربية
      </button>
    </div>
  );
}

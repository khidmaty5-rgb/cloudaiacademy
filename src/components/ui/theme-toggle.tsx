"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useLang } from '@/components/i18n/lang';

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Props) {
  const { lang } = useLang();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      const prefersDark =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = stored ? stored === "dark" : prefersDark;
      setIsDark(dark);
    } catch {}
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    const root = document.documentElement;
    if (next) root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={lang === 'ar' ? (isDark ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن') : (isDark ? 'Use light theme' : 'Use dark theme')}
      className={className}
      onClick={toggle}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

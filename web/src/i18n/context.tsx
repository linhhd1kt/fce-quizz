'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { en } from './locales/en';
import type { Translations } from './locales/en';

// ── Registry ──────────────────────────────────────────────────────────────────
// Add new locales here. The en locale is always the fallback.
const LOCALE_REGISTRY: Record<string, () => Promise<{ default?: unknown; [key: string]: unknown }>> = {
  en: async () => ({ en }),
  vi: async () => import('./locales/vi'),
};

export const SUPPORTED_LOCALES: { code: string; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'vi', label: 'VI' },
];

// ── Deep merge ────────────────────────────────────────────────────────────────
function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key in override) {
    const v = override[key as keyof T];
    if (v === undefined || v === null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      result[key as keyof T] = deepMerge(
        base[key as keyof T] as object,
        v as object,
      ) as T[keyof T];
    } else {
      result[key as keyof T] = v as T[keyof T];
    }
  }
  return result;
}

// ── Interpolation ─────────────────────────────────────────────────────────────
export function i(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

// ── Context ───────────────────────────────────────────────────────────────────
interface I18nContextValue {
  locale: string;
  setLocale: (code: string) => void;
  msgs: Translations;
  i: typeof i;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  msgs: en,
  i,
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState('en');
  const [msgs, setMsgs] = useState<Translations>(en);

  // Load locale from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('locale') ?? 'en';
    if (stored !== 'en' && LOCALE_REGISTRY[stored]) {
      loadLocale(stored).then(setMsgs);
    }
    setLocaleState(stored);
  }, []);

  async function loadLocale(code: string): Promise<Translations> {
    if (code === 'en') return en;
    try {
      const mod = await LOCALE_REGISTRY[code]();
      const partial = (mod[code] ?? mod.default ?? {}) as Partial<Translations>;
      return deepMerge(en, partial);
    } catch {
      return en;
    }
  }

  const setLocale = useCallback(async (code: string) => {
    if (!LOCALE_REGISTRY[code]) return;
    const loaded = await loadLocale(code);
    setMsgs(loaded);
    setLocaleState(code);
    localStorage.setItem('locale', code);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, msgs, i }}>
      {children}
    </I18nContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useI18n() {
  return useContext(I18nContext);
}

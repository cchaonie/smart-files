import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Lang, I18nContextType, I18nStrings } from './types';
import { zhCN } from './zh-CN';
import { en } from './en';

const LANG_KEY = 'smart-files-lang';
const translations: Record<Lang, I18nStrings> = { 'zh-CN': zhCN, en };

export type I18nStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({
  children,
  storage,
}: {
  children: React.ReactNode;
  storage: I18nStorage;
}) {
  const [lang, setLangState] = useState<Lang>('zh-CN');

  useEffect(() => {
    const init = async () => {
      try {
        const saved = await storage.getItem(LANG_KEY);
        if (saved === 'en' || saved === 'zh-CN') setLangState(saved);
      } catch { /* ignore */ }
    };
    init();
  }, [storage]);

  const setLang = useCallback(
    (l: Lang) => { setLangState(l); try { storage.setItem(LANG_KEY, l); } catch { /* ignore */ } },
    [storage],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}

export function tFormat(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}

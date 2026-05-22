import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { t as translate } from '../i18n';

const LangContext = createContext({ lang: 'ru', t: k => k });

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('hi_lang') || 'ru');

  useEffect(() => {
    const handler = e => {
      if (e.key === 'hi_lang' && e.newValue) setLang(e.newValue);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const t = useCallback((key, ...args) => translate(lang, key, ...args), [lang]);

  return (
    <LangContext.Provider value={{ lang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);

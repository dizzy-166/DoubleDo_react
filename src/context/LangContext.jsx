import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { t as translate } from '../i18n';

const LangContext = createContext({ lang: 'ru', setLang: () => {}, t: k => k });

function detectLang() {
  try {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const fromUrl = params.get('lang');
    if (fromUrl === 'ru' || fromUrl === 'en') {
      localStorage.setItem('hi_lang', fromUrl);
      return fromUrl;
    }
  } catch (_) {}
  return localStorage.getItem('hi_lang') || 'ru';
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);

  const setLang = useCallback((next) => {
    if (next !== 'ru' && next !== 'en') return;
    localStorage.setItem('hi_lang', next);
    setLangState(next);
  }, []);

  useEffect(() => {
    const initial = detectLang();
    if (initial !== lang) setLangState(initial);

    const handler = e => {
      if (e.key === 'hi_lang' && (e.newValue === 'ru' || e.newValue === 'en')) {
        setLangState(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const t = useCallback((key, ...args) => translate(lang, key, ...args), [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);

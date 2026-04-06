/**
 * NutriOS Language Context
 *
 * Provides locale state and translation helper globally.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t as translate, Locale } from './i18n';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: async () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user_language').then((val) => {
      if (val && ['en', 'it', 'es', 'fr'].includes(val)) {
        setLocaleState(val as Locale);
      }
      setLoaded(true);
    });
  }, []);

  const setLocale = async (newLocale: Locale) => {
    setLocaleState(newLocale);
    await AsyncStorage.setItem('user_language', newLocale);
  };

  const t = (key: string) => translate(locale, key);

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

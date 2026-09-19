'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMe } from '@zal/api-client';
import { Locale } from '@zal/contracts';
import { INTL_LOCALES, createTranslator, type Translator } from '@zal/i18n';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translator;
  intlLocale: string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const COOKIE = 'zal_locale';

/**
 * Which language the page is in.
 *
 * Three sources, in order: the signed-in guest's saved preference, a cookie
 * from a previous visit, then Armenian. The cookie exists so a returning
 * visitor who is not signed in does not get a flash of Armenian before their
 * English preference loads — and it is a cookie rather than localStorage
 * because the server needs to read it to render the right `lang` attribute.
 */
export function LocaleProvider({
  children,
  initialLocale = Locale.hy,
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const { data: me } = useMe();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // A signed-in guest's stored preference wins over whatever the cookie said.
  useEffect(() => {
    if (me?.locale && me.locale !== locale) setLocaleState(me.locale);
    // Only react to the profile arriving, not to local switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.locale]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.cookie = `${COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: createTranslator(locale),
      intlLocale: INTL_LOCALES[locale],
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside a <LocaleProvider>');
  return context;
}

/** `const t = useT()` — then `t('Check availability')`. */
export function useT(): Translator {
  return useLocale().t;
}

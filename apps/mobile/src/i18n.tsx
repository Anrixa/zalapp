import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getLocales } from 'expo-localization';
import { useMe } from '@zal/api-client';
import { Locale } from '@zal/contracts';
import { INTL_LOCALES, createTranslator, resolveLocale, type Translator } from '@zal/i18n';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translator;
  intlLocale: string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Which language the app is in.
 *
 * The phone's own language setting is the first guess, because someone whose
 * device is in Russian almost certainly wants the app in Russian. A signed-in
 * guest's saved preference overrides it, since that is a deliberate choice
 * rather than an inference.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const [locale, setLocale] = useState<Locale>(() => resolveLocale(deviceLanguage()));

  useEffect(() => {
    if (me?.locale && me.locale !== locale) setLocale(me.locale);
    // React to the profile arriving, not to local switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: createTranslator(locale),
      intlLocale: INTL_LOCALES[locale],
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside a <LocaleProvider>');
  return context;
}

export function useT(): Translator {
  return useLocale().t;
}

function deviceLanguage(): string | null {
  try {
    return getLocales()[0]?.languageTag ?? null;
  } catch {
    // Reading device locale can fail in a bare test runner; Armenian is the
    // documented default and `resolveLocale` supplies it.
    return null;
  }
}

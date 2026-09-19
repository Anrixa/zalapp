import { Locale } from '@zal/contracts';
import hy from './locales/hy.json';
import ru from './locales/ru.json';

/**
 * Zal UI copy in Armenian, English and Russian.
 *
 * The dictionaries are extracted from the design hand-off pack vendored at
 * `design/screens/{en,hy,ru}` — all nineteen screens exist in all three
 * languages there, so this is the designer's own wording rather than a machine
 * translation of it. `pnpm --filter @zal/i18n extract` regenerates them from
 * that folder.
 *
 * Keys are the English strings themselves. That is unusual, and deliberate: it
 * keeps the source readable (`t('Check availability')` says what it renders),
 * it matches how the pack is organised, and a missing key degrades to English
 * rather than to `venue.detail.cta.primary`. The cost is that changing English
 * copy means changing a key, which the `missingKeys` helper below surfaces.
 *
 * Deliberately untranslated, in every locale:
 *   • venue names, host names and the brand name Zal
 *   • prices, phone numbers and booking references
 *   • the three language chips, which name themselves in their own script
 */
export const translations: Record<Locale, Record<string, string>> = {
  hy,
  ru,
  // English is the key space, so it needs no table.
  en: {},
};

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Build a translator for one locale.
 *
 * `{name}` placeholders are interpolated. Anything absent from the table falls
 * through to the key, which is the English string — a missing translation shows
 * English rather than a raw identifier or an empty space.
 */
export function createTranslator(locale: Locale): Translator {
  const table = translations[locale] ?? {};

  return (key, vars) => {
    const template = table[key] ?? key;
    if (!vars) return template;

    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

/** Locale names as each language writes its own — never translated. */
export const LOCALE_NAMES: Record<Locale, string> = {
  hy: 'Հայերեն',
  en: 'English',
  ru: 'Русский',
};

/** The BCP-47 tags `Intl` wants, for dates and numbers. */
export const INTL_LOCALES: Record<Locale, string> = {
  hy: 'hy-AM',
  en: 'en-US',
  ru: 'ru-RU',
};

/**
 * Pick a locale from an `Accept-Language` header or a device setting.
 *
 * Armenian is the default rather than English: the app is for the Armenian
 * market, and defaulting to English would be a small daily insult to most of
 * the people using it.
 */
export function resolveLocale(preferred: string | null | undefined): Locale {
  if (!preferred) return Locale.hy;

  for (const candidate of preferred.split(',')) {
    const tag = candidate.split(';')[0]?.trim().toLowerCase() ?? '';
    const base = tag.split('-')[0];
    if (base === 'hy' || base === 'en' || base === 'ru') return base as Locale;
  }
  return Locale.hy;
}

/**
 * Keys used in code that no locale table covers.
 *
 * Called by a test so a new English string added to a screen shows up as a
 * translation task instead of silently shipping English to Armenian guests.
 */
export function missingKeys(keys: string[], locale: Locale): string[] {
  const table = translations[locale] ?? {};
  return keys.filter((key) => !(key in table));
}

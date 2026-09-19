import { describe, expect, it } from 'vitest';
import { Locale } from '@zal/contracts';
import { INTL_LOCALES, LOCALE_NAMES, createTranslator, resolveLocale, translations } from './index';

describe('translations', () => {
  it('carries the designer copy for Armenian and Russian', () => {
    const hy = createTranslator(Locale.hy);
    const ru = createTranslator(Locale.ru);

    // Straight from design/screens/hy/VenueDetail.html and ru/VenueDetail.html.
    expect(hy('Check availability')).toBe('Ստուգել հասանելիությունը');
    expect(ru('Check availability')).toBe('Проверить доступность');
    expect(hy('Review & pay')).toBe('Վերանայել և վճարել');
    expect(ru('Booking confirmed')).toBe('Бронирование подтверждено');
  });

  it('falls back to the English key when a string is not translated', () => {
    const hy = createTranslator(Locale.hy);
    expect(hy('A string nobody has translated yet')).toBe('A string nobody has translated yet');
  });

  it('returns the key unchanged for English', () => {
    const en = createTranslator(Locale.en);
    expect(en('Check availability')).toBe('Check availability');
  });

  it('interpolates named placeholders', () => {
    const en = createTranslator(Locale.en);
    expect(en('Show {count} halls', { count: 28 })).toBe('Show 28 halls');
    // An unknown placeholder is left visible rather than blanked, so it is
    // obvious in review instead of shipping as a gap in a sentence.
    expect(en('Hello {who}', {})).toBe('Hello {who}');
  });

  it('keeps every key in both tables so a locale cannot go half-translated', () => {
    const hyKeys = Object.keys(translations.hy).sort();
    const ruKeys = Object.keys(translations.ru).sort();
    expect(hyKeys).toEqual(ruKeys);
    expect(hyKeys.length).toBeGreaterThan(150);
  });

  it('never translates a venue or brand name', () => {
    const forbidden = ['Dvin Hall', 'Zvartnots', 'Nairi', 'Marine K.'];
    for (const table of [translations.hy, translations.ru]) {
      for (const key of Object.keys(table)) {
        for (const noun of forbidden) {
          expect(key).not.toContain(noun);
        }
      }
    }
  });

  describe('resolveLocale', () => {
    it('defaults to Armenian, not English', () => {
      expect(resolveLocale(undefined)).toBe('hy');
      expect(resolveLocale('')).toBe('hy');
      expect(resolveLocale('de-DE,de;q=0.9')).toBe('hy');
    });

    it('reads an Accept-Language header in preference order', () => {
      expect(resolveLocale('ru-RU,ru;q=0.9,en;q=0.8')).toBe('ru');
      expect(resolveLocale('en-GB')).toBe('en');
      expect(resolveLocale('hy-AM,hy;q=0.9')).toBe('hy');
    });

    it('skips languages it does not have before falling back', () => {
      expect(resolveLocale('fr-FR,fr;q=0.9,ru;q=0.5')).toBe('ru');
    });
  });

  it('names each language in its own script', () => {
    expect(LOCALE_NAMES.hy).toBe('Հայերեն');
    expect(LOCALE_NAMES.ru).toBe('Русский');
    expect(LOCALE_NAMES.en).toBe('English');
  });

  it('maps to BCP-47 tags Intl understands', () => {
    for (const tag of Object.values(INTL_LOCALES)) {
      expect(() => new Intl.NumberFormat(tag).format(1000)).not.toThrow();
    }
  });
});

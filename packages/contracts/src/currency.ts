import { Currency, Locale } from './enums';

/**
 * Display currency.
 *
 * AMD is the settlement currency: prices are quoted, stored and charged in dram.
 * USD and EUR exist so a guest booking from abroad can sanity-check the size of
 * a number, and are marked as approximate everywhere they appear.
 *
 * The rates below are a development fallback. In production the API serves the
 * live table from `GET /config/currency-rates` and the clients pass it in.
 */
export type CurrencyRates = Record<Currency, number>;

/** Units of `currency` per 1 AMD. */
export const FALLBACK_RATES: CurrencyRates = {
  AMD: 1,
  USD: 1 / 385,
  EUR: 1 / 415,
};

const FRACTION_DIGITS: Record<Currency, number> = { AMD: 0, USD: 2, EUR: 2 };

const INTL_LOCALE: Record<Locale, string> = {
  hy: 'hy-AM',
  en: 'en-US',
  ru: 'ru-RU',
};

export function convertFromAmd(
  amountAmd: number,
  currency: Currency,
  rates: CurrencyRates = FALLBACK_RATES,
): number {
  const rate = rates[currency] ?? FALLBACK_RATES[currency];
  const converted = amountAmd * rate;
  return currency === Currency.AMD ? Math.round(converted) : Math.round(converted * 100) / 100;
}

/**
 * Format an AMD amount for display.
 *
 * Armenian and Russian both put the symbol after the number with a space, which
 * `Intl` already knows; passing the locale through rather than hand-rolling a
 * template is what keeps `504 000 ֏` and `504,000 ֏` each correct in their own
 * language.
 */
export function formatMoney(
  amountAmd: number,
  options: { currency?: Currency; locale?: Locale; rates?: CurrencyRates; compact?: boolean } = {},
): string {
  const {
    currency = Currency.AMD,
    locale = Locale.hy,
    rates = FALLBACK_RATES,
    compact = false,
  } = options;

  const value = convertFromAmd(amountAmd, currency, rates);

  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: compact ? 0 : FRACTION_DIGITS[currency],
    maximumFractionDigits: FRACTION_DIGITS[currency],
    notation: compact ? 'compact' : 'standard',
  }).format(value);
}

/** `420,000 AMD` — the plain form the venue cards use. */
export function formatAmdPlain(amountAmd: number, locale: Locale = Locale.en): string {
  return `${new Intl.NumberFormat(INTL_LOCALE[locale]).format(amountAmd)} AMD`;
}

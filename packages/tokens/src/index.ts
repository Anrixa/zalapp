/**
 * Zal design tokens.
 *
 * Taken from the Brand & UI kit artboard of the design canvas. Both clients
 * import these rather than each keeping their own copy of the hex values, which
 * is how the web app and the phone app stay the same colour after a brand tweak.
 *
 * The palette borrows two things Armenia is known for growing: pomegranate and
 * apricot. Ink on ivory carries everything else.
 */

export const colors = {
  /** Primary. Buttons the guest is meant to press, and the logo ground. */
  pomegranate: '#A32638',
  pomegranateDark: '#7E1D2B',
  pomegranateTint: '#F3DEDD',

  /** Secondary accent — highlights, ratings, the dot in the arch mark. */
  apricot: '#E8933A',
  apricotTint: '#FBE9CE',
  apricotDeep: '#CC7A26',

  /** Success. Confirmations and anything that has gone right. */
  sage: '#6E8368',
  sageDark: '#54683F',
  sageTint: '#E3EADF',

  /** Text and structure. */
  ink: '#241A18',
  inkSoft: '#6B5C56',
  inkMuted: '#A8998E',
  inkBody: '#4A3B37',

  /** Grounds. */
  ivory: '#FBF6EF',
  ivory2: '#F4EBDD',
  surface: '#FFFFFF',

  /** Lines and borders. */
  line: '#E7DACB',
  lineSoft: '#EFE5D8',
  lineStrong: '#D8CBBC',

  /** Alert. */
  rust: '#B23A2E',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Two families, each doing one job: Fraunces for anything that should feel
 * like an invitation, Plus Jakarta Sans for everything that has to be read
 * quickly.
 */
export const fonts = {
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
  body: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  /** Family names alone, for React Native where the stack is loaded, not declared. */
  displayFamily: 'Fraunces',
  bodyFamily: 'PlusJakartaSans',
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/** Sizes as they appear on the artboards, in px. */
export const fontSizes = {
  xs: 11,
  sm: 12,
  base: 13.5,
  md: 14.5,
  lg: 16,
  xl: 19,
  '2xl': 22,
  '3xl': 25,
  '4xl': 28,
  '5xl': 40,
} as const;

/**
 * Shape language from the kit:
 *   pill   — primary actions, and only those
 *   card   — cards, photos and sheets: things you look at
 *   input  — inputs and chips: one step softer than sharp
 */
export const radii = {
  input: 14,
  card: 20,
  sheet: 24,
  icon: 18,
  pill: 999,
} as const;

/** A 4px scale; the artboards use 24px as the standard screen gutter. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  gutter: 24,
  xl: 32,
  '2xl': 44,
} as const;

/** The one shadow in the system: under a primary button, tinted to match it. */
export const shadows = {
  primaryButton: {
    web: '0 8px 20px -8px rgba(163, 38, 56, 0.55)',
    native: {
      shadowColor: colors.pomegranate,
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  },
  card: {
    web: '0 1px 2px rgba(36, 26, 24, 0.04)',
    native: {
      shadowColor: colors.ink,
      shadowOpacity: 0.05,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
  },
} as const;

/** Anything a finger has to hit is at least this tall. */
export const MIN_TOUCH_TARGET = 44;

/** Per-category tinting for venue badges, matching the card component. */
export const venueTypeTone = {
  BANQUET_HALL: { bg: colors.pomegranateTint, fg: colors.pomegranateDark },
  RESTAURANT: { bg: colors.apricotTint, fg: '#8A5A16' },
  GARDEN: { bg: colors.sageTint, fg: colors.sageDark },
  ROOFTOP: { bg: colors.ivory2, fg: colors.inkSoft },
  CORPORATE: { bg: colors.pomegranateTint, fg: colors.pomegranateDark },
  OUTDOOR: { bg: colors.sageTint, fg: colors.sageDark },
} as const;

/** Booking status → the colour it is shown in, across both clients. */
export const bookingStatusTone = {
  DRAFT: { bg: colors.ivory2, fg: colors.inkSoft, label: 'Draft' },
  AWAITING_DEPOSIT: { bg: colors.apricotTint, fg: '#8A5A16', label: 'Deposit due' },
  PENDING_HOST: { bg: colors.apricotTint, fg: '#8A5A16', label: 'Awaiting host' },
  CONFIRMED: { bg: colors.sageTint, fg: colors.sageDark, label: 'Confirmed' },
  COMPLETED: { bg: colors.ivory2, fg: colors.inkSoft, label: 'Completed' },
  CANCELLED_BY_GUEST: { bg: colors.pomegranateTint, fg: colors.rust, label: 'Cancelled' },
  CANCELLED_BY_HOST: { bg: colors.pomegranateTint, fg: colors.rust, label: 'Cancelled' },
  DECLINED: { bg: colors.pomegranateTint, fg: colors.rust, label: 'Declined' },
  EXPIRED: { bg: colors.ivory2, fg: colors.inkMuted, label: 'Expired' },
} as const;

/** The Google Fonts stylesheet both clients load. */
export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

/** CSS custom properties, for the web app's `:root`. */
export function cssVariables(): string {
  const entries = Object.entries(colors).map(
    ([name, value]) => `  --zal-${kebab(name)}: ${value};`,
  );
  const radiusEntries = Object.entries(radii).map(
    ([name, value]) => `  --zal-radius-${kebab(name)}: ${value}px;`,
  );
  return [':root {', ...entries, ...radiusEntries, '}'].join('\n');
}

function kebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

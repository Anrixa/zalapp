/**
 * Zal design tokens.
 *
 * The values and the names come from the design hand-off pack vendored at
 * `design/design-tokens/` — `colors.json`, `typography.json` and `tokens.css`.
 * This module is the typed mirror of those files, so the web app and the phone
 * app import one definition rather than each keeping a copy of the hex values.
 *
 * Where a token is needed that the hand-off does not define (a pressed sage, a
 * softer body ink), it is marked as an extension rather than quietly folded in,
 * so a future sync against the pack can tell the two apart.
 *
 * The palette borrows two things Armenia is known for growing: pomegranate for
 * abundance and marriage, apricot for the country's namesake fruit. Deliberately
 * not the flag palette.
 */

export const colors = {
  /** Primary accent / primary CTA background. */
  pomegranate: '#A32638',
  /** Primary hover / pressed state. */
  pomegranateDark: '#7E1D2B',
  /** Light badge background in the pomegranate family. */
  pomegranateTint: '#F3DEDD',

  /** Secondary accent — ratings, highlights, price tags. */
  apricot: '#E8933A',
  /** Secondary hover / pressed state. */
  apricotDark: '#CC7A26',
  /** Light badge background in the apricot family. */
  apricotTint: '#FBE9CE',

  /** Success / confirmed state. */
  sage: '#6E8368',
  /** Success background. */
  sageTint: '#E3EADF',

  /** Destructive / alert / cancel. */
  rust: '#B23A2E',

  /** Primary text — warm near-black, never pure black. */
  ink: '#241A18',
  /** Secondary / caption text. */
  inkSoft: '#6B5C56',
  /** Placeholder / tertiary text. */
  inkMuted: '#A8998E',

  /** Page background (ground). */
  ivory: '#FBF6EF',
  /** Secondary surface — chips, icon buttons. */
  ivory2: '#F4EBDD',

  /** Borders, dividers, input outlines. */
  line: '#E7DACB',
  /** Card border, slightly softer than `line`. */
  cardLine: '#EFE5D8',
  /** Card / input fill. */
  white: '#FFFFFF',

  // ── Extensions beyond the hand-off ────────────────────────────────────────
  /** Pressed sage, used for the tick inside a success circle. */
  sageDark: '#54683F',
  /** Long-form body copy — one step warmer than `ink` at paragraph length. */
  inkBody: '#4A3B37',
  /** A stronger rule, for calendar grids and disabled days. */
  lineStrong: '#D8CBBC',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * CSS custom property names, exactly as `design/design-tokens/tokens.css`
 * spells them.
 *
 * Mapped explicitly rather than derived from the key, because `ivory2` becomes
 * `--zal-ivory-2` in the hand-off and a clever kebab-case function would get
 * that wrong — and then every rule written against the published name would
 * silently fall back to nothing.
 */
export const cssVarNames: Record<ColorToken, string> = {
  pomegranate: '--zal-pomegranate',
  pomegranateDark: '--zal-pomegranate-dark',
  pomegranateTint: '--zal-pomegranate-tint',
  apricot: '--zal-apricot',
  apricotDark: '--zal-apricot-dark',
  apricotTint: '--zal-apricot-tint',
  sage: '--zal-sage',
  sageTint: '--zal-sage-tint',
  rust: '--zal-rust',
  ink: '--zal-ink',
  inkSoft: '--zal-ink-soft',
  inkMuted: '--zal-ink-muted',
  ivory: '--zal-ivory',
  ivory2: '--zal-ivory-2',
  line: '--zal-line',
  cardLine: '--zal-card-line',
  white: '--zal-white',
  sageDark: '--zal-sage-dark',
  inkBody: '--zal-ink-body',
  lineStrong: '--zal-line-strong',
};

/**
 * Two families, each doing one job: Fraunces for anything that should feel
 * like an invitation, Plus Jakarta Sans for everything that has to be read
 * quickly. Never Inter, Roboto or Arial — the pack is explicit about this.
 */
export const fonts = {
  display: "'Fraunces', Georgia, serif",
  body: "'Plus Jakarta Sans', system-ui, sans-serif",
  /** Family names alone, for React Native where the font is loaded, not declared. */
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

/** The type scale from `typography.json`, resolved to single px values. */
export const fontSizes = {
  /** Brand kit hero line only. */
  displayXl: 56,
  /** Screen titles. */
  h1: 26,
  /** Section headings. */
  h2: 19,
  /** Paragraph copy. */
  body: 14.5,
  /** Form labels, eyebrow text. */
  label: 13,
  /** Button text. */
  button: 15.5,
  /** Meta text, badges, timestamps. */
  caption: 11.5,
} as const;

/**
 * The three-tier shape language.
 *
 * Pill is reserved for primary buttons, so the one shape a guest is meant to
 * press always reads differently from the shapes they are meant to look at.
 */
export const radii = {
  /** Primary buttons only. */
  pill: 999,
  /** Cards, photos, sheets. */
  card: 20,
  /** Inputs and chips. */
  input: 14,
  /** Category tiles and icon squares — an extension. */
  icon: 18,
  /** Bottom sheets — an extension. */
  sheet: 24,
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

/** Elevation, as `tokens.css` defines it, plus the React Native equivalents. */
export const shadows = {
  cta: {
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
    web: '0 8px 20px -8px rgba(36, 26, 24, 0.12)',
    native: {
      shadowColor: colors.ink,
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
  },
} as const;

/** Anything a finger has to hit is at least this tall. */
export const MIN_TOUCH_TARGET = 44;

/** Per-category tinting for venue badges, matching the venue-card component. */
export const venueTypeTone = {
  BANQUET_HALL: { bg: colors.pomegranateTint, fg: colors.pomegranateDark },
  RESTAURANT: { bg: colors.apricotTint, fg: '#8A5A16' },
  GARDEN: { bg: colors.sageTint, fg: colors.sageDark },
  ROOFTOP: { bg: colors.ivory2, fg: colors.inkSoft },
  CORPORATE: { bg: colors.pomegranateTint, fg: colors.pomegranateDark },
  OUTDOOR: { bg: colors.sageTint, fg: colors.sageDark },
} as const;

/**
 * Booking status → its colour and its English label.
 *
 * The labels match the My bookings screen; the localised forms live in
 * `@zal/i18n`, keyed by these same English strings.
 */
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

/** The Google Fonts stylesheet both clients load, as `typography.json` names it. */
export const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

/** The `:root` block for the web app — the same output as `tokens.css`. */
export function cssVariables(): string {
  const colorLines = (Object.keys(colors) as ColorToken[]).map(
    (token) => `  ${cssVarNames[token]}: ${colors[token]};`,
  );

  return [
    ':root {',
    ...colorLines,
    `  --zal-font-display: ${fonts.display};`,
    `  --zal-font-body: ${fonts.body};`,
    `  --zal-radius-pill: ${radii.pill}px;`,
    `  --zal-radius-card: ${radii.card}px;`,
    `  --zal-radius-input: ${radii.input}px;`,
    `  --zal-radius-icon: ${radii.icon}px;`,
    `  --zal-radius-sheet: ${radii.sheet}px;`,
    `  --zal-shadow-cta: ${shadows.cta.web};`,
    `  --zal-shadow-card: ${shadows.card.web};`,
    '}',
  ].join('\n');
}

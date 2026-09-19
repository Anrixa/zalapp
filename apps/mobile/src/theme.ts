import { Platform, StyleSheet } from 'react-native';
import { colors, fontSizes, radii, shadows, spacing, MIN_TOUCH_TARGET } from '@zal/tokens';

/**
 * The design tokens, in React Native's shapes.
 *
 * The values come from @zal/tokens — the same module the web app uses — so the
 * two platforms cannot drift apart. What this file adds is the translation:
 * shadows become `shadowOffset`/`elevation`, and the font families become the
 * names the app registers with `expo-font` rather than a CSS stack.
 */
export { colors, radii, spacing, fontSizes, MIN_TOUCH_TARGET };

/**
 * On a phone the display face is loaded as a font file, so it is named rather
 * than declared as a fallback stack. `Platform.select` keeps the system face as
 * a sane default if loading fails — a missing font should degrade to plain
 * text, not to invisible text.
 */
export const fonts = {
  display: Platform.select({ ios: 'Fraunces', android: 'Fraunces', default: 'serif' }) as string,
  body: Platform.select({
    ios: 'PlusJakartaSans',
    android: 'PlusJakartaSans',
    default: 'System',
  }) as string,
};

export const shadow = {
  cta: shadows.cta.native,
  card: shadows.card.native,
};

/** Styles repeated across nearly every screen. */
export const theme = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  section: {
    paddingHorizontal: spacing.gutter,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grow: {
    flex: 1,
  },

  h1: {
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: 19,
    fontWeight: '700',
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    color: colors.ink,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },

  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radii.card,
    padding: spacing.lg,
  },

  input: {
    minHeight: 48,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    borderRadius: radii.input,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 7,
  },
  fieldError: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.rust,
    marginTop: 6,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.base,
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  chipTextOn: {
    color: colors.ivory,
  },

  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.pill,
    backgroundColor: colors.ivory2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
  },

  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.cardLine,
    backgroundColor: colors.ivory,
  },
});

/** A stable gradient per venue, standing in for a photo that has not loaded. */
export function placeholderColor(seed: string): string {
  const palette = [colors.pomegranate, colors.apricotDark, colors.sage, colors.ink];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length]!;
}

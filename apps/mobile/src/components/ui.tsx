import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ZalApiError } from '@zal/api-client';
import { bookingStatusTone } from '@zal/tokens';
import type { BookingStatus } from '@zal/contracts';
import { colors, fonts, radii, shadow, spacing, theme, MIN_TOUCH_TARGET } from '../theme';
import { useT } from '../i18n';

/**
 * The shared controls.
 *
 * Everything that can be pressed is a `Pressable` with an accessibility role
 * and a hit target of at least 44pt, because a phone is used with a thumb, in a
 * hurry, often one-handed at a venue.
 */
export function Button({
  variant = 'primary',
  loading,
  title,
  icon,
  style,
  ...props
}: PressableProps & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  title: string;
  icon?: ReactNode;
}) {
  const disabled = Boolean(props.disabled) || Boolean(loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        buttonStyles.base,
        buttonStyles[variant],
        variant === 'primary' && shadow.cta,
        disabled && buttonStyles.disabled,
        pressed && !disabled && buttonStyles.pressed,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.ivory : colors.pomegranate} />
      ) : (
        <>
          {icon}
          <Text style={[buttonStyles.text, buttonStyles[`${variant}Text`]]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 24,
    borderRadius: radii.pill,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },

  primary: { backgroundColor: colors.pomegranate },
  secondary: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line },
  ghost: { backgroundColor: 'transparent', minHeight: MIN_TOUCH_TARGET },
  danger: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.pomegranateTint },

  text: { fontFamily: fonts.body, fontSize: 15.5, fontWeight: '600' },
  primaryText: { color: colors.ivory },
  secondaryText: { color: colors.ink },
  ghostText: { color: colors.pomegranate, fontWeight: '700' },
  dangerText: { color: colors.rust, fontWeight: '700' },
});

export function ScreenHeader({
  title,
  step,
  onBack,
  right,
}: {
  title: string;
  step?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const t = useT();
  const router = useRouter();

  return (
    <View style={[theme.row, { gap: 14, paddingHorizontal: spacing.gutter, paddingTop: 8 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Go back')}
        onPress={onBack ?? (() => router.back())}
        style={theme.iconButton}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={20} color={colors.ink} />
      </Pressable>

      <View style={theme.grow}>
        {step ? <Text style={theme.eyebrow}>{step}</Text> : null}
        <Text style={[theme.h1, { fontSize: 20 }]}>{title}</Text>
      </View>

      {right}
    </View>
  );
}

/**
 * One place that turns a thrown error into a sentence.
 *
 * A dropped connection on a phone is the common case, not the exception, so it
 * gets its own wording rather than the generic message.
 */
export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;

  let message = 'Something went wrong. Please try again.';
  if (error instanceof ZalApiError) {
    message = error.isNetwork ? 'No connection. Check your network and try again.' : error.message;
  } else if (error instanceof Error && error.message) {
    message = error.message;
  }

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.pomegranateTint,
        borderRadius: radii.input,
        padding: 14,
        marginBottom: spacing.base,
      }}
    >
      <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.pomegranateDark }}>
        {message}
      </Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const tone = bookingStatusTone[status];

  return (
    <View style={[theme.badge, { backgroundColor: tone.bg }]}>
      <Text style={[theme.badgeText, { color: tone.fg }]}>{tone.label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const letters =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => [...part][0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.pomegranate,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontWeight: '700',
          fontSize: size * 0.36,
          color: colors.ivory,
        }}
      >
        {letters}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <Text style={[theme.h2, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[theme.muted, { textAlign: 'center', marginTop: 8, lineHeight: 20 }]}>
        {body}
      </Text>
      {action ? <View style={{ marginTop: 20 }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={{ padding: 40, alignItems: 'center' }} accessibilityLabel={label}>
      <ActivityIndicator color={colors.pomegranate} />
    </View>
  );
}

/** A grey block standing in for content that has not arrived. */
export function Skeleton({ height, style }: { height: number; style?: ViewProps['style'] }) {
  return (
    <View
      accessibilityElementsHidden
      style={[{ height, backgroundColor: colors.ivory2, borderRadius: radii.card }, style]}
    />
  );
}

export function Money({ amountAmd, style }: { amountAmd: number; style?: TextProps['style'] }) {
  return (
    <Text style={[{ fontFamily: fonts.body, fontWeight: '800' }, style]}>
      {amountAmd.toLocaleString('en-US')} AMD
    </Text>
  );
}

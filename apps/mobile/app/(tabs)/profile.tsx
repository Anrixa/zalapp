import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLogout, useMe, useUpdateProfile } from '@zal/api-client';
import { Currency, Locale } from '@zal/contracts';
import { LOCALE_NAMES } from '@zal/i18n';
import { Avatar, Button, EmptyState, Loading } from '../../src/components/ui';
import { colors, fonts, spacing, theme } from '../../src/theme';
import { useLocale, useT } from '../../src/i18n';

export default function ProfileScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale, setLocale } = useLocale();

  const { data: me, isLoading } = useMe();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();

  if (isLoading) return <Loading />;

  if (!me) {
    return (
      <View style={[theme.screen, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title={t('Sign in to see your profile')}
          body={t('Your bookings, saved halls and payment methods live behind your account.')}
          action={<Button title={t('Log in')} onPress={() => router.push('/login')} />}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={theme.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40 }}
    >
      <View style={[theme.spread, theme.section]}>
        <Text style={theme.h1}>{t('Profile')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Settings')}
          onPress={() => router.push('/settings')}
          style={theme.iconButton}
        >
          <Ionicons name="settings-outline" size={19} color={colors.ink} />
        </Pressable>
      </View>

      <View style={[theme.row, theme.section, { gap: 16, paddingTop: 24 }]}>
        <Avatar name={me.fullName} size={72} />
        <View style={theme.grow}>
          <Text style={[theme.h2, { fontSize: 19 }]}>{me.fullName}</Text>
          <Text style={theme.muted}>{me.phone}</Text>
        </View>
      </View>

      <View style={[theme.row, theme.section, { gap: 12, paddingTop: 22 }]}>
        <Stat value={me.stats.bookings} label={t('Bookings')} />
        <Stat value={me.stats.saved} label={t('Saved')} />
        <Stat value={me.stats.reviews} label={t('Reviews')} />
      </View>

      <View style={{ marginTop: 16 }}>
        <Item
          icon="calendar-outline"
          label={t('My bookings')}
          onPress={() => router.push('/bookings')}
        />
        <Item
          icon="heart-outline"
          label={t('Saved venues')}
          onPress={() => router.push('/(tabs)/saved')}
        />
        <Item
          icon="card-outline"
          label={t('Payment methods')}
          onPress={() => router.push('/settings')}
        />
        <Item
          icon="notifications-outline"
          label={t('Notification preferences')}
          onPress={() => router.push('/settings')}
        />
      </View>

      <View style={[theme.section, { paddingTop: 22 }]}>
        <Text style={theme.eyebrow}>{t('Language')}</Text>
        <View style={[theme.row, { gap: 10, marginTop: 10 }]}>
          {(Object.keys(LOCALE_NAMES) as Locale[]).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: locale === option }}
              onPress={() => {
                setLocale(option);
                updateProfile.mutate({ locale: option });
              }}
              style={[theme.chip, locale === option && theme.chipOn]}
            >
              <Text style={[theme.chipText, locale === option && theme.chipTextOn]}>
                {LOCALE_NAMES[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[theme.section, { paddingTop: 22 }]}>
        <Text style={theme.eyebrow}>{t('Currency')}</Text>
        <View style={[theme.row, { gap: 10, marginTop: 10 }]}>
          {([Currency.AMD, Currency.USD, Currency.EUR] as const).map((currency) => (
            <Pressable
              key={currency}
              accessibilityRole="button"
              accessibilityState={{ selected: me.currency === currency }}
              onPress={() => updateProfile.mutate({ currency })}
              style={[theme.chip, me.currency === currency && theme.chipOn]}
            >
              <Text style={[theme.chipText, me.currency === currency && theme.chipTextOn]}>
                {currency}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[theme.section, { paddingTop: 26 }]}>
        <Button
          title={t('Log out')}
          variant="danger"
          loading={logout.isPending}
          onPress={() => logout.mutate(false, { onSuccess: () => router.replace('/login') })}
        />
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={[theme.card, theme.grow, { padding: 16, alignItems: 'center' }]}>
      <Text
        style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: '700', color: colors.ink }}
      >
        {value}
      </Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

function Item({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        theme.row,
        { gap: 14, paddingHorizontal: spacing.gutter, paddingVertical: 15, minHeight: 56 },
      ]}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: colors.ivory2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={19} color={colors.pomegranate} />
      </View>
      <Text style={[theme.grow, { fontFamily: fonts.body, fontWeight: '700', fontSize: 14.5 }]}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
    </Pressable>
  );
}

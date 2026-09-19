import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDiscover, useMe } from '@zal/api-client';
import type { VenueSummary } from '@zal/contracts';
import { VenueCard } from '../../src/components/venue-card';
import { Skeleton } from '../../src/components/ui';
import { colors, fonts, radii, spacing, theme } from '../../src/theme';
import { useT } from '../../src/i18n';

const CATEGORIES = [
  { type: 'BANQUET_HALL', label: 'Banquet', bg: colors.pomegranateTint, fg: colors.pomegranate },
  { type: 'RESTAURANT', label: 'Restaurant', bg: colors.apricotTint, fg: colors.apricotDark },
  { type: 'GARDEN', label: 'Garden', bg: colors.sageTint, fg: colors.sage },
  { type: 'ROOFTOP', label: 'Rooftop', bg: colors.ivory2, fg: colors.inkSoft },
  { type: 'CORPORATE', label: 'Corporate', bg: colors.pomegranateTint, fg: colors.pomegranate },
] as const;

export default function HomeScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const { data, isLoading, refetch, isRefetching } = useDiscover();

  return (
    <ScrollView
      style={theme.screen}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32 }}
      refreshControl={
        // Pull to refresh: on a phone this is how people ask "is this still
        // true?", and a booking app's answer changes minute to minute.
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.pomegranate}
        />
      }
    >
      <View style={[theme.spread, theme.section]}>
        <View>
          <Text style={theme.muted}>{t('Barev,')}</Text>
          <Text style={[theme.h1, { fontSize: 22 }]}>{me?.fullName ?? 'Zal'}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Notifications')}
          onPress={() => router.push('/(tabs)/notifications')}
          style={[
            theme.iconButton,
            { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cardLine },
          ]}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.ink} />
          {me?.unreadNotifications ? (
            <View
              style={{
                position: 'absolute',
                top: 9,
                right: 10,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.pomegranate,
                borderWidth: 1.5,
                borderColor: colors.white,
              }}
            />
          ) : null}
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="search"
        onPress={() => router.push('/(tabs)/search')}
        style={[
          theme.row,
          theme.section,
          {
            marginTop: spacing.lg,
            marginHorizontal: spacing.gutter,
            paddingHorizontal: 18,
            paddingVertical: 15,
            gap: 10,
            borderRadius: 16,
            backgroundColor: colors.white,
            borderWidth: 1.5,
            borderColor: colors.line,
          },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={colors.inkMuted} />
        <Text style={{ fontFamily: fonts.body, fontSize: 14.5, color: colors.inkMuted }}>
          {t('Search halls, restaurants, cities…')}
        </Text>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 18, paddingHorizontal: spacing.gutter, paddingTop: 22 }}
      >
        {CATEGORIES.map((category) => (
          <Pressable
            key={category.type}
            accessibilityRole="button"
            onPress={() => router.push(`/(tabs)/search?types=${category.type}`)}
            style={{ alignItems: 'center', gap: 8 }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radii.icon,
                backgroundColor: category.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="business-outline" size={24} color={category.fg} />
            </View>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 12,
                fontWeight: '700',
                color: colors.inkSoft,
              }}
            >
              {t(category.label)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {data?.promo ? (
        <View
          style={[
            theme.row,
            {
              margin: spacing.gutter,
              marginBottom: 0,
              padding: spacing.lg,
              borderRadius: radii.card,
              backgroundColor: colors.ink,
              gap: 14,
            },
          ]}
        >
          <View style={theme.grow}>
            <Text
              style={{
                color: colors.apricot,
                fontFamily: fonts.body,
                fontSize: 12,
                fontWeight: '800',
                letterSpacing: 0.6,
              }}
            >
              {t(data.promo.eyebrow).toUpperCase()}
            </Text>
            <Text
              style={{
                fontFamily: fonts.display,
                color: colors.ivory,
                fontSize: 18,
                marginTop: 6,
                lineHeight: 23,
              }}
            >
              {t(data.promo.title)}
            </Text>
          </View>
          <Ionicons name="business-outline" size={36} color={colors.apricot} />
        </View>
      ) : null}

      <Shelf title={t('Featured this week')} venues={data?.featured} loading={isLoading} />
      <Shelf title={t('Open this weekend')} venues={data?.openThisWeekend} loading={isLoading} />
      <Shelf title={t('New on Zal')} venues={data?.nearby} loading={isLoading} />
    </ScrollView>
  );
}

function Shelf({
  title,
  venues,
  loading,
}: {
  title: string;
  venues: VenueSummary[] | undefined;
  loading: boolean;
}) {
  const t = useT();

  // An empty shelf is hidden rather than shown as a blank strip: a heading with
  // nothing under it reads like a bug.
  if (!loading && (!venues || venues.length === 0)) return null;

  return (
    <View style={{ marginTop: 30 }}>
      <View style={[theme.spread, theme.section]}>
        <Text style={theme.h2}>{title}</Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 13,
            fontWeight: '700',
            color: colors.pomegranate,
          }}
        >
          {t('See all')}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingHorizontal: spacing.gutter, paddingTop: 14 }}
      >
        {loading
          ? [0, 1].map((index) => <Skeleton key={index} height={300} style={{ width: 300 }} />)
          : venues?.map((venue) => <VenueCard key={venue.id} venue={venue} width={300} />)}
      </ScrollView>
    </View>
  );
}

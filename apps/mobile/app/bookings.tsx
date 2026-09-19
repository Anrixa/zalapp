import { useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBookings } from '@zal/api-client';
import { BookingBucket } from '@zal/contracts';
import {
  Button,
  EmptyState,
  ErrorNote,
  Money,
  ScreenHeader,
  Skeleton,
  StatusBadge,
} from '../src/components/ui';
import { colors, placeholderColor, radii, spacing, theme } from '../src/theme';
import { useT } from '../src/i18n';

const TABS = [
  { bucket: BookingBucket.UPCOMING, label: 'Upcoming' },
  { bucket: BookingBucket.PAST, label: 'Past' },
  { bucket: BookingBucket.CANCELLED, label: 'Cancelled' },
] as const;

export default function BookingsScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bucket, setBucket] = useState<BookingBucket>(BookingBucket.UPCOMING);

  const { data, isLoading, error, refetch, isRefetching, fetchNextPage, hasNextPage } = useBookings(
    {
      bucket,
    },
  );
  const bookings = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <View style={[theme.screen, { paddingTop: insets.top + 8 }]}>
      <ScreenHeader title={t('My bookings')} />

      <View style={[theme.row, theme.section, { gap: 8, paddingTop: 16 }]}>
        {TABS.map((tab) => {
          const active = bucket === tab.bucket;
          return (
            <Pressable
              key={tab.bucket}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setBucket(tab.bucket)}
              style={[theme.chip, active && theme.chipOn]}
            >
              <Text style={[theme.chipText, active && theme.chipTextOn]}>{t(tab.label)}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(booking) => booking.id}
        contentContainerStyle={{
          gap: 14,
          paddingHorizontal: spacing.gutter,
          paddingTop: 18,
          paddingBottom: 32,
        }}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        onEndReached={() => {
          if (hasNextPage) void fetchNextPage();
        }}
        ListHeaderComponent={error ? <ErrorNote error={error} /> : null}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 14 }}>
              <Skeleton height={104} />
              <Skeleton height={104} />
            </View>
          ) : (
            <EmptyState
              title={t('Nothing booked yet')}
              body={t(
                'When you hold a date, it shows up here with the balance and the cancellation window.',
              )}
              action={
                <Button title={t('Search')} onPress={() => router.replace('/(tabs)/search')} />
              }
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/booking/[bookingId]', params: { bookingId: item.id } })
            }
            style={[theme.card, theme.row, { gap: 14 }]}
          >
            {item.venue.coverImage ? (
              <Image
                source={{ uri: item.venue.coverImage.url }}
                style={{ width: 64, height: 64, borderRadius: radii.input }}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radii.input,
                  backgroundColor: placeholderColor(item.venue.id),
                }}
              />
            )}

            <View style={theme.grow}>
              <StatusBadge status={item.status} />
              <Text style={[theme.h2, { fontSize: 16, marginTop: 4 }]}>{item.venue.name}</Text>
              <Text style={theme.muted}>
                {item.eventDate} · {item.guestCount} {t('guests')}
              </Text>
              <Money amountAmd={item.totalAmd} style={{ fontSize: 12.5, color: colors.inkMuted }} />
            </View>

            <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
          </Pressable>
        )}
      />
    </View>
  );
}

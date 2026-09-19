import { useEffect } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMarkNotificationsRead, useNotifications } from '@zal/api-client';
import type { Notification } from '@zal/contracts';
import { EmptyState, ErrorNote, Skeleton } from '../../src/components/ui';
import { colors, fonts, radii, spacing, theme } from '../../src/theme';
import { useT } from '../../src/i18n';

const TONE: Record<
  Notification['type'],
  { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }
> = {
  BOOKING_CONFIRMED: { icon: 'checkmark', bg: colors.sageTint, fg: colors.sageDark },
  BOOKING_DECLINED: { icon: 'close', bg: colors.pomegranateTint, fg: colors.rust },
  BOOKING_CANCELLED: { icon: 'close', bg: colors.pomegranateTint, fg: colors.rust },
  BALANCE_DUE: { icon: 'time-outline', bg: colors.apricotTint, fg: colors.apricotDark },
  PAYMENT_RECEIVED: { icon: 'checkmark', bg: colors.sageTint, fg: colors.sageDark },
  MESSAGE_RECEIVED: {
    icon: 'chatbubble-outline',
    bg: colors.pomegranateTint,
    fg: colors.pomegranate,
  },
  PRICE_DROP: { icon: 'trending-down', bg: colors.sageTint, fg: colors.sageDark },
  REVIEW_PUBLISHED: { icon: 'star-outline', bg: colors.ivory2, fg: colors.inkSoft },
  EVENT_REMINDER: { icon: 'time-outline', bg: colors.apricotTint, fg: colors.apricotDark },
};

export default function NotificationsScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, error, refetch, isRefetching, fetchNextPage, hasNextPage } =
    useNotifications();
  const markRead = useMarkNotificationsRead();

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];
  const unreadCount = notifications.filter((notification) => notification.readAt === null).length;

  // Opening the tab is the act of reading; the badge already said so.
  useEffect(() => {
    if (unreadCount > 0 && !markRead.isPending) markRead.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  return (
    <View style={[theme.screen, { paddingTop: insets.top + 12 }]}>
      <View style={[theme.spread, theme.section]}>
        <Text style={theme.h1}>{t('Notifications')}</Text>
        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => markRead.mutate(undefined)}
            hitSlop={8}
          >
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 13,
                fontWeight: '700',
                color: colors.pomegranate,
              }}
            >
              {t('Mark all read')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(notification) => notification.id}
        contentContainerStyle={{ paddingTop: 18, paddingBottom: 32 }}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        onEndReached={() => {
          if (hasNextPage) void fetchNextPage();
        }}
        ListHeaderComponent={
          error ? (
            <View style={theme.section}>
              <ErrorNote error={error} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={[theme.section, { gap: 10 }]}>
              <Skeleton height={72} />
              <Skeleton height={72} />
            </View>
          ) : (
            <EmptyState
              title={t('Nothing yet')}
              body={t('Confirmations, balance reminders and messages from hosts land here.')}
            />
          )
        }
        renderItem={({ item }) => {
          const tone = TONE[item.type];

          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (item.data.bookingId) router.push(`/booking/${item.data.bookingId}`);
                else if (item.data.venueId) router.push(`/venue/${item.data.venueId}`);
              }}
              style={[
                theme.row,
                {
                  gap: 12,
                  alignItems: 'flex-start',
                  paddingHorizontal: spacing.gutter,
                  paddingVertical: 14,
                  backgroundColor: item.readAt ? 'transparent' : '#FBF2E8',
                },
              ]}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: tone.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={tone.icon} size={20} color={tone.fg} />
              </View>

              <View style={theme.grow}>
                <Text style={[theme.body, { fontSize: 13.5, lineHeight: 19 }]}>
                  <Text style={{ fontWeight: '700' }}>{item.title}</Text> — {item.body}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 11.5,
                    color: colors.inkMuted,
                    marginTop: 4,
                  }}
                >
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>

              {!item.readAt ? (
                <View
                  accessibilityLabel="Unread"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radii.pill,
                    backgroundColor: colors.pomegranate,
                    marginTop: 6,
                  }}
                />
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

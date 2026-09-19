import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBooking, useBookingCalendarLinks, useCancelBooking } from '@zal/api-client';
import { SLOT_HOURS } from '@zal/contracts';
import {
  Avatar,
  Button,
  ErrorNote,
  Loading,
  Money,
  ScreenHeader,
  StatusBadge,
} from '../../../src/components/ui';
import { colors, fonts, radii, theme } from '../../../src/theme';
import { useT } from '../../../src/i18n';

export default function BookingDetailScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const { data: booking, isLoading } = useBooking(bookingId);
  const cancelBooking = useCancelBooking(bookingId);
  const calendarLinks = useBookingCalendarLinks();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  if (isLoading) return <Loading />;
  if (!booking) return null;

  const outstanding = booking.totalAmd - booking.paidAmd;
  const preview = booking.cancellationPreview;

  return (
    <View style={[theme.screen, { paddingTop: insets.top + 8 }]}>
      <ScreenHeader title={booking.venue.name} right={<StatusBadge status={booking.status} />} />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={[theme.section, { paddingTop: 16 }]}>
          <View style={[theme.row, { gap: 6 }]}>
            <Ionicons name="location-outline" size={14} color={colors.inkSoft} />
            <Text style={theme.muted}>
              {booking.venue.district}, {booking.venue.city}
            </Text>
          </View>

          <View
            style={[
              theme.card,
              { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
            ]}
          >
            <Fact label={t('DATE')} value={booking.eventDate} />
            <Fact
              label={t('TIME')}
              value={`${SLOT_HOURS[booking.slot].start}–${SLOT_HOURS[booking.slot].end}`}
            />
            <Fact label={t('GUESTS')} value={String(booking.guestCount)} />
            <Fact label={t('BOOKING REF')} value={booking.ref} />
          </View>

          <Text style={[theme.muted, { fontSize: 12.5, marginTop: 8 }]}>
            {t('Show this code at check-in')}
          </Text>
        </View>

        <View style={[theme.section, { paddingTop: 24 }]}>
          <Text style={theme.h2}>{t('Payment')}</Text>

          <View style={[theme.card, { marginTop: 12 }]}>
            {booking.quote.lines.map((line) => (
              <View key={line.key} style={[theme.spread, { marginBottom: 8 }]}>
                <Text style={theme.muted}>{t(line.label)}</Text>
                <Money amountAmd={line.amountAmd} style={{ fontSize: 13.5, fontWeight: '600' }} />
              </View>
            ))}

            <View
              style={[
                theme.spread,
                {
                  marginTop: 10,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.cardLine,
                },
              ]}
            >
              <Text style={{ fontFamily: fonts.body, fontWeight: '700', fontSize: 14.5 }}>
                {t('Total')}
              </Text>
              <Money amountAmd={booking.totalAmd} style={{ fontSize: 14.5 }} />
            </View>

            <View style={[theme.spread, { marginTop: 8 }]}>
              <Text style={theme.muted}>{t('Paid (deposit)')}</Text>
              <Text style={{ fontFamily: fonts.body, fontWeight: '700', fontSize: 13.5 }}>
                −{booking.paidAmd.toLocaleString('en-US')} AMD
              </Text>
            </View>

            {outstanding > 0 ? (
              <View
                style={[
                  theme.spread,
                  {
                    marginTop: 10,
                    padding: 14,
                    borderRadius: radii.input,
                    backgroundColor: colors.apricotTint,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: fonts.body,
                    fontWeight: '700',
                    fontSize: 13.5,
                    color: '#8A5A16',
                  }}
                >
                  {t('Balance due')} {booking.balanceDueOn}
                </Text>
                <Money amountAmd={outstanding} style={{ fontSize: 13.5, color: '#8A5A16' }} />
              </View>
            ) : null}
          </View>

          {outstanding > 0 && booking.status === 'CONFIRMED' ? (
            <Button
              title={`${t('Pay')} ${outstanding.toLocaleString('en-US')} AMD`}
              style={{ marginTop: 14 }}
              onPress={() =>
                router.push({
                  pathname: '/booking/[bookingId]/payment',
                  params: { bookingId: booking.id },
                })
              }
            />
          ) : null}
        </View>

        <View style={[theme.row, theme.section, { gap: 12, paddingTop: 24 }]}>
          <Avatar name={booking.host.displayName} size={48} />
          <Text style={[theme.grow, { fontFamily: fonts.body, fontWeight: '700', fontSize: 14 }]}>
            {t('Hosted by')} {booking.host.displayName}
          </Text>
        </View>

        <View style={[theme.section, { paddingTop: 24, gap: 12 }]}>
          <Button
            title={t('Get directions')}
            variant="secondary"
            icon={<Ionicons name="navigate-outline" size={17} color={colors.ink} />}
            onPress={() =>
              void Linking.openURL(
                `https://maps.google.com/?q=${encodeURIComponent(
                  `${booking.venue.name}, ${booking.venue.district}, ${booking.venue.city}`,
                )}`,
              )
            }
          />

          <Button
            title={t('Add to calendar')}
            variant="secondary"
            loading={calendarLinks.isPending}
            icon={<Ionicons name="calendar-outline" size={17} color={colors.ink} />}
            onPress={() =>
              calendarLinks.mutate(booking.id, {
                onSuccess: (links) => void Linking.openURL(links.google),
              })
            }
          />
        </View>

        {preview ? (
          <View style={[theme.section, { paddingTop: 24 }]}>
            <ErrorNote error={cancelBooking.error} />

            {!confirmingCancel ? (
              <Button
                title={t('Cancel this booking')}
                variant="danger"
                onPress={() => setConfirmingCancel(true)}
              />
            ) : (
              <View style={theme.card} accessibilityRole="alert">
                <Text style={[theme.h2, { fontSize: 16 }]}>{t('Cancel this booking')}?</Text>

                {/*
                  The refund is stated in money before the guest commits.
                  "The deposit is non-refundable" is not the same as being
                  shown the number you lose.
                */}
                <Text style={[theme.body, { marginTop: 8, lineHeight: 21, color: colors.inkBody }]}>
                  {preview.isFree
                    ? `${t('Free cancellation')} — ${preview.refundAmd.toLocaleString('en-US')} AMD ${t('comes back in full')}.`
                    : `${t('You would forfeit')} ${preview.forfeitedAmd.toLocaleString('en-US')} AMD ${t('and get back')} ${preview.refundAmd.toLocaleString('en-US')} AMD.`}
                </Text>

                <View style={[theme.row, { gap: 12, marginTop: 16 }]}>
                  <Button
                    title={t('Keep it')}
                    variant="secondary"
                    onPress={() => setConfirmingCancel(false)}
                  />
                  <Button
                    title={t('Cancel this booking')}
                    variant="danger"
                    style={theme.grow}
                    loading={cancelBooking.isPending}
                    onPress={() =>
                      cancelBooking.mutate({}, { onSuccess: () => setConfirmingCancel(false) })
                    }
                  />
                </View>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: '50%' }}>
      <Text style={theme.eyebrow}>{label}</Text>
      <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 15, marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

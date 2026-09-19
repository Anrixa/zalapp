import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateBooking, useQuote, useVenue } from '@zal/api-client';
import { EventType, TimeSlot, type QuoteRequestBody } from '@zal/contracts';
import { Button, ErrorNote, Money, ScreenHeader, Skeleton } from '../../../src/components/ui';
import { colors, fonts, radii, theme } from '../../../src/theme';
import { useT } from '../../../src/i18n';

/**
 * Step 2 of 3 — review and pay.
 *
 * The total comes from the server's quote endpoint, and the booking is created
 * with `expectedTotalAmd` so a price that moved while the guest was deciding is
 * refused rather than silently charged.
 */
export default function CheckoutScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    venueId: string;
    date: string;
    slot: TimeSlot;
    guests: string;
  }>();

  const venueId = params.venueId ?? '';
  const date = params.date ?? '';
  const slot = params.slot ?? TimeSlot.EVENING;
  const guests = Number(params.guests ?? 0);

  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [eventType, setEventType] = useState<EventType>(EventType.WEDDING);

  const { data: venue } = useVenue(venueId);
  const createBooking = useCreateBooking();

  const quoteInput = useMemo<QuoteRequestBody | null>(
    () => (date && guests > 0 ? { date, slot, guestCount: guests, addOnIds } : null),
    [date, slot, guests, addOnIds],
  );
  const { data: quote, isLoading: quoteLoading, error: quoteError } = useQuote(venueId, quoteInput);

  return (
    <View style={[theme.screen, { paddingTop: insets.top + 8 }]}>
      <ScreenHeader title={t('Review & pay')} step={t('STEP 2 OF 3')} />

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[theme.section, { paddingTop: 20 }]}>
          <View style={[theme.card, theme.spread]}>
            <View style={theme.grow}>
              <Text style={[theme.h2, { fontSize: 17 }]}>{venue?.name}</Text>
              <Text style={[theme.muted, { marginTop: 4 }]}>
                {date} · {t(slot === TimeSlot.AFTERNOON ? 'Afternoon' : 'Evening')} · {guests}{' '}
                {t('guests')}
              </Text>
            </View>
            <Button title={t('Edit details')} variant="ghost" onPress={() => router.back()} />
          </View>
        </View>

        <View style={[theme.section, { paddingTop: 24 }]}>
          <Text style={theme.h2}>{t('What are you celebrating?')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {(
              [
                [EventType.WEDDING, 'Wedding'],
                [EventType.BAPTISM, 'Baptism'],
                [EventType.BIRTHDAY, 'Birthday'],
                [EventType.ANNIVERSARY, 'Anniversary'],
                [EventType.CORPORATE, 'Corporate'],
                [EventType.OTHER, 'Other'],
              ] as const
            ).map(([value, label]) => {
              const active = eventType === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setEventType(value)}
                  style={[theme.chip, active && theme.chipOn]}
                >
                  <Text style={[theme.chipText, active && theme.chipTextOn]}>{t(label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {venue?.addOns.length ? (
          <View style={[theme.section, { paddingTop: 24 }]}>
            <Text style={theme.h2}>{t('Add anything else?')}</Text>

            <View style={{ gap: 10, marginTop: 12 }}>
              {venue.addOns.map((addOn) => {
                const checked = addOnIds.includes(addOn.id);

                return (
                  <Pressable
                    key={addOn.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    onPress={() =>
                      setAddOnIds((current) =>
                        checked ? current.filter((id) => id !== addOn.id) : [...current, addOn.id],
                      )
                    }
                    style={[
                      theme.card,
                      theme.row,
                      {
                        gap: 12,
                        padding: 14,
                        borderColor: checked ? colors.pomegranate : colors.cardLine,
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: checked ? colors.pomegranate : 'transparent',
                        borderWidth: checked ? 0 : 1.5,
                        borderColor: colors.line,
                      }}
                    >
                      {checked ? (
                        <Ionicons name="checkmark" size={13} color={colors.ivory} />
                      ) : null}
                    </View>

                    <View style={theme.grow}>
                      <Text style={{ fontFamily: fonts.body, fontWeight: '700', fontSize: 14 }}>
                        {t(addOn.name)}
                      </Text>
                      {addOn.description ? (
                        <Text style={[theme.muted, { fontSize: 12.5 }]}>
                          {t(addOn.description)}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 14 }}>
                      +{addOn.priceAmd.toLocaleString('en-US')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={[theme.section, { paddingTop: 24 }]}>
          <Text style={theme.h2}>{t('Price details')}</Text>

          {quoteLoading ? <Skeleton height={160} style={{ marginTop: 12 }} /> : null}
          {quoteError ? (
            <View style={{ marginTop: 12 }}>
              <ErrorNote error={quoteError} />
            </View>
          ) : null}

          {quote ? (
            <View style={[theme.card, { marginTop: 12 }]}>
              {quote.lines.map((line) => (
                <View key={line.key} style={[theme.spread, { marginBottom: 10 }]}>
                  <Text style={theme.muted}>{t(line.label)}</Text>
                  <Money amountAmd={line.amountAmd} style={{ fontSize: 14, fontWeight: '600' }} />
                </View>
              ))}

              <View
                style={[
                  theme.spread,
                  {
                    marginTop: 14,
                    paddingTop: 14,
                    borderTopWidth: 1,
                    borderTopColor: colors.cardLine,
                  },
                ]}
              >
                <Text style={{ fontFamily: fonts.body, fontWeight: '700', fontSize: 15 }}>
                  {t('Total')}
                </Text>
                <Money amountAmd={quote.totalAmd} style={{ fontSize: 15 }} />
              </View>

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
                    fontSize: 14,
                    color: '#8A5A16',
                  }}
                >
                  {t('Due today (20% deposit)')}
                </Text>
                <Money amountAmd={quote.depositAmd} style={{ fontSize: 14, color: '#8A5A16' }} />
              </View>

              <Text style={[theme.muted, { fontSize: 12.5, marginTop: 14, lineHeight: 18 }]}>
                {t(
                  'Free cancellation up to 14 days before your event. After that, the deposit is non-refundable.',
                )}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[theme.section, { paddingTop: 16 }]}>
          <ErrorNote error={createBooking.error} />
        </View>
      </ScrollView>

      <View style={[theme.stickyBar, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title={t('Continue to payment')}
          style={theme.grow}
          loading={createBooking.isPending}
          disabled={!quote || !quote.available}
          onPress={() => {
            if (!quote) return;

            createBooking.mutate(
              {
                venueId,
                date,
                slot,
                guestCount: guests,
                eventType,
                addOnIds,
                expectedTotalAmd: quote.totalAmd,
                // Survives a double tap on a slow connection.
                idempotencyKey: `${venueId}:${date}:${slot}:${guests}:${addOnIds.join(',')}`,
              },
              {
                onSuccess: (booking) =>
                  router.replace({
                    pathname: '/booking/[bookingId]/payment',
                    params: { bookingId: booking.id },
                  }),
              },
            );
          }}
        />
      </View>
    </View>
  );
}

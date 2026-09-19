import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBooking } from '@zal/api-client';
import { Button, Loading, Money } from '../../../src/components/ui';
import { colors, fonts, theme } from '../../../src/theme';
import { useT } from '../../../src/i18n';

export default function ConfirmedScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { data: booking, isLoading } = useBooking(bookingId);

  if (isLoading) return <Loading />;
  if (!booking) return null;

  return (
    <View style={[theme.screen, { paddingTop: insets.top }]}>
      <View style={[theme.grow, theme.section, { alignItems: 'center', justifyContent: 'center' }]}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: colors.sageTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={44} color={colors.sageDark} />
        </View>

        <Text style={[theme.h1, { fontSize: 27, marginTop: 22, textAlign: 'center' }]}>
          {t('Booking confirmed')}
        </Text>
        <Text style={[theme.muted, { marginTop: 8, textAlign: 'center', lineHeight: 21 }]}>
          {t('Your date at')} {booking.venue.name}{' '}
          {t('is locked in. A confirmation was sent to your phone.')}
        </Text>

        <View style={[theme.card, { marginTop: 26, width: '100%' }]}>
          <View style={theme.spread}>
            <Text style={theme.eyebrow}>{t('BOOKING REF')}</Text>
            <Text style={{ fontFamily: fonts.body, fontWeight: '800', fontSize: 13.5 }}>
              {booking.ref}
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: colors.cardLine, marginVertical: 14 }} />

          <Text style={[theme.h2, { fontSize: 17 }]}>{booking.venue.name}</Text>
          <Text style={[theme.muted, { marginTop: 4 }]}>
            {booking.eventDate} · {booking.guestCount} {t('guests')}
          </Text>

          <View style={{ height: 1, backgroundColor: colors.cardLine, marginVertical: 14 }} />

          <View style={theme.spread}>
            <Text style={theme.muted}>{t('Paid today')}</Text>
            <Money amountAmd={booking.paidAmd} style={{ fontSize: 14 }} />
          </View>
          <View style={[theme.spread, { marginTop: 4 }]}>
            <Text style={theme.muted}>
              {t('Balance due')} {booking.balanceDueOn}
            </Text>
            <Money amountAmd={booking.totalAmd - booking.paidAmd} style={{ fontSize: 14 }} />
          </View>
        </View>
      </View>

      <View style={[theme.section, { gap: 12, paddingBottom: insets.bottom + 24 }]}>
        <Button
          title={t('View booking')}
          onPress={() =>
            router.replace({ pathname: '/booking/[bookingId]', params: { bookingId: booking.id } })
          }
        />
        <Button
          title={t('Back to home')}
          variant="secondary"
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
    </View>
  );
}

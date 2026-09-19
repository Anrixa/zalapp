import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBooking, useCreatePaymentIntent, usePaymentStatus } from '@zal/api-client';
import { PaymentProvider, cardInputSchema } from '@zal/contracts';
import { Button, ErrorNote, Loading, ScreenHeader } from '../../../src/components/ui';
import { colors, fonts, theme } from '../../../src/theme';
import { useT } from '../../../src/i18n';

const METHODS = [
  {
    provider: PaymentProvider.CARD,
    title: 'Debit / credit card',
    subtitle: 'Visa, Mastercard, ArCa',
  },
  { provider: PaymentProvider.IDRAM, title: 'Idram', subtitle: 'Pay from your Idram wallet' },
  { provider: PaymentProvider.TELCELL, title: 'Telcell Wallet', subtitle: 'Pay by phone number' },
  {
    provider: PaymentProvider.BANK_TRANSFER,
    title: 'Bank transfer',
    subtitle: 'Manual confirmation, 1–2 days',
  },
] as const;

/**
 * Step 3 of 3 — payment.
 *
 * Card fields are validated with the shared contract (Luhn included) but never
 * sent to Zal; in production the provider SDK tokenises them on device. A
 * wallet or 3-D Secure hand-off opens in the system browser and the screen
 * polls until the webhook settles, so returning to the app lands on the right
 * state whichever way the guest came back.
 */
export default function PaymentScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const { data: booking, isLoading } = useBooking(bookingId);
  const createIntent = useCreatePaymentIntent();

  const [provider, setProvider] = useState<PaymentProvider>(PaymentProvider.CARD);
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', holder: '' });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const { data: status } = usePaymentStatus(paymentId ?? undefined, Boolean(paymentId));

  useEffect(() => {
    if (status?.payment.status === 'SUCCEEDED') {
      router.replace({ pathname: '/booking/[bookingId]/confirmed', params: { bookingId } });
    }
  }, [status?.payment.status, bookingId, router]);

  if (isLoading) return <Loading />;
  if (!booking) return null;

  const kind = booking.paidAmd >= booking.depositAmd ? 'BALANCE' : 'DEPOSIT';
  const amount = kind === 'DEPOSIT' ? booking.depositAmd : booking.balanceAmd;

  function pay() {
    if (provider === PaymentProvider.CARD) {
      const parsed = cardInputSchema.safeParse(card);
      if (!parsed.success) {
        setCardErrors(
          Object.fromEntries(
            parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
          ),
        );
        return;
      }
      setCardErrors({});
    }

    createIntent.mutate(
      {
        bookingId,
        kind,
        provider,
        savePaymentMethod: false,
        idempotencyKey: `${bookingId}:${kind}:${provider}`,
      },
      {
        onSuccess: (intent) => {
          setPaymentId(intent.paymentId);
          if (intent.redirectUrl) {
            void Linking.openURL(intent.redirectUrl);
            return;
          }
          if (intent.status === 'SUCCEEDED') {
            router.replace({ pathname: '/booking/[bookingId]/confirmed', params: { bookingId } });
          }
        },
      },
    );
  }

  const intent = createIntent.data;

  return (
    <View style={[theme.screen, { paddingTop: insets.top + 8 }]}>
      <ScreenHeader title={t('Payment')} step={t('STEP 3 OF 3')} />

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[theme.section, { paddingTop: 20, gap: 10 }]}>
          {METHODS.map((method) => {
            const active = provider === method.provider;

            return (
              <Pressable
                key={method.provider}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setProvider(method.provider)}
                style={[
                  theme.card,
                  theme.row,
                  {
                    gap: 12,
                    padding: 16,
                    borderColor: active ? colors.pomegranate : colors.cardLine,
                    borderWidth: active ? 1.5 : 1,
                  },
                ]}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: active ? colors.pomegranate : colors.line,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active ? (
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: colors.pomegranate,
                      }}
                    />
                  ) : null}
                </View>

                <View style={theme.grow}>
                  <Text style={{ fontFamily: fonts.body, fontWeight: '700', fontSize: 14 }}>
                    {t(method.title)}
                  </Text>
                  <Text style={[theme.muted, { fontSize: 12.5 }]}>{t(method.subtitle)}</Text>
                </View>

                {method.provider === PaymentProvider.CARD ? (
                  <Ionicons name="card-outline" size={20} color={colors.ink} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {provider === PaymentProvider.CARD ? (
          <View style={[theme.section, { paddingTop: 24, gap: 16 }]}>
            <View>
              <Text style={theme.label}>{t('Card number')}</Text>
              <TextInput
                value={card.number}
                onChangeText={(value) => setCard({ ...card, number: value })}
                keyboardType="number-pad"
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
                placeholderTextColor={colors.inkMuted}
                style={theme.input}
              />
              {cardErrors.number ? <Text style={theme.fieldError}>{cardErrors.number}</Text> : null}
            </View>

            <View style={[theme.row, { gap: 12 }]}>
              <View style={theme.grow}>
                <Text style={theme.label}>{t('Expiry')}</Text>
                <TextInput
                  value={card.expiry}
                  onChangeText={(value) => setCard({ ...card, expiry: value })}
                  keyboardType="number-pad"
                  placeholder={t('MM / YY')}
                  placeholderTextColor={colors.inkMuted}
                  style={theme.input}
                />
                {cardErrors.expiry ? (
                  <Text style={theme.fieldError}>{cardErrors.expiry}</Text>
                ) : null}
              </View>

              <View style={theme.grow}>
                <Text style={theme.label}>{t('CVC')}</Text>
                <TextInput
                  value={card.cvc}
                  onChangeText={(value) => setCard({ ...card, cvc: value })}
                  keyboardType="number-pad"
                  secureTextEntry
                  placeholder="•••"
                  placeholderTextColor={colors.inkMuted}
                  style={theme.input}
                />
                {cardErrors.cvc ? <Text style={theme.fieldError}>{cardErrors.cvc}</Text> : null}
              </View>
            </View>

            <View>
              <Text style={theme.label}>{t('Name on card')}</Text>
              <TextInput
                value={card.holder}
                onChangeText={(value) => setCard({ ...card, holder: value })}
                autoCapitalize="characters"
                placeholder="ANI SARGSYAN"
                placeholderTextColor={colors.inkMuted}
                style={theme.input}
              />
              {cardErrors.holder ? <Text style={theme.fieldError}>{cardErrors.holder}</Text> : null}
            </View>
          </View>
        ) : null}

        {intent?.bankTransfer ? (
          <View style={[theme.section, { paddingTop: 20 }]}>
            <View style={theme.card}>
              <Text style={theme.h2}>{t('Bank transfer')}</Text>
              <Row label={t('Beneficiary')} value={intent.bankTransfer.beneficiary} />
              <Row label={t('IBAN')} value={intent.bankTransfer.iban} />
              <Row label={t('Reference')} value={intent.bankTransfer.reference} />
              <Text style={[theme.muted, { marginTop: 12, lineHeight: 18 }]}>
                {intent.bankTransfer.note}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={[theme.section, { paddingTop: 20 }]}>
          <ErrorNote error={createIntent.error} />
          <Text style={[theme.muted, { fontSize: 12.5, lineHeight: 18 }]}>
            {t('Payments are encrypted end-to-end. Zal never stores your full card number.')}
          </Text>
        </View>
      </ScrollView>

      <View style={[theme.stickyBar, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title={`${t('Pay')} ${amount.toLocaleString('en-US')} AMD`}
          style={theme.grow}
          loading={
            createIntent.isPending || Boolean(paymentId && status?.payment.status === 'PROCESSING')
          }
          onPress={pay}
        />
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={[theme.spread, { marginTop: 10 }]}>
      <Text style={theme.muted}>{label}</Text>
      <Text style={{ fontFamily: fonts.body, fontWeight: '700', fontSize: 13.5 }}>{value}</Text>
    </View>
  );
}

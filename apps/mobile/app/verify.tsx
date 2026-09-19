import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVerifyOtp, useZalApi } from '@zal/api-client';
import { Button, ErrorNote, ScreenHeader } from '../src/components/ui';
import { colors, fonts, radii, theme } from '../src/theme';
import { useT } from '../src/i18n';

/**
 * The six-digit code screen.
 *
 * `textContentType="oneTimeCode"` on the first box lets iOS offer the code
 * straight from the SMS notification, which removes the most error-prone step
 * in the whole sign-up. Typing advances, backspace on an empty box steps back,
 * and a pasted code fills every box.
 */
export default function VerifyScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const api = useZalApi();

  const params = useLocalSearchParams<{ verificationId?: string; hint?: string }>();
  const verificationId = params.verificationId ?? '';

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [cooldown, setCooldown] = useState(45);
  const inputs = useRef<(TextInput | null)[]>([]);

  const verify = useVerifyOtp();
  const code = useMemo(() => digits.join(''), [digits]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (code.length === 6 && !verify.isPending) {
      verify.mutate({ verificationId, code }, { onSuccess: () => router.replace('/(tabs)') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, '');

    if (clean.length > 1) {
      const next = [...digits];
      for (let offset = 0; offset < clean.length && index + offset < 6; offset += 1) {
        next[index + offset] = clean[offset]!;
      }
      setDigits(next);
      inputs.current[Math.min(5, index + clean.length)]?.focus();
      return;
    }

    const updated = [...digits];
    updated[index] = clean;
    setDigits(updated);
    if (clean) inputs.current[index + 1]?.focus();
  }

  return (
    <View style={[theme.screen, { paddingTop: insets.top + 8 }]}>
      <ScreenHeader title="" onBack={() => router.back()} />

      <View style={[theme.grow, theme.section, { paddingTop: 20 }]}>
        <Text style={[theme.h1, { fontSize: 27 }]}>{t('Enter the code')}</Text>
        <Text style={[theme.body, { marginTop: 8, color: colors.inkSoft, lineHeight: 21 }]}>
          {t('We sent a 6-digit code by SMS to')}{' '}
          <Text style={{ color: colors.ink, fontWeight: '700' }}>{params.hint}</Text>.
        </Text>

        <View style={{ marginTop: 20 }}>
          <ErrorNote error={verify.error} />
        </View>

        <View style={[theme.row, { gap: 10, marginTop: 8 }]}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              value={digit}
              onChangeText={(value) => setDigit(index, value)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !digits[index]) {
                  inputs.current[index - 1]?.focus();
                }
              }}
              keyboardType="number-pad"
              textContentType={index === 0 ? 'oneTimeCode' : 'none'}
              maxLength={6}
              accessibilityLabel={`Digit ${index + 1} of 6`}
              style={{
                width: 46,
                height: 56,
                textAlign: 'center',
                fontFamily: fonts.display,
                fontSize: 22,
                fontWeight: '700',
                borderRadius: radii.input,
                borderWidth: 1.5,
                borderColor: digit ? colors.pomegranate : colors.line,
                backgroundColor: colors.white,
                color: colors.ink,
              }}
            />
          ))}
        </View>

        <View style={{ marginTop: 22 }}>
          {cooldown > 0 ? (
            <Text style={theme.muted}>
              {t("Didn't get it?")} {t('Resend in')} 0:{String(cooldown).padStart(2, '0')}
            </Text>
          ) : (
            <Button
              title={t('Resend')}
              variant="ghost"
              onPress={() => {
                void api.auth.resendOtp(verificationId).then(() => setCooldown(45));
              }}
            />
          )}
        </View>
      </View>

      <View style={[theme.section, { paddingBottom: insets.bottom + 24 }]}>
        <Button
          title={t('Verify & continue')}
          loading={verify.isPending}
          disabled={code.length !== 6}
          onPress={() =>
            verify.mutate({ verificationId, code }, { onSuccess: () => router.replace('/(tabs)') })
          }
        />
      </View>
    </View>
  );
}

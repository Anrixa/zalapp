import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ZalApiError, useLogin, useRequestOtp } from '@zal/api-client';
import { Button, ErrorNote, ScreenHeader } from '../src/components/ui';
import { colors, fonts, theme } from '../src/theme';
import { useT } from '../src/i18n';

export default function LoginScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const login = useLogin();
  const requestOtp = useRequestOtp();
  const error = login.error ?? requestOtp.error;

  function submit() {
    if (mode === 'otp') {
      requestOtp.mutate(identifier.trim(), {
        onSuccess: (challenge) =>
          router.push({
            pathname: '/verify',
            params: { verificationId: challenge.verificationId, hint: challenge.phoneHint },
          }),
      });
      return;
    }

    login.mutate(
      { identifier: identifier.trim(), password },
      { onSuccess: () => router.replace('/(tabs)') },
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[theme.screen, { paddingTop: insets.top + 8 }]}
    >
      <ScreenHeader title="" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={[theme.section, { paddingTop: 12, paddingBottom: 32 }]}>
        <Text style={[theme.h1, { fontSize: 28 }]}>{t('Welcome back')}</Text>
        <Text style={[theme.muted, { marginTop: 6 }]}>{t('Log in to manage your bookings.')}</Text>

        <View style={{ marginTop: 26 }}>
          <ErrorNote error={error} />

          <Text style={theme.label}>{t('Phone or email')}</Text>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoComplete="username"
            keyboardType="email-address"
            placeholder="+374 77 123 456"
            placeholderTextColor={colors.inkMuted}
            style={theme.input}
          />

          {mode === 'password' ? (
            <View style={{ marginTop: 16 }}>
              <Text style={theme.label}>{t('Password')}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                placeholder={t('Your password')}
                placeholderTextColor={colors.inkMuted}
                style={theme.input}
              />
            </View>
          ) : null}

          <Button
            title={mode === 'password' ? t('Log in') : t('Send me a code')}
            onPress={submit}
            loading={login.isPending || requestOtp.isPending}
            style={{ marginTop: 22 }}
          />

          <Button
            title={mode === 'password' ? t('Send me a code instead') : t('Use my password instead')}
            variant="ghost"
            onPress={() => setMode(mode === 'password' ? 'otp' : 'password')}
            style={{ marginTop: 8 }}
          />

          {error instanceof ZalApiError && error.code === 'PHONE_NOT_VERIFIED' ? (
            <Text style={theme.fieldError}>{error.message}</Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/signup')}
          style={{ marginTop: 28, alignItems: 'center' }}
        >
          <Text style={theme.muted}>
            {t('New to Zal?')}{' '}
            <Text style={{ color: colors.pomegranate, fontWeight: '700', fontFamily: fonts.body }}>
              {t('Create an account')}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

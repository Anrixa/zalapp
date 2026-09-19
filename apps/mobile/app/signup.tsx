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
import { ZalApiError, useRegister } from '@zal/api-client';
import { registerSchema } from '@zal/contracts';
import { Button, ErrorNote, ScreenHeader } from '../src/components/ui';
import { colors, theme } from '../src/theme';
import { useLocale, useT } from '../src/i18n';

export default function SignUpScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const register = useRegister();

  const [form, setForm] = useState({
    fullName: '',
    localPhone: '',
    email: '',
    password: '',
    acceptedTerms: false,
  });
  const [issues, setIssues] = useState<Record<string, string>>({});

  const fieldError = (path: string) =>
    issues[path] ??
    (register.error instanceof ZalApiError ? register.error.fieldError(path) : undefined);

  function submit() {
    // Validated with the API's own schema, so the two cannot disagree about
    // what a valid Armenian number looks like.
    const parsed = registerSchema.safeParse({
      fullName: form.fullName.trim(),
      phone: `+374${form.localPhone.replace(/\D/g, '')}`,
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      password: form.password,
      locale,
      acceptedTerms: form.acceptedTerms,
    });

    if (!parsed.success) {
      setIssues(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      );
      return;
    }

    setIssues({});
    register.mutate(parsed.data, {
      onSuccess: (challenge) =>
        router.push({
          pathname: '/verify',
          params: { verificationId: challenge.verificationId, hint: challenge.phoneHint },
        }),
    });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[theme.screen, { paddingTop: insets.top + 8 }]}
    >
      <ScreenHeader title="" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={[theme.section, { paddingTop: 12, paddingBottom: 40 }]}>
        <Text style={[theme.h1, { fontSize: 28 }]}>{t('Create your account')}</Text>
        <Text style={[theme.muted, { marginTop: 6 }]}>{t('It takes less than a minute.')}</Text>

        <View style={{ marginTop: 26, gap: 16 }}>
          <ErrorNote error={register.error} />

          <View>
            <Text style={theme.label}>{t('Full name')}</Text>
            <TextInput
              value={form.fullName}
              onChangeText={(value) => setForm({ ...form, fullName: value })}
              autoComplete="name"
              placeholder="Ani Sargsyan"
              placeholderTextColor={colors.inkMuted}
              style={theme.input}
            />
            {fieldError('fullName') ? (
              <Text style={theme.fieldError}>{fieldError('fullName')}</Text>
            ) : null}
          </View>

          <View>
            <Text style={theme.label}>{t('Phone number')}</Text>
            <View style={[theme.row, { gap: 8 }]}>
              <View
                style={[theme.input, { width: 74, alignItems: 'center', justifyContent: 'center' }]}
              >
                <Text style={{ fontWeight: '600', color: colors.ink }}>+374</Text>
              </View>
              <TextInput
                value={form.localPhone}
                onChangeText={(value) => setForm({ ...form, localPhone: value })}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="77 123 456"
                placeholderTextColor={colors.inkMuted}
                style={[theme.input, theme.grow]}
              />
            </View>
            {fieldError('phone') ? (
              <Text style={theme.fieldError}>{fieldError('phone')}</Text>
            ) : null}
          </View>

          <View>
            <Text style={theme.label}>
              {t('Email')} <Text style={{ color: colors.inkMuted }}>{t('(optional)')}</Text>
            </Text>
            <TextInput
              value={form.email}
              onChangeText={(value) => setForm({ ...form, email: value })}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="ani@email.com"
              placeholderTextColor={colors.inkMuted}
              style={theme.input}
            />
            {fieldError('email') ? (
              <Text style={theme.fieldError}>{fieldError('email')}</Text>
            ) : null}
          </View>

          <View>
            <Text style={theme.label}>{t('Password')}</Text>
            <TextInput
              value={form.password}
              onChangeText={(value) => setForm({ ...form, password: value })}
              secureTextEntry
              autoComplete="new-password"
              placeholder={t('At least 8 characters')}
              placeholderTextColor={colors.inkMuted}
              style={theme.input}
            />
            {fieldError('password') ? (
              <Text style={theme.fieldError}>{fieldError('password')}</Text>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.acceptedTerms }}
            onPress={() => setForm({ ...form, acceptedTerms: !form.acceptedTerms })}
            style={[theme.row, { gap: 10, alignItems: 'flex-start' }]}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                marginTop: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: form.acceptedTerms ? colors.pomegranate : 'transparent',
                borderWidth: form.acceptedTerms ? 0 : 1.5,
                borderColor: colors.line,
              }}
            >
              {form.acceptedTerms ? (
                <Text style={{ color: colors.ivory, fontSize: 13, fontWeight: '800' }}>✓</Text>
              ) : null}
            </View>
            <Text style={[theme.muted, theme.grow, { lineHeight: 19 }]}>
              {t("I agree to Zal's")} {t('Terms of Service')} {t('and')} {t('Privacy Policy')}.
            </Text>
          </Pressable>
          {fieldError('acceptedTerms') ? (
            <Text style={theme.fieldError}>{fieldError('acceptedTerms')}</Text>
          ) : null}
        </View>

        <Button
          title={t('Create account')}
          onPress={submit}
          loading={register.isPending}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

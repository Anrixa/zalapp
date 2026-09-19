import { Switch, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useMe,
  useNotificationPreferences,
  usePaymentMethods,
  useUpdateNotificationPreferences,
} from '@zal/api-client';
import { ErrorNote, Loading, ScreenHeader } from '../src/components/ui';
import { colors, fonts, theme } from '../src/theme';
import { useT } from '../src/i18n';

export default function SettingsScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();

  const { data: me, isLoading } = useMe();
  const { data: preferences } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const { data: methods } = usePaymentMethods();

  if (isLoading) return <Loading />;
  if (!me) return null;

  return (
    <View style={[theme.screen, { paddingTop: insets.top + 8 }]}>
      <ScreenHeader title={t('Settings')} />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={[theme.section, { paddingTop: 20 }]}>
          <ErrorNote error={updatePreferences.error} />

          <Text style={theme.eyebrow}>{t('Account')}</Text>
          <View style={[theme.card, { marginTop: 10, padding: 0 }]}>
            <Row label={t('Name')} value={me.fullName} first />
            <Row label={t('Phone')} value={me.phone} />
            <Row label={t('Email')} value={me.email ?? '—'} />
          </View>
        </View>

        <View style={[theme.section, { paddingTop: 26 }]}>
          <Text style={theme.eyebrow}>{t('Notifications')}</Text>
          <View style={[theme.card, { marginTop: 10, padding: 0 }]}>
            {(
              [
                ['push', t('Push notifications')],
                ['sms', t('SMS reminders')],
                ['email', t('Email updates')],
                ['priceDrops', t('Price drop alerts')],
              ] as const
            ).map(([key, label], index) => (
              <View
                key={key}
                style={[
                  theme.spread,
                  {
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.cardLine,
                    minHeight: 52,
                  },
                ]}
              >
                <Text style={{ fontFamily: fonts.body, fontWeight: '600', fontSize: 13.5 }}>
                  {label}
                </Text>
                <Switch
                  value={preferences?.[key] ?? false}
                  onValueChange={(value) => updatePreferences.mutate({ [key]: value })}
                  trackColor={{ true: colors.pomegranate, false: colors.line }}
                  accessibilityLabel={label}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={[theme.section, { paddingTop: 26 }]}>
          <Text style={theme.eyebrow}>{t('Payment methods')}</Text>
          <View style={[theme.card, { marginTop: 10, padding: 0 }]}>
            {(methods ?? []).length === 0 ? (
              <Text style={[theme.muted, { padding: 18 }]}>
                {t('No card saved yet. You can add one at checkout.')}
              </Text>
            ) : (
              (methods ?? []).map((method, index) => (
                <View
                  key={method.id}
                  style={[
                    theme.row,
                    {
                      gap: 12,
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.cardLine,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 36,
                      height: 24,
                      borderRadius: 5,
                      backgroundColor: colors.ink,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.ivory, fontSize: 9, fontWeight: '800' }}>
                      {method.brand.slice(0, 4).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      theme.grow,
                      { fontFamily: fonts.body, fontWeight: '600', fontSize: 13.5 },
                    ]}
                  >
                    •••• {method.last4 ?? '––––'}
                  </Text>
                  {method.isDefault ? (
                    <Text
                      style={{
                        fontFamily: fonts.body,
                        fontSize: 11.5,
                        color: colors.inkMuted,
                        fontWeight: '700',
                      }}
                    >
                      {t('DEFAULT')}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View
      style={[
        theme.spread,
        {
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: colors.cardLine,
          minHeight: 52,
        },
      ]}
    >
      <Text style={theme.muted}>{label}</Text>
      <Text style={{ fontFamily: fonts.body, fontWeight: '700', fontSize: 13.5 }}>{value}</Text>
    </View>
  );
}

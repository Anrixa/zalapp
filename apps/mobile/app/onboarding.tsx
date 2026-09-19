import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button } from '../src/components/ui';
import { colors, fonts, radii, theme } from '../src/theme';
import { useT } from '../src/i18n';

export default function OnboardingScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[theme.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={[theme.section, { alignItems: 'flex-end' }]}>
        <Button title={t('Skip')} variant="ghost" onPress={() => router.replace('/(tabs)')} />
      </View>

      <View style={[theme.section, { paddingTop: 16 }]}>
        <View
          style={{
            height: 300,
            borderRadius: radii.sheet,
            backgroundColor: colors.pomegranate,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="images-outline" size={72} color={colors.ivory} />
          <View
            style={{
              position: 'absolute',
              left: 16,
              bottom: 16,
              backgroundColor: 'rgba(36,26,24,0.4)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: radii.pill,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 12,
                fontWeight: '700',
                color: colors.ivory,
              }}
            >
              {t('1,400+ halls across Armenia')}
            </Text>
          </View>
        </View>
      </View>

      <View style={[theme.grow, theme.section, { paddingTop: 32 }]}>
        <Text style={[theme.h1, { fontSize: 30, lineHeight: 36 }]}>
          {t('Every celebration deserves the right room')}
        </Text>
        <Text style={[theme.body, { marginTop: 12, color: colors.inkSoft, lineHeight: 24 }]}>
          {t(
            'Compare real photos, prices and open dates for wedding halls, restaurants and event spaces — then hold your date in minutes.',
          )}
        </Text>
      </View>

      <View style={[theme.section, { gap: 14 }]}>
        <Button title={t('Create an account')} onPress={() => router.push('/signup')} />
        <Button
          title={t('I already have an account')}
          variant="ghost"
          onPress={() => router.push('/login')}
        />
      </View>
    </View>
  );
}

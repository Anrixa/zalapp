import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useZal } from '@zal/api-client';
import { colors, fonts } from '../src/theme';

/**
 * The splash.
 *
 * It waits for the stored session to be checked, then sends the guest to the
 * app or to onboarding. Deciding here rather than inside the tabs is what stops
 * a signed-in guest seeing a flash of the login screen on a cold start.
 */
export default function SplashRoute() {
  const router = useRouter();
  const { client, ready } = useZal();

  useEffect(() => {
    if (!ready) return;

    void (async () => {
      const signedIn = await client.hasSession();
      router.replace(signedIn ? '/(tabs)' : '/onboarding');
    })();
  }, [ready, client, router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.pomegranate,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
      }}
    >
      <View
        style={{
          width: 104,
          height: 104,
          borderRadius: 28,
          backgroundColor: colors.ivory,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: fonts.display, fontSize: 44, color: colors.pomegranate }}>
          Z
        </Text>
      </View>

      <Text style={{ fontFamily: fonts.display, fontSize: 46, color: colors.ivory }}>Zal</Text>
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: 15,
          color: colors.pomegranateTint,
          textAlign: 'center',
        }}
      >
        Book the hall.{'\n'}Skip the phone calls.
      </Text>
    </View>
  );
}

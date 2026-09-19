import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers } from '../src/providers';
import { colors } from '../src/theme';

// Hold the splash until the brand faces are ready: the first frame of Zal in
// the system font, replaced a beat later by Fraunces, looks like a bug.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // The faces are loaded from npm packages rather than fetched at runtime, so
  // the app renders correctly on first launch with no network.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces: Fraunces_700Bold,
    PlusJakartaSans: PlusJakartaSans_400Regular,
    PlusJakartaSansSemiBold: PlusJakartaSans_600SemiBold,
    PlusJakartaSansBold: PlusJakartaSans_700Bold,
    PlusJakartaSansExtraBold: PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    // A font that fails to load must not leave the app stuck behind a splash
    // screen for ever — the fallback face is perfectly readable.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <Providers>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.ivory },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="booking/[bookingId]/confirmed"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
        </Stack>
      </Providers>
    </SafeAreaProvider>
  );
}

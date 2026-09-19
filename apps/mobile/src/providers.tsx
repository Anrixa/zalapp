import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ZalProvider, SecureTokenStorage, useRealtime } from '@zal/api-client';
import { LocaleProvider } from './i18n';
import { API_URL, WS_URL } from './config';

/**
 * Everything the app needs, in one tree.
 *
 * `platform: 'mobile'` tells the API to return the refresh token in the body
 * rather than setting a cookie, and `SecureTokenStorage` puts it in the OS
 * keychain — the one place on a phone that survives the app being killed and
 * is not readable by anything else.
 */
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  const onUnauthenticated = useCallback(() => {
    router.replace('/login');
  }, [router]);

  const options = useMemo(
    () => ({
      baseUrl: API_URL,
      platform: 'mobile' as const,
      storage: new SecureTokenStorage(SecureStore),
      onUnauthenticated,
    }),
    [onUnauthenticated],
  );

  return (
    <ZalProvider {...options}>
      <LocaleProvider>
        <RealtimeBridge />
        {children}
      </LocaleProvider>
    </ZalProvider>
  );
}

function RealtimeBridge() {
  useRealtime({ url: WS_URL });
  return null;
}

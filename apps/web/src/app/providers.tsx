'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ZalProvider, useRealtime } from '@zal/api-client';
import { API_URL, WS_URL } from '@/lib/config';
import { LocaleProvider } from '@/lib/i18n';

/**
 * Everything client-side hangs off here.
 *
 * `platform: 'web'` tells the API to put the refresh token in an httpOnly
 * cookie rather than the response body — the browser cannot keep a secret from
 * its own scripts, so it is not given one.
 */
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  const onUnauthenticated = useCallback(() => {
    // Only bounce if the guest is somewhere that needs a session; sending
    // someone browsing venues to a login screen would be rude and pointless.
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const needsAuth = ['/bookings', '/saved', '/profile', '/settings', '/notifications'].some(
      (prefix) => path.startsWith(prefix),
    );
    if (needsAuth) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [router]);

  const options = useMemo(
    () => ({ baseUrl: API_URL, platform: 'web' as const, onUnauthenticated }),
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

/** Subscribes the tab to server events and refreshes the affected queries. */
function RealtimeBridge() {
  useRealtime({ url: WS_URL });
  return null;
}

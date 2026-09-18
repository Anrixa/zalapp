import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ZalApiError, ZalClient, type ZalClientOptions } from './http';
import { createApi, type ZalApi } from './endpoints';

interface ZalContextValue {
  client: ZalClient;
  api: ZalApi;
  /** False until the stored session has been checked, so screens can hold still. */
  ready: boolean;
}

const ZalContext = createContext<ZalContextValue | null>(null);

export interface ZalProviderProps extends ZalClientOptions {
  children: ReactNode;
  queryClient?: QueryClient;
}

/**
 * Sensible retry behaviour for a booking app on a phone.
 *
 * Retrying a 4xx is pointless — a 404 is still a 404 — and retrying a 429 makes
 * the rate limit worse. Only network faults and 5xx are worth a second attempt,
 * which is what this predicate encodes.
 */
export function createZalQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          if (error instanceof ZalApiError) {
            return error.isNetwork || error.status >= 500;
          }
          return true;
        },
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export function ZalProvider({ children, queryClient, ...options }: ZalProviderProps) {
  const [ready, setReady] = useState(false);

  const client = useMemo(() => new ZalClient(options), [options.baseUrl, options.platform]);
  const api = useMemo(() => createApi(client), [client]);
  const query = useMemo(() => queryClient ?? createZalQueryClient(), [queryClient]);

  // On a cold start the access token is always absent — it lives in memory. One
  // refresh at boot turns a stored refresh token (or the web cookie) back into a
  // usable session, so a returning guest never sees the login screen flash past.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await client.refresh();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client]);

  const value = useMemo<ZalContextValue>(() => ({ client, api, ready }), [client, api, ready]);

  return createElement(
    QueryClientProvider,
    { client: query },
    createElement(ZalContext.Provider, { value }, children),
  );
}

export function useZal(): ZalContextValue {
  const context = useContext(ZalContext);
  if (!context) {
    throw new Error('useZal must be used inside a <ZalProvider>');
  }
  return context;
}

export function useZalApi(): ZalApi {
  return useZal().api;
}

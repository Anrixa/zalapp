import Constants from 'expo-constants';

/**
 * Where the API lives.
 *
 * `localhost` inside a simulator means the simulator; on a physical phone it
 * means the phone. In development the packager's own host is the machine
 * running the API, so it is used as the fallback — which is what makes
 * `pnpm dev` work on a real device without editing a file.
 */
function devHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  return host ?? null;
}

const fallbackHost = devHost() ?? 'localhost';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${fallbackHost}:4000/api`;

export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? `http://${fallbackHost}:4000`;

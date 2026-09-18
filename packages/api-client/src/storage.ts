/**
 * Where the tokens live.
 *
 * The two platforms disagree about this and cannot be reconciled:
 *
 *  • A browser has no secret storage. Anything JavaScript can read, an XSS can
 *    read, so the refresh token is kept in an httpOnly cookie the page never
 *    sees, and this storage holds only the short-lived access token in memory.
 *  • A phone has a real keychain, so the refresh token goes to
 *    `expo-secure-store` and survives the app being killed.
 *
 * Both are expressed through this one interface, which is why the refresh
 * logic in `http.ts` is written once instead of twice.
 */
export interface TokenStorage {
  getAccessToken(): Promise<string | null> | string | null;
  setAccessToken(token: string | null): Promise<void> | void;

  /** Returns null on web, where the cookie holds it and the page cannot read it. */
  getRefreshToken(): Promise<string | null> | string | null;
  setRefreshToken(token: string | null): Promise<void> | void;

  clear(): Promise<void> | void;
}

/**
 * The web default: access token in memory only.
 *
 * Deliberately not localStorage. A token in localStorage outlives the tab, is
 * readable by any script on the origin, and buys nothing — the httpOnly cookie
 * already restores the session on reload through a single refresh call.
 */
export class MemoryTokenStorage implements TokenStorage {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setRefreshToken(token: string | null): void {
    this.refreshToken = token;
  }

  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

/**
 * The mobile default: access token in memory, refresh token in whatever secure
 * store is handed in. The app passes `expo-secure-store`; tests pass a map.
 */
export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

const REFRESH_KEY = 'zal.refreshToken';

export class SecureTokenStorage implements TokenStorage {
  private accessToken: string | null = null;

  constructor(private readonly store: SecureStoreLike) {}

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      return await this.store.getItemAsync(REFRESH_KEY);
    } catch {
      // A locked or unavailable keychain means "no session", not a crash on
      // the splash screen.
      return null;
    }
  }

  async setRefreshToken(token: string | null): Promise<void> {
    try {
      if (token === null) {
        await this.store.deleteItemAsync(REFRESH_KEY);
      } else {
        await this.store.setItemAsync(REFRESH_KEY, token);
      }
    } catch {
      // Losing persistence degrades to a session that ends when the app does.
    }
  }

  async clear(): Promise<void> {
    this.accessToken = null;
    await this.setRefreshToken(null);
  }
}

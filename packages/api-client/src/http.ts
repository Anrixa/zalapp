import { ErrorCode, apiErrorSchema, routes, type ApiError } from '@zal/contracts';
import type { ZodType, ZodTypeDef } from 'zod';

/**
 * A schema used to parse a response.
 *
 * Written as `ZodType<T, ZodTypeDef, unknown>` rather than `ZodSchema<T>`,
 * because `ZodSchema<T>` fixes the schema's *input* type to `T` as well as its
 * output. With any schema that uses `.default()`, those two differ — the input
 * has optional fields the output does not — and TypeScript resolves the clash
 * by inferring the input type. The parsed value then arrives typed with every
 * defaulted field optional, which is precisely backwards. Naming the input as
 * `unknown` lets inference pick the output, which is what `parse` returns.
 */
type ResponseSchema<T> = ZodType<T, ZodTypeDef, unknown>;
import { MemoryTokenStorage, type TokenStorage } from './storage';

export interface ZalClientOptions {
  /** e.g. `http://localhost:4000/api` — the version segment is added here. */
  baseUrl: string;
  storage?: TokenStorage;
  /** 'web' keeps the refresh token in a cookie; 'mobile' gets it in the body. */
  platform?: 'web' | 'mobile';
  locale?: string;
  /** Called when the session cannot be recovered — the app sends the guest to Login. */
  onUnauthenticated?: () => void;
  fetchImpl?: typeof fetch;
}

/**
 * A failed request, in a shape both clients can switch on.
 *
 * `code` comes from the contract's stable enum and never changes; `message` is
 * copy and will. Screens branch on the first and display the second.
 */
export class ZalApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: { path: string; message: string }[];
  readonly retryAfter?: number;
  readonly requestId?: string;

  constructor(status: number, error: ApiError['error']) {
    super(error.message);
    this.name = 'ZalApiError';
    this.code = error.code;
    this.status = status;
    this.fields = error.fields ?? [];
    if (error.retryAfter !== undefined) this.retryAfter = error.retryAfter;
    if (error.requestId !== undefined) this.requestId = error.requestId;
  }

  /** The message for one field, for inline form errors. */
  fieldError(path: string): string | undefined {
    return this.fields.find((field) => field.path === path)?.message;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, unknown>;
  /** Parse the response with this schema. Omit to return it unchecked. */
  schema?: ResponseSchema<T>;
  /** Skip the access token and the refresh dance — used by the auth calls. */
  anonymous?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/**
 * The transport.
 *
 * One place owns the base URL, the access token, the refresh-on-401 dance and
 * turning failures into `ZalApiError`. Everything above it — the endpoint
 * methods, the React Query hooks, the screens — is spared all four.
 *
 * Refreshing is serialised: if five requests hit a stale token at once, the
 * first starts the refresh and the rest wait on that same promise, so the
 * server sees one rotation rather than five racing ones (four of which would
 * look exactly like the token reuse the API revokes sessions for).
 */
export class ZalClient {
  readonly storage: TokenStorage;
  private readonly baseUrl: string;
  private readonly platform: 'web' | 'mobile';
  private readonly fetchImpl: typeof fetch;
  private readonly onUnauthenticated: (() => void) | undefined;
  private locale: string;
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(options: ZalClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.storage = options.storage ?? new MemoryTokenStorage();
    this.platform = options.platform ?? 'web';
    this.locale = options.locale ?? 'hy';
    this.onUnauthenticated = options.onUnauthenticated;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  setLocale(locale: string): void {
    this.locale = locale;
  }

  async request<T = unknown>(path: string, options: RequestOptions<T> = {}): Promise<T> {
    const response = await this.send(path, options);

    // One retry, and only for an expired access token: a 401 that survives a
    // successful refresh is a real authentication failure, not a stale token.
    if (response.status === 401 && !options.anonymous) {
      const refreshed = await this.refresh();
      if (refreshed) {
        const retried = await this.send(path, options);
        return this.parse(retried, options.schema);
      }
      await this.storage.clear();
      this.onUnauthenticated?.();
    }

    return this.parse(response, options.schema);
  }

  private async send<T>(path: string, options: RequestOptions<T>): Promise<Response> {
    const url = new URL(`${this.baseUrl}/v1${path}`);

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        // Repeated keys, which is what the contract's array coercion expects.
        for (const entry of value) url.searchParams.append(key, String(entry));
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': this.locale,
      'X-Zal-Client': this.platform,
      ...options.headers,
    };

    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    if (!options.anonymous) {
      const accessToken = await this.storage.getAccessToken();
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    }

    try {
      return await this.fetchImpl(url.toString(), {
        method: options.method ?? 'GET',
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        // Carries the httpOnly refresh cookie on web; harmless on native.
        credentials: 'include',
        ...(options.signal ? { signal: options.signal } : {}),
      });
    } catch (cause) {
      throw new ZalApiError(0, {
        code: 'NETWORK_ERROR',
        message: 'No connection. Check your network and try again.',
        ...(cause instanceof Error ? {} : {}),
      });
    }
  }

  private async parse<T>(response: Response, schema?: ResponseSchema<T>): Promise<T> {
    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const payload = text ? safeJson(text) : null;

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      throw new ZalApiError(
        response.status,
        parsed.success
          ? parsed.data.error
          : { code: ErrorCode.INTERNAL, message: 'Something went wrong. Try again.' },
      );
    }

    if (!schema) return payload as T;

    const result = schema.safeParse(payload);
    if (!result.success) {
      // The server sent something the contract does not describe. Failing here
      // beats letting a half-shaped object reach a screen and crash it later,
      // somewhere with no clue about where it came from.
      throw new ZalApiError(response.status, {
        code: 'RESPONSE_SHAPE_MISMATCH',
        message: 'The app could not read that response. Try updating the app.',
      });
    }
    return result.data;
  }

  /** Rotate the refresh token. At most one of these runs at a time. */
  async refresh(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = this.doRefresh().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async doRefresh(): Promise<boolean> {
    const stored = await this.storage.getRefreshToken();

    // Web has no token to send — the cookie carries it — so an absent token is
    // only decisive on native.
    if (this.platform === 'mobile' && !stored) return false;

    try {
      const response = await this.send(routes.auth.refresh(), {
        method: 'POST',
        body: stored ? { refreshToken: stored } : {},
        anonymous: true,
      });

      if (!response.ok) return false;

      const payload = safeJson(await response.text()) as {
        accessToken?: string;
        refreshToken?: string;
      } | null;

      if (!payload?.accessToken) return false;

      await this.storage.setAccessToken(payload.accessToken);
      if (payload.refreshToken) await this.storage.setRefreshToken(payload.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  /** Record a fresh session's tokens. */
  async adoptSession(session: { accessToken: string; refreshToken?: string }): Promise<void> {
    await this.storage.setAccessToken(session.accessToken);
    if (session.refreshToken) await this.storage.setRefreshToken(session.refreshToken);
  }

  async clearSession(): Promise<void> {
    await this.storage.clear();
  }

  async hasSession(): Promise<boolean> {
    return Boolean((await this.storage.getAccessToken()) ?? (await this.storage.getRefreshToken()));
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

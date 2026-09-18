import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ZalApiError, ZalClient } from './http';
import { MemoryTokenStorage } from './storage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeClient(fetchImpl: typeof fetch, platform: 'web' | 'mobile' = 'mobile') {
  const storage = new MemoryTokenStorage();
  const client = new ZalClient({
    baseUrl: 'http://api.test/api',
    storage,
    platform,
    fetchImpl,
  });
  return { client, storage };
}

describe('ZalClient', () => {
  it('builds versioned URLs and sends the platform header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const { client } = makeClient(fetchImpl);

    await client.request('/venues/discover');

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://api.test/api/v1/venues/discover');
    expect((init.headers as Record<string, string>)['X-Zal-Client']).toBe('mobile');
  });

  it('repeats array query parameters instead of joining them', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const { client } = makeClient(fetchImpl);

    await client.request('/venues', { query: { types: ['GARDEN', 'ROOFTOP'], q: '' } });

    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://api.test/api/v1/venues?types=GARDEN&types=ROOFTOP');
  });

  it('attaches the access token when there is one', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const { client, storage } = makeClient(fetchImpl);
    storage.setAccessToken('token-123');

    await client.request('/me');

    const [, init] = fetchImpl.mock.calls[0]!;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  it('turns an error body into a ZalApiError with the contract code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'SLOT_UNAVAILABLE',
            message: 'That date has just been taken',
            requestId: 'req-1',
          },
        },
        409,
      ),
    );
    const { client } = makeClient(fetchImpl);

    await expect(client.request('/bookings', { method: 'POST' })).rejects.toMatchObject({
      code: 'SLOT_UNAVAILABLE',
      status: 409,
      requestId: 'req-1',
    });
  });

  it('exposes per-field messages for inline form errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Some of the details need fixing',
            fields: [{ path: 'phone', message: 'Enter a phone number in international format' }],
          },
        },
        400,
      ),
    );
    const { client } = makeClient(fetchImpl);

    const error = await client
      .request('/auth/register', { method: 'POST' })
      .catch((caught) => caught as ZalApiError);

    expect(error).toBeInstanceOf(ZalApiError);
    expect((error as ZalApiError).fieldError('phone')).toContain('international format');
    expect((error as ZalApiError).fieldError('email')).toBeUndefined();
  });

  it('rejects a response that does not match its schema', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ unexpected: true }));
    const { client } = makeClient(fetchImpl);

    await expect(
      client.request('/me', { schema: z.object({ id: z.string() }) }),
    ).rejects.toMatchObject({ code: 'RESPONSE_SHAPE_MISMATCH' });
  });

  it('refreshes once on a 401 and replays the request', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'new-token', expiresIn: 900 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'user_1' }));

    const { client, storage } = makeClient(fetchImpl);
    storage.setAccessToken('stale');
    storage.setRefreshToken('refresh-1');

    const result = await client.request('/me', { schema: z.object({ id: z.string() }) });

    expect(result).toEqual({ id: 'user_1' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(storage.getAccessToken()).toBe('new-token');
  });

  it('gives up and clears the session when the refresh also fails', async () => {
    const onUnauthenticated = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'REFRESH_TOKEN_INVALID', message: 'x' } }, 401),
      );

    const storage = new MemoryTokenStorage();
    storage.setAccessToken('stale');
    storage.setRefreshToken('refresh-1');

    const client = new ZalClient({
      baseUrl: 'http://api.test/api',
      storage,
      platform: 'mobile',
      fetchImpl,
      onUnauthenticated,
    });

    await expect(client.request('/me')).rejects.toBeInstanceOf(ZalApiError);
    expect(onUnauthenticated).toHaveBeenCalledOnce();
    expect(storage.getAccessToken()).toBeNull();
  });

  /**
   * The important one: the API revokes a whole session family when a spent
   * refresh token is replayed, so parallel refreshes would log the guest out.
   */
  it('serialises concurrent refreshes into a single rotation', async () => {
    let refreshCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return jsonResponse({ accessToken: `token-${refreshCalls}`, expiresIn: 900 });
      }
      return jsonResponse({ ok: true });
    }) as unknown as typeof fetch;

    const { client } = makeClient(fetchImpl);
    (client.storage as MemoryTokenStorage).setRefreshToken('refresh-1');

    const results = await Promise.all([client.refresh(), client.refresh(), client.refresh()]);

    expect(results).toEqual([true, true, true]);
    expect(refreshCalls).toBe(1);
  });

  it('does not try to refresh on native when there is no stored token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const { client } = makeClient(fetchImpl, 'mobile');

    expect(await client.refresh()).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('still tries on web, where the cookie carries the token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ accessToken: 'c', expiresIn: 900 }));
    const { client } = makeClient(fetchImpl, 'web');

    expect(await client.refresh()).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('reports a network failure as a ZalApiError rather than throwing raw', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const { client } = makeClient(fetchImpl);

    const error = await client.request('/me').catch((caught) => caught as ZalApiError);
    expect(error).toBeInstanceOf(ZalApiError);
    expect((error as ZalApiError).isNetwork).toBe(true);
  });

  it('treats 204 as an empty success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const { client } = makeClient(fetchImpl);

    await expect(client.request('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { apiDocsEnabled, loadEnv, resetEnvCache, type Env } from '../src/config/env';

/**
 * The production guards.
 *
 * These exist because the dangerous configurations all *work*. A server left on
 * `PAYMENTS_PROVIDER=mock` takes bookings and charges nobody; one left on
 * `SMS_PROVIDER=console` writes every verification code into the log. Neither
 * raises an error, so neither gets noticed until it matters — which is why the
 * only useful behaviour is refusing to boot.
 */

const BASE = {
  DATABASE_URL: 'postgresql://zal:zal@localhost:5432/zal',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

const production = (extra: Record<string, string> = {}) => ({
  ...BASE,
  NODE_ENV: 'production',
  PAYMENTS_PROVIDER: 'arca',
  SMS_PROVIDER: 'twilio',
  CORS_ORIGINS: 'https://zal.am',
  ...extra,
});

beforeEach(() => {
  resetEnvCache();
  delete process.env.CORS_ORIGINS;
});

describe('loadEnv', () => {
  it('accepts a development environment with the defaults', () => {
    expect(loadEnv({ ...BASE } as NodeJS.ProcessEnv).NODE_ENV).toBe('development');
  });

  it('rejects a short JWT secret rather than starting with a weak one', () => {
    expect(() => loadEnv({ ...BASE, JWT_ACCESS_SECRET: 'short' } as NodeJS.ProcessEnv)).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('starts in production when everything real is configured', () => {
    process.env.CORS_ORIGINS = 'https://zal.am';
    expect(() => loadEnv(production() as NodeJS.ProcessEnv)).not.toThrow();
  });

  it('refuses to start in production with the mock payment provider', () => {
    process.env.CORS_ORIGINS = 'https://zal.am';
    expect(() =>
      loadEnv(production({ PAYMENTS_PROVIDER: 'mock' }) as NodeJS.ProcessEnv),
    ).toThrow(/charging anyone/);
  });

  it('refuses to start in production with codes going to the log', () => {
    process.env.CORS_ORIGINS = 'https://zal.am';
    expect(() => loadEnv(production({ SMS_PROVIDER: 'console' }) as NodeJS.ProcessEnv)).toThrow(
      /verification codes/,
    );
  });

  it('refuses to start in production with CORS left at its localhost default', () => {
    expect(() => loadEnv(production() as NodeJS.ProcessEnv)).toThrow(/CORS_ORIGINS/);
  });

  it('names every problem at once, so a deploy is not fixed one restart at a time', () => {
    let message = '';
    try {
      loadEnv(
        production({ PAYMENTS_PROVIDER: 'mock', SMS_PROVIDER: 'console' }) as NodeJS.ProcessEnv,
      );
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/PAYMENTS_PROVIDER/);
    expect(message).toMatch(/SMS_PROVIDER/);
    expect(message).toMatch(/CORS_ORIGINS/);
  });
});

describe('apiDocsEnabled', () => {
  const env = (overrides: Partial<Env>) => ({ NODE_ENV: 'development', ...overrides }) as Env;

  it('is on in development and off in production', () => {
    expect(apiDocsEnabled(env({}))).toBe(true);
    expect(apiDocsEnabled(env({ NODE_ENV: 'production' }))).toBe(false);
  });

  it('can be turned on in production deliberately, and off in development', () => {
    expect(apiDocsEnabled(env({ NODE_ENV: 'production', ENABLE_API_DOCS: true }))).toBe(true);
    expect(apiDocsEnabled(env({ ENABLE_API_DOCS: false }))).toBe(false);
  });
});

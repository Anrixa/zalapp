/**
 * @zal/api-client — one client, two platforms.
 *
 * Owns transport, token storage, refresh-on-401, error normalisation, the
 * React Query hooks and the realtime subscription. `apps/web` and `apps/mobile`
 * import the same hooks and differ only in where the refresh token is kept.
 */

export * from './storage';
export * from './http';
export * from './endpoints';
export * from './query-keys';
export * from './provider';
export * from './hooks';
export * from './realtime';

import { beforeEach, describe, expect, it } from 'vitest';
import { resetEnvCache } from '../src/config/env';
import { StorageService } from '../src/modules/uploads/storage.service';

/**
 * Where an image is allowed to have come from.
 *
 * Both of these guard the same shape of mistake: a value that travels out to
 * the client and back is treated as if the server had chosen it. A storage key
 * decides which object a venue photo points at; an avatar URL decides what
 * every other visitor's browser fetches. Neither is safe to take on trust.
 */

const env = {
  DATABASE_URL: 'postgresql://zal:zal@localhost:5432/zal',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'zal-media',
  S3_FORCE_PATH_STYLE: 'true',
} as NodeJS.ProcessEnv;

const USER = 'ckv1abc2300000xyz';
const OTHER = 'ckv9zzz8800000abc';
const UUID = '3f1b9f0e-6c2a-4c8e-9a31-0e2d8f4b7c61';

let storage: StorageService;

beforeEach(() => {
  resetEnvCache();
  Object.assign(process.env, env);
  storage = new StorageService();
});

describe('ownsKey', () => {
  it('accepts a key this user was issued', () => {
    expect(storage.ownsKey(USER, `venue_photo/${USER}/${UUID}.jpg`)).toBe(true);
  });

  it('rejects another user’s key — the point of checking at all', () => {
    expect(storage.ownsKey(USER, `venue_photo/${OTHER}/${UUID}.jpg`)).toBe(false);
  });

  it('rejects a key that was never issued by presign', () => {
    expect(storage.ownsKey(USER, 'anything-i-like.jpg')).toBe(false);
    expect(storage.ownsKey(USER, `venue_photo/${USER}/not-a-uuid.jpg`)).toBe(false);
    expect(storage.ownsKey(USER, `venue_photo/${USER}/${UUID}.jpg/extra`)).toBe(false);
  });

  it('rejects traversal dressed up as a user segment', () => {
    expect(storage.ownsKey(USER, `venue_photo/../${USER}/${UUID}.jpg`)).toBe(false);
  });
});

describe('isOwnMediaUrl', () => {
  it('accepts a URL this service would produce', () => {
    const url = storage.publicUrl(`avatar/${USER}/${UUID}.jpg`);
    expect(storage.isOwnMediaUrl(url)).toBe(true);
  });

  it('rejects somewhere else on the web', () => {
    // The reason this matters: an avatar renders in other people's browsers, so
    // an arbitrary URL reports their IP to whoever set it.
    expect(storage.isOwnMediaUrl('https://tracker.example/pixel.gif')).toBe(false);
  });

  it('rejects a URL that starts right and then climbs out', () => {
    const url = `${storage.publicUrl('')}../../etc/passwd`;
    expect(storage.isOwnMediaUrl(url)).toBe(false);
  });
});

import { Logger } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { loadEnv } from './env';

const logger = new Logger('Throttler');

/**
 * Rate limiting, backed by Redis when there is one.
 *
 * In-memory counters are per process. With two API instances behind a load
 * balancer that quietly doubles every limit, and a restart resets them all —
 * which matters most on exactly the endpoints the limits exist to protect,
 * because someone guessing a six-digit OTP is happy to be load-balanced.
 *
 * Redis is optional rather than required. `pnpm test` and a bare `pnpm dev`
 * should not need a second service running to boot, and a single instance with
 * in-memory counters is genuinely correct — so the fallback is a real mode, not
 * a degraded one, and the log line says which is in use.
 */
export function throttlerOptions(): ThrottlerModuleOptions {
  const env = loadEnv();
  const throttlers = [{ ttl: 60_000, limit: 120 }];

  if (!env.REDIS_URL) {
    logger.log('Rate limiting in memory (set REDIS_URL to share limits across instances)');
    return { throttlers };
  }

  // `lazyConnect` keeps a missing Redis from taking the process down at boot;
  // ioredis retries in the background and the limiter degrades rather than the
  // API refusing to start.
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });

  redis.on('error', (error: Error) => {
    logger.warn(`Redis unavailable for rate limiting: ${error.message}`);
  });

  void redis.connect().catch(() => {
    // Already reported by the error handler above.
  });

  logger.log('Rate limiting via Redis');
  return { throttlers, storage: new ThrottlerStorageRedisService(redis) };
}

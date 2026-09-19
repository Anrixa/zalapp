import { z } from 'zod';

/**
 * Environment.
 *
 * Parsed once at boot and rejected loudly if it is wrong. A missing JWT secret
 * should stop the process on line one, not surface as a 500 the first time
 * somebody tries to log in.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  API_GLOBAL_PREFIX: z.string().default('api'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2_592_000),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:8081')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  SMS_PROVIDER: z.enum(['console', 'twilio', 'vonage']).default('console'),
  SMS_SENDER_ID: z.string().default('Zal'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(0).default(45),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('zal-media'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),

  PAYMENTS_PROVIDER: z.enum(['mock', 'arca', 'idram', 'telcell']).default('mock'),

  // Scheduled jobs. Exactly one process in a deployment should run them:
  // two instances with the scheduler on would send every reminder twice.
  ENABLE_SCHEDULER: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
  // How long a booking may hold a date before the deposit arrives.
  BOOKING_HOLD_MINUTES: z.coerce.number().int().positive().default(60),

  EXPO_ACCESS_TOKEN: z.string().optional(),

  /**
   * Whether to serve the OpenAPI explorer.
   *
   * Off in production by default. The document lists every route, body shape
   * and error code in the API, which is a gift to anyone probing it and of no
   * use to the two clients that already have the contracts as a package.
   */
  ENABLE_API_DOCS: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : value !== 'false')),
});

/**
 * Defaults that are right for a laptop and dangerous on a server.
 *
 * Every one of these is a setting that works — silently and wrongly — if it is
 * left unset in production. `PAYMENTS_PROVIDER=mock` settles every payment
 * instantly for free, which means a deploy that forgets it gives away bookings;
 * `SMS_PROVIDER=console` prints verification codes into the log, which means
 * anyone with log access can sign in as anybody. Neither fails, so neither gets
 * noticed. Refusing to boot is the only version of this that gets caught.
 */
function assertProductionSafe(env: Env): void {
  if (env.NODE_ENV !== 'production') return;

  const unsafe: string[] = [];
  if (env.PAYMENTS_PROVIDER === 'mock') {
    unsafe.push('PAYMENTS_PROVIDER=mock settles every payment instantly without charging anyone');
  }
  if (env.SMS_PROVIDER === 'console') {
    unsafe.push(
      'SMS_PROVIDER=console prints verification codes to the log instead of sending them',
    );
  }
  if (!process.env.CORS_ORIGINS) {
    unsafe.push('CORS_ORIGINS is unset, so only localhost origins are allowed');
  }

  if (unsafe.length > 0) {
    throw new Error(
      `Refusing to start in production with development defaults:\n${unsafe
        .map((line) => `  • ${line}`)
        .join('\n')}`,
    );
  }
}

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  assertProductionSafe(parsed.data);

  cached = parsed.data;
  return cached;
}

/** Whether the OpenAPI explorer should be served: off in production unless asked for. */
export function apiDocsEnabled(env: Env): boolean {
  return env.ENABLE_API_DOCS ?? env.NODE_ENV !== 'production';
}

/** Test helper: forget the parsed environment so a new one can be loaded. */
export function resetEnvCache(): void {
  cached = null;
}

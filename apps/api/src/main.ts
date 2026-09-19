import 'reflect-metadata';
import { Logger, VersioningType, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Request, Response } from 'express';
import { json } from 'express';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma/prisma.service';
import { apiDocsEnabled, loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  // Keep the raw body for webhook signature verification: a re-serialised
  // object no longer hashes to what the provider signed.
  app.use(
    json({
      limit: '1mb',
      verify: (request: Request & { rawBody?: string }, _response: Response, buffer: Buffer) => {
        if (request.url?.includes('/payments/webhooks/')) {
          request.rawBody = buffer.toString('utf8');
        }
      },
    }),
  );

  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Zal-Client',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });

  app.setGlobalPrefix(env.API_GLOBAL_PREFIX, { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (apiDocsEnabled(env)) mountApiDocs(app, env.API_GLOBAL_PREFIX);

  app.get(PrismaService).enableShutdownHooks(app);

  await app.listen(env.API_PORT, '0.0.0.0');

  logger.log(`Zal API listening on ${env.API_PUBLIC_URL}/${env.API_GLOBAL_PREFIX}/v1`);
  if (apiDocsEnabled(env)) {
    logger.log(`OpenAPI at ${env.API_PUBLIC_URL}/${env.API_GLOBAL_PREFIX}/docs`);
  }
  if (env.SMS_PROVIDER === 'console') {
    logger.warn('SMS_PROVIDER=console — verification codes are printed to this log, not sent');
  }
}

/**
 * The OpenAPI explorer.
 *
 * Kept off in production by default: it publishes every route, body shape and
 * error code, and the only two clients that need that information already have
 * it as a typed package.
 */
function mountApiDocs(app: INestApplication, prefix: string): void {
  const swagger = new DocumentBuilder()
    .setTitle('Zal API')
    .setDescription(
      'Venue booking for the Armenian market. Request and response shapes are defined in @zal/contracts and shared with the web and mobile clients.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('venues')
    .addTag('bookings')
    .addTag('payments')
    .addTag('host')
    .build();

  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swagger), {
    swaggerOptions: { persistAuthorization: true },
  });
}

void bootstrap();

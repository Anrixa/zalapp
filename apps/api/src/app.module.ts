import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './common/prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';

import { HealthModule } from './modules/health/health.module';
import { AppConfigModule } from './modules/config/app-config.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VenuesModule } from './modules/venues/venues.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { MessagesModule } from './modules/messages/messages.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { throttlerOptions } from './config/throttler';

/**
 * Cross-cutting concerns are registered once, globally:
 *
 *  • authentication is on by default and opted out of with `@Public()`, so a
 *    forgotten decorator locks a route rather than exposing one;
 *  • one exception filter turns every failure into the single error envelope
 *    the clients parse;
 *  • rate limiting covers everything, with tighter per-route limits on the auth
 *    endpoints where guessing actually pays.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    ThrottlerModule.forRootAsync({ useFactory: throttlerOptions }),
    ScheduleModule.forRoot(),
    JwtModule.register({}),
    PrismaModule,
    RealtimeModule,
    NotificationsModule,

    HealthModule,
    AppConfigModule,
    AuthModule,
    UsersModule,
    VenuesModule,
    BookingsModule,
    PaymentsModule,
    FavoritesModule,
    MessagesModule,
    UploadsModule,
    TasksModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

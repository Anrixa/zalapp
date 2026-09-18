import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { loadEnv } from '../../config/env';

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Push notifications through Expo's service, which fans out to APNs and FCM.
 *
 * Two things matter here. Preferences are honoured at send time rather than at
 * registration, so switching push off in Settings takes effect immediately on
 * every device. And a token the service reports as dead is deleted — otherwise
 * an old phone's token accumulates failures forever and slows every later send.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly env = loadEnv();

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    const [preference, devices] = await Promise.all([
      this.prisma.notificationPreference.findUnique({ where: { userId } }),
      this.prisma.device.findMany({ where: { userId }, select: { id: true, pushToken: true } }),
    ]);

    // Absent preferences mean defaults, and the default is push on.
    if (preference && !preference.push) return;
    if (devices.length === 0) return;

    if (this.env.NODE_ENV === 'development' && !this.env.EXPO_ACCESS_TOKEN) {
      this.logger.debug(`push → ${devices.length} device(s): ${message.title} — ${message.body}`);
      return;
    }

    const payload = devices.map((device) => ({
      to: device.pushToken,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: 'default',
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${this.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      this.logger.warn(`Expo push responded ${response.status}`);
      return;
    }

    const result = (await response.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };

    const dead = (result.data ?? [])
      .map((ticket, index) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? devices[index]?.id
          : null,
      )
      .filter((id): id is string => Boolean(id));

    if (dead.length > 0) {
      await this.prisma.device.deleteMany({ where: { id: { in: dead } } });
      this.logger.debug(`Removed ${dead.length} unregistered device token(s)`);
    }
  }
}

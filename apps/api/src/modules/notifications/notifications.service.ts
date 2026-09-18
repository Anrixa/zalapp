import { Injectable, Logger } from '@nestjs/common';
import type { Notification as NotificationRow, NotificationType, Prisma } from '@prisma/client';
import {
  RealtimeEvent,
  type ListNotificationsQuery,
  type Notification,
  type Page,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decodeCursor, paginate } from '../../common/utils/cursor';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PushService } from './push.service';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
  /** Skip the push even when the guest allows them — used for self-caused events. */
  silent?: boolean;
}

/**
 * Notifications.
 *
 * One call does all three deliveries: the row the Alerts tab reads, the socket
 * event that updates an open app instantly, and the push that reaches a closed
 * one. Callers elsewhere in the API say what happened; none of them has to
 * remember which channels exist.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
      },
    });

    const unread = await this.prisma.notification.count({
      where: { userId: input.userId, readAt: null },
    });

    const dto = toNotificationDto(row);
    this.realtime.emitToUser(input.userId, RealtimeEvent.NOTIFICATION_CREATED, {
      notification: dto,
      unread,
    });

    if (!input.silent) {
      // Push is best-effort: a dead token must not fail the booking that
      // triggered it.
      void this.push
        .sendToUser(input.userId, {
          title: input.title,
          body: input.body,
          data: (input.data as Record<string, unknown>) ?? {},
        })
        .catch((error) => this.logger.warn(`Push failed for ${input.userId}: ${error}`));
    }

    return dto;
  }

  async list(userId: string, query: ListNotificationsQuery): Promise<Page<Notification>> {
    const cursorId = decodeCursor(query.cursor);

    const rows = await this.prisma.notification.findMany({
      where: { userId, ...(query.unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const { items, nextCursor } = paginate(rows, query.limit, (row) => row.id);
    return { items: items.map(toNotificationDto), nextCursor };
  }

  async unreadCount(userId: string): Promise<{ unread: number }> {
    const unread = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { unread };
  }

  /** Omitting ids marks everything read — what "Mark all read" does. */
  async markRead(userId: string, ids?: string[]): Promise<{ unread: number }> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });

    const result = await this.unreadCount(userId);
    this.realtime.emitToUser(userId, RealtimeEvent.UNREAD_COUNT, result);
    return result;
  }
}

export function toNotificationDto(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    data: (row.data as Notification['data']) ?? {},
  };
}

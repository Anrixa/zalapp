import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  RealtimeEvent,
  type Conversation,
  type Message,
  type Page,
  type SendMessageBody,
  type StartConversationBody,
} from '@zal/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { decodeCursor, paginate } from '../../common/utils/cursor';
import { initialsFrom } from '../../common/utils/text';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/**
 * Guest ↔ host messaging.
 *
 * One conversation per guest and venue, whether or not a booking exists yet —
 * the questions that decide a booking ("can we bring our own tamada?") come
 * before it, and threading them separately from the booking would scatter the
 * history across two places.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async listConversations(
    userId: string,
    query: { cursor?: string; limit: number },
  ): Promise<Page<Conversation>> {
    const cursorId = decodeCursor(query.cursor);

    const rows = await this.prisma.conversation.findMany({
      where: { OR: [{ guestId: userId }, { host: { userId } }] },
      include: {
        venue: { select: { id: true, name: true } },
        guest: { select: { id: true, fullName: true, avatarUrl: true } },
        host: { include: { user: { select: { id: true, avatarUrl: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const { items, nextCursor } = paginate(rows, query.limit, (row) => row.id);

    const unreadCounts = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: items.map((row) => row.id) },
        senderId: { not: userId },
        readAt: null,
      },
      _count: { id: true },
    });
    const unreadByConversation = new Map(
      unreadCounts.map((row) => [row.conversationId, row._count.id]),
    );

    return {
      items: items.map((row) => {
        const viewerIsGuest = row.guestId === userId;
        const counterpartName = viewerIsGuest ? row.host.displayName : row.guest.fullName;
        const last = row.messages[0];

        return {
          id: row.id,
          bookingId: row.bookingId,
          venueId: row.venue.id,
          venueName: row.venue.name,
          counterpartName,
          counterpartInitials: initialsFrom(counterpartName),
          counterpartAvatarUrl: viewerIsGuest
            ? (row.host.user?.avatarUrl ?? null)
            : row.guest.avatarUrl,
          lastMessage: last ? toMessageDto(last) : null,
          unreadCount: unreadByConversation.get(row.id) ?? 0,
          updatedAt: row.lastMessageAt.toISOString(),
        };
      }),
      nextCursor,
    };
  }

  /** Reading a thread marks the other side's messages read; the socket carries the change. */
  async listMessages(
    userId: string,
    conversationId: string,
    query: { cursor?: string; limit: number },
  ): Promise<Page<Message>> {
    await this.assertParticipant(userId, conversationId);
    const cursorId = decodeCursor(query.cursor);

    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });

    const { items, nextCursor } = paginate(rows, query.limit, (row) => row.id);
    return { items: items.map(toMessageDto), nextCursor };
  }

  async start(userId: string, body: StartConversationBody): Promise<Conversation> {
    const venue = await this.prisma.venue.findFirst({
      where: { id: body.venueId, deletedAt: null },
      select: { id: true, hostProfileId: true },
    });
    if (!venue) throw AppError.notFound('Venue');

    const conversation = await this.prisma.conversation.upsert({
      where: { venueId_guestId: { venueId: venue.id, guestId: userId } },
      create: {
        venueId: venue.id,
        hostProfileId: venue.hostProfileId,
        guestId: userId,
        bookingId: body.bookingId ?? null,
      },
      update: body.bookingId ? { bookingId: body.bookingId } : {},
    });

    await this.send(userId, conversation.id, { body: body.body });

    const [result] = (await this.listConversations(userId, { limit: 1 })).items;
    if (!result) throw AppError.notFound('Conversation');
    return result;
  }

  async send(userId: string, conversationId: string, body: SendMessageBody): Promise<Message> {
    const conversation = await this.assertParticipant(userId, conversationId);

    if (body.idempotencyKey) {
      const existing = await this.prisma.message.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
      });
      if (existing) return toMessageDto(existing);
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          body: body.body,
          idempotencyKey: body.idempotencyKey ?? null,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });
      return created;
    });

    const recipientId =
      conversation.guestId === userId ? conversation.host.userId : conversation.guestId;

    const dto = toMessageDto(message);
    // Both sides get the event: the sender's other devices need it as much as
    // the recipient does.
    this.realtime.emitToUser(recipientId, RealtimeEvent.MESSAGE_CREATED, {
      message: dto,
      conversationId,
    });
    this.realtime.emitToUser(userId, RealtimeEvent.MESSAGE_CREATED, {
      message: dto,
      conversationId,
    });

    await this.notifications.create({
      userId: recipientId,
      type: 'MESSAGE_RECEIVED',
      title: 'New message',
      body: body.body.slice(0, 140),
      data: { conversationId, venueId: conversation.venueId },
    });

    return dto;
  }

  private async assertParticipant(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { host: { select: { userId: true } } },
    });
    if (!conversation) throw AppError.notFound('Conversation');

    if (conversation.guestId !== userId && conversation.host.userId !== userId) {
      throw new AppError(ErrorCode.FORBIDDEN, 'This conversation is not yours');
    }
    return conversation;
  }
}

function toMessageDto(message: {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}): Message {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
  };
}

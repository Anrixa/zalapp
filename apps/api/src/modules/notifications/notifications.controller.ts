import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { listNotificationsQuerySchema, markNotificationsReadSchema } from '@zal/contracts';
import { ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @ZodQuery(listNotificationsQuerySchema) query: unknown) {
    return this.notifications.list(userId, query as never);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notifications.unreadCount(userId);
  }

  @Post('read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark some or all notifications as read' })
  markRead(
    @CurrentUser('id') userId: string,
    @ZodBody(markNotificationsReadSchema) body: { ids?: string[] },
  ) {
    return this.notifications.markRead(userId, body.ids);
  }
}

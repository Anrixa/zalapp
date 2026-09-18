import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { paginationQuerySchema, sendMessageSchema, startConversationSchema } from '@zal/contracts';
import { ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('conversations')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  listConversations(
    @CurrentUser('id') userId: string,
    @ZodQuery(paginationQuerySchema) query: unknown,
  ) {
    return this.messages.listConversations(userId, query as never);
  }

  @Post()
  @ApiOperation({ summary: 'Message a host about a venue, booking or not' })
  start(@CurrentUser('id') userId: string, @ZodBody(startConversationSchema) body: unknown) {
    return this.messages.start(userId, body as never);
  }

  @Get(':conversationId/messages')
  listMessages(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
    @ZodQuery(paginationQuerySchema) query: unknown,
  ) {
    return this.messages.listMessages(userId, conversationId, query as never);
  }

  @Post(':conversationId/messages')
  send(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
    @ZodBody(sendMessageSchema) body: unknown,
  ) {
    return this.messages.send(userId, conversationId, body as never);
  }
}

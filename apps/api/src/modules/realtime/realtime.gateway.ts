import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  REALTIME_NAMESPACE,
  RealtimeEvent,
  type RealtimePayloadMap,
  accessTokenClaimsSchema,
  userRoom,
} from '@zal/contracts';
import { loadEnv } from '../../config/env';

/**
 * The realtime channel.
 *
 * One namespace, one room per user. A socket authenticates with the same
 * access token the REST calls use — there is no second credential to manage and
 * no anonymous socket that later claims an identity.
 *
 * Events carry ids and statuses, not whole objects: the client refetches the
 * query the event names. That keeps the socket cheap, keeps a backgrounded
 * client correct (its next fetch fixes whatever it missed) and means no screen
 * has to merge a partial payload into cached state.
 */
@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: { origin: loadEnv().CORS_ORIGINS, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly env = loadEnv();

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      extractBearer(client.handshake.headers.authorization);

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync(token, { secret: this.env.JWT_ACCESS_SECRET });
      const claims = accessTokenClaimsSchema.parse(payload);
      client.data.userId = claims.sub;
      await client.join(userRoom(claims.sub));
      this.logger.debug(`socket ${client.id} joined ${userRoom(claims.sub)}`);
    } catch {
      // An expired token is the common case: the client refreshes and reconnects.
      client.emit('error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`socket ${client.id} disconnected`);
  }

  /** Type-safe emit: the payload has to match the event it is sent under. */
  emitToUser<E extends RealtimeEvent>(
    userId: string,
    event: E,
    payload: RealtimePayloadMap[E],
  ): void {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  return value && scheme?.toLowerCase() === 'bearer' ? value : null;
}

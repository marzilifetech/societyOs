import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';

/**
 * SOS alerts carry a resident's name, flat and location, so this namespace is
 * authenticated. It used to accept any connection and let it join any
 * society's room, which exposed every society's SOS alerts to anyone who could
 * reach the socket. Now a connection must present a valid access token
 * (handshake `auth.token` or an `Authorization` header, as in EventsGateway),
 * and `join-society` only joins the society in that token.
 */
@WebSocketGateway({ namespace: '/sos', cors: { origin: '*' } })
export class SosGateway implements OnGatewayConnection {
  private readonly logger = new Logger(SosGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization || '').replace(/^Bearer\s+/, '');
      if (!token) throw new Error('missing token');
      const payload = this.jwt.verify<{ sub: string; societyId?: string }>(token, {
        secret: this.config.get('JWT_SECRET'),
      });
      if (!payload?.societyId) throw new Error('token has no society');
      client.data.userId = payload.sub;
      client.data.societyId = payload.societyId;
    } catch (err) {
      this.logger.warn(`sos socket rejected: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join-society')
  handleJoin(@MessageBody() societyId: string, @ConnectedSocket() client: Socket) {
    const own = client.data?.societyId as string | undefined;
    if (!own || societyId !== own) {
      return { joined: null, error: 'FORBIDDEN' };
    }
    client.join(`society:${own}`);
    return { joined: own };
  }

  emitSosAlert(societyId: string, alert: unknown) {
    this.server.to(`society:${societyId}`).emit('sos-alert', alert);
  }

  emitSosResolved(societyId: string, alertId: string) {
    this.server.to(`society:${societyId}`).emit('sos-resolved', { alertId });
  }

  emitSosAcknowledged(societyId: string, alertId: string, acknowledgedBy: string) {
    this.server.to(`society:${societyId}`).emit(`sos:${alertId}:acknowledged`, {
      alertId,
      acknowledgedBy,
      acknowledgedAt: new Date().toISOString(),
    });
    this.server.to(`resident:${acknowledgedBy}`).emit(`sos:${alertId}:acknowledged`, {
      alertId,
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    });
  }
}

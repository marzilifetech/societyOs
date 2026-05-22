import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { RealtimeGateway } from './realtime.gateway';

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    societyId: string;
    role: string;
    tokenExp: number;
  };
}

/**
 * Real Socket.io gateway with JWT handshake auth, room auto-join, ping/pong,
 * and token-expiry disconnect. Wires server back into RealtimeGateway so that
 * all existing emit() calls flow through Socket.io.
 */
@WebSocketGateway({
  namespace: '/events',
  cors: { origin: (process.env.CORS_ORIGINS || '*').split(',') },
  pingInterval: 25000,
  pingTimeout: 20000,
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    @Inject(forwardRef(() => RealtimeGateway))
    private realtime: RealtimeGateway,
  ) {}

  async afterInit(server: Server) {
    this.realtime.setServer(server);

    // Optional Redis adapter for horizontal scaling
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl && this.config.get('SOCKET_IO_REDIS_ADAPTER') === 'true') {
      try {
        // dynamic require so missing dep doesn't break boot
        const { createAdapter } = require('@socket.io/redis-adapter');
        const Redis = require('ioredis');
        const pubClient = new Redis(redisUrl);
        const subClient = pubClient.duplicate();
        server.adapter(createAdapter(pubClient, subClient));
        this.logger.log('Socket.io Redis adapter attached');
      } catch (e) {
        this.logger.warn(`Redis adapter not loaded: ${(e as Error).message}`);
      }
    }

    this.logger.log('EventsGateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization || '').replace(/^Bearer\s+/, '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload: any = this.jwt.verify(token, {
        secret: this.config.get('JWT_SECRET'),
      });

      const c = client as AuthedSocket;
      c.data.userId = payload.sub;
      c.data.societyId = payload.societyId;
      c.data.role = payload.role;
      c.data.tokenExp = payload.exp || 0;

      // Auto-join rooms by role
      const sid = payload.societyId;
      const uid = payload.sub;
      const role = String(payload.role || '').toUpperCase();

      switch (role) {
        case 'RESIDENT':
          c.join(`society:${sid}:resident:${uid}`);
          break;
        case 'STAFF':
          c.join(`society:${sid}:staff:${uid}`);
          break;
        case 'ADMIN':
        case 'SUPER_ADMIN':
          c.join(`society:${sid}:admin`);
          break;
        case 'GATE':
        case 'GUARD':
          c.join(`society:${sid}:gate`);
          break;
      }
      // Society-wide broadcast room
      c.join(`society:${sid}`);

      // Schedule disconnect on token expiry
      if (c.data.tokenExp) {
        const ms = c.data.tokenExp * 1000 - Date.now();
        if (ms > 0) {
          setTimeout(() => {
            try {
              c.emit('auth:expired', { code: 'TOKEN_EXPIRED' });
              c.disconnect(true);
            } catch {
              /* noop */
            }
          }, ms).unref?.();
        }
      }

      this.logger.debug(`socket connected user=${uid} role=${role} society=${sid}`);
    } catch (err) {
      this.logger.warn(`socket auth failed: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const c = client as AuthedSocket;
    this.logger.debug(`socket disconnected user=${c.data?.userId}`);
  }

  /** Convenience: broadcast to predicate-matched sockets. */
  broadcast(predicate: (socket: AuthedSocket) => boolean, event: string, payload: unknown) {
    const sockets = this.server?.sockets?.sockets;
    if (!sockets) return;
    for (const [, s] of sockets) {
      try {
        if (predicate(s as AuthedSocket)) {
          (s as AuthedSocket).emit(event, payload);
        }
      } catch {
        /* noop */
      }
    }
  }

  /** Connected client count for health endpoint. */
  getConnectedCount(): number {
    return this.server?.sockets?.sockets?.size ?? 0;
  }
}

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
import { RealtimeGateway, SOS_RESPONDER_ROLES } from './realtime.gateway';
import { PrismaService } from '../../prisma/prisma.service';

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
    private prisma: PrismaService,
  ) {}

  /**
   * Rooms a connection belongs to, from the CURRENT database row rather than
   * the token's claims (role and society can change after a token is minted).
   *
   * Besides the society/role rooms, a connection joins the entity rooms that
   * services actually emit to — `resident:<residentId>`, `staff:<staffId>` and
   * each staff chat group `staff:msg:<groupId>`. Nothing joined those, so
   * every visitor-arrival, task-assigned and chat event went nowhere.
   *
   * Returns null for anyone who must not have a live connection (unknown,
   * deactivated or suspended users, or a society that isn't active).
   */
  async roomsFor(userId: string): Promise<{ societyId: string; role: string; rooms: string[] } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        role: true,
        societyId: true,
        society: { select: { status: true } },
        resident: { select: { id: true, deletedAt: true } },
        staffMember: { select: { id: true, deletedAt: true } },
      },
    });
    if (!user || user.status === 'SUSPENDED' || user.status === 'INACTIVE') return null;
    if (user.role !== 'SUPER_ADMIN' && user.society?.status !== 'ACTIVE') return null;

    const sid = user.societyId;
    const role = String(user.role);
    const rooms = [`society:${sid}`];
    if (['ADMIN', 'BUILDING_ADMIN', 'SUPER_ADMIN'].includes(role)) rooms.push(`society:${sid}:admin`);
    if (SOS_RESPONDER_ROLES.includes(role)) rooms.push(`society:${sid}:responders`);
    if (user.resident && !user.resident.deletedAt) {
      rooms.push(`society:${sid}:resident:${userId}`, `resident:${user.resident.id}`);
    }
    if (user.staffMember && !user.staffMember.deletedAt) {
      const staffId = user.staffMember.id;
      rooms.push(`society:${sid}:staff:${userId}`, `staff:${staffId}`);
      const groups = await this.prisma.staffMessageGroup.findMany({
        where: { societyId: sid, memberIds: { has: staffId } },
        select: { id: true },
      });
      for (const g of groups) rooms.push(`staff:msg:${g.id}`);
    }
    return { societyId: sid, role, rooms };
  }

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

      const membership = await this.roomsFor(payload.sub);
      if (!membership) {
        client.disconnect(true);
        return;
      }

      const c = client as AuthedSocket;
      c.data.userId = payload.sub;
      c.data.societyId = membership.societyId;
      c.data.role = membership.role;
      c.data.tokenExp = payload.exp || 0;
      await c.join(membership.rooms);

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

      this.logger.debug(
        `socket connected user=${payload.sub} role=${membership.role} society=${membership.societyId}`,
      );
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

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/sos', cors: { origin: '*' } })
export class SosGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join-society')
  handleJoin(@MessageBody() societyId: string, @ConnectedSocket() client: Socket) {
    client.join(`society:${societyId}`);
    return { joined: societyId };
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

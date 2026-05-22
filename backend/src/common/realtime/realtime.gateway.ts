import { Injectable, Logger } from '@nestjs/common';

/**
 * Realtime emission abstraction. Backed by Socket.io once EventsGateway calls
 * setServer(). Existing services consume this to remain transport-agnostic.
 */
export interface BufferedRealtimeEvent {
  at: string;
  societyId: string | null;
  event: string;
  payload: unknown;
}

@Injectable()
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);
  private server: any = null;
  private readonly eventRing: BufferedRealtimeEvent[] = [];
  private readonly ringMax = 500;

  setServer(server: any) {
    this.server = server;
  }

  private recordEvent(room: string, event: string, payload: unknown) {
    const m = /^society:([^:]+)/.exec(room);
    const societyId = m ? m[1] : null;
    let safe: unknown = null;
    try {
      safe = JSON.parse(JSON.stringify(payload));
    } catch {
      safe = { _unserializable: true };
    }
    this.eventRing.push({ at: new Date().toISOString(), societyId, event, payload: safe });
    if (this.eventRing.length > this.ringMax) this.eventRing.shift();
  }

  /** Last buffered socket emissions for client resync (`GET /realtime/events`). */
  getBufferedEvents(sinceIso: string | undefined | null, societyId: string): BufferedRealtimeEvent[] {
    const sinceMs = sinceIso ? Date.parse(sinceIso) : 0;
    if (Number.isNaN(sinceMs)) return [];
    return this.eventRing.filter(
      (e) =>
        (!e.societyId || e.societyId === societyId) && Date.parse(e.at) > sinceMs,
    );
  }

  /** Emit to a single room. */
  emit(room: string, event: string, payload: unknown) {
    this.recordEvent(room, event, payload);
    if (this.server && typeof this.server.to === 'function') {
      try {
        this.server.to(room).emit(event, payload);
        return;
      } catch (e) {
        this.logger.warn(`emit failed: ${(e as Error).message}`);
      }
    }
    this.logger.debug(`[realtime stub] room=${room} event=${event}`);
  }

  /** Emit same payload to multiple rooms simultaneously. */
  emitMany(rooms: string[], event: string, payload: unknown) {
    for (const room of rooms) this.recordEvent(room, event, payload);
    if (this.server && typeof this.server.to === 'function') {
      try {
        this.server.to(rooms).emit(event, payload);
        return;
      } catch (e) {
        this.logger.warn(`emitMany failed: ${(e as Error).message}`);
      }
    }
    rooms.forEach((r) => this.logger.debug(`[realtime stub] room=${r} event=${event}`));
  }

  /** Emit using a per-socket predicate (e.g. by role). */
  broadcast(predicate: (socket: any) => boolean, event: string, payload: unknown) {
    if (!this.server?.sockets?.sockets) {
      this.logger.debug(`[realtime stub] broadcast event=${event}`);
      return;
    }
    for (const [, s] of this.server.sockets.sockets) {
      try {
        if (predicate(s)) s.emit(event, payload);
      } catch {
        /* noop */
      }
    }
  }

  getConnectedCount(): number {
    return this.server?.sockets?.sockets?.size ?? 0;
  }

  // ── Society-scoped emit helpers ──────────────────────────────────────────────

  emitToSociety(societyId: string, event: string, data: unknown) {
    this.emit(`society:${societyId}`, event, data);
  }

  emitSosAlert(societyId: string, alert: unknown) {
    this.emitToSociety(societyId, 'sos:new', alert);
  }

  emitVisitorArrival(societyId: string, visitor: unknown) {
    this.emitToSociety(societyId, 'visitor:arrived', visitor);
  }

  emitServiceRequestUpdate(societyId: string, sr: unknown) {
    this.emitToSociety(societyId, 'service-request:updated', sr);
  }

  emitComplaintUpdate(societyId: string, complaint: unknown) {
    this.emitToSociety(societyId, 'complaint:updated', complaint);
  }

  emitMaintenanceDue(societyId: string, bill: unknown) {
    this.emitToSociety(societyId, 'maintenance:due', bill);
  }
}

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

/** The caller of the resync endpoint, as the JWT strategy resolved them. */
export interface RealtimeViewer {
  sub: string;
  societyId: string;
  role: string;
}

/** Roles that respond to an SOS and may receive its details. */
export const SOS_RESPONDER_ROLES: readonly string[] = ['STAFF', 'ADMIN', 'BUILDING_ADMIN', 'SUPER_ADMIN'];

/**
 * Whether `viewer` would have received an emission to `room`.
 *
 * Only society-prefixed rooms can be resolved without a database lookup:
 * the society-wide room, the admin room (admins only) and the viewer's own
 * per-user rooms. Everything else (`resident:<id>`, `staff:<id>`, chat
 * groups) is never replayed — it used to be replayed to EVERY caller from
 * every society, because events in unprefixed rooms were recorded with no
 * society and the filter let `societyId === null` through.
 */
export function viewerCanSeeRoom(viewer: RealtimeViewer, room: string): boolean {
  const base = `society:${viewer.societyId}`;
  if (room === base) return true;
  if (room === `${base}:admin`) {
    return ['ADMIN', 'BUILDING_ADMIN', 'SUPER_ADMIN'].includes(viewer.role);
  }
  if (room === `${base}:responders`) return SOS_RESPONDER_ROLES.includes(viewer.role);
  return room === `${base}:resident:${viewer.sub}` || room === `${base}:staff:${viewer.sub}`;
}

@Injectable()
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);
  private server: any = null;
  private readonly eventRing: (BufferedRealtimeEvent & { room: string })[] = [];
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
    this.eventRing.push({ at: new Date().toISOString(), room, societyId, event, payload: safe });
    if (this.eventRing.length > this.ringMax) this.eventRing.shift();
  }

  /** Last buffered socket emissions the viewer was entitled to (`GET /realtime/events`). */
  getBufferedEvents(sinceIso: string | undefined | null, viewer: RealtimeViewer): BufferedRealtimeEvent[] {
    const sinceMs = sinceIso ? Date.parse(sinceIso) : 0;
    if (Number.isNaN(sinceMs)) return [];
    return this.eventRing
      .filter((e) => Date.parse(e.at) > sinceMs && viewerCanSeeRoom(viewer, e.room))
      .map(({ room: _room, ...e }) => e);
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

  /**
   * A new or updated SOS carries the sender's name, flat and location, so it
   * goes to responders (staff and admins) only. It used to go to the whole
   * society room, which every resident's socket joins.
   */
  emitSosAlert(societyId: string, alert: unknown) {
    this.emit(`society:${societyId}:responders`, 'sos:new', alert);
  }

  /** An update about an SOS, for the person who raised it. */
  emitSosToOwner(societyId: string, ownerUserId: string, event: string, data: unknown) {
    this.emitMany(
      [`society:${societyId}:resident:${ownerUserId}`, `society:${societyId}:staff:${ownerUserId}`],
      event,
      data,
    );
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

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConciergeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';
import { S3Service } from '../../common/storage/s3.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { RESIDENT_BRIEF } from '../../common/prisma-selects';

/** Still open for a staff member to work on. */
const OPEN: ConciergeStatus[] = ['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'];

/**
 * Resident help requests (carry a parcel up, fetch a document, get a taxi), as
 * the STAFF app sees them.
 *
 * Residents create these through /concierge (ConciergeRequest) and admins
 * manage them there. The staff endpoints used to read service requests with
 * HELP_* categories instead — rows nothing ever creates — so every guard's
 * help-request list was empty, no one was notified, and accept/complete
 * worked on any request in the society regardless of who it belonged to.
 *
 * Rules: a staff member sees what is assigned to them plus unassigned
 * requests they could pick up; only the assigned staff member can act on a
 * request; picking one up is first-come (atomic), so two guards tapping
 * Accept at once can't both take it.
 */
@Injectable()
export class StaffHelpService {
  private readonly logger = new Logger(StaffHelpService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private s3: S3Service,
    private realtime: RealtimeGateway,
  ) {}

  private async staffIdOf(userId: string): Promise<string> {
    const staff = await this.prisma.staffMember.findUnique({ where: { userId }, select: { id: true } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff.id;
  }

  /** The request, if this staff member may see it (theirs, or open for pickup). */
  private async visible(requestId: string, staffId: string, societyId: string) {
    const req = await this.prisma.conciergeRequest.findFirst({
      where: {
        id: requestId,
        societyId,
        OR: [{ assignedStaffId: staffId }, { assignedStaffId: null, status: 'PENDING' }],
      },
      include: { resident: RESIDENT_BRIEF },
    });
    if (!req) throw new NotFoundException('Help request not found');
    return req;
  }

  /** Assigned to this staff member and still open — or a 403 explaining why not. */
  private async mine(requestId: string, staffId: string, societyId: string) {
    const req = await this.prisma.conciergeRequest.findFirst({ where: { id: requestId, societyId } });
    if (!req) throw new NotFoundException('Help request not found');
    if (req.assignedStaffId !== staffId) {
      throw new ForbiddenException({ code: 'NOT_YOUR_REQUEST', message: 'This request is not assigned to you.' });
    }
    return req;
  }

  async list(userId: string, societyId: string) {
    const staffId = await this.staffIdOf(userId);
    return this.prisma.conciergeRequest.findMany({
      where: {
        societyId,
        OR: [
          { assignedStaffId: staffId, status: { in: [...OPEN, 'COMPLETED'] } },
          { assignedStaffId: null, status: 'PENDING' },
        ],
      },
      include: { resident: RESIDENT_BRIEF },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(userId: string, requestId: string, societyId: string) {
    return this.visible(requestId, await this.staffIdOf(userId), societyId);
  }

  async accept(userId: string, requestId: string, societyId: string) {
    const staffId = await this.staffIdOf(userId);
    const { count } = await this.prisma.conciergeRequest.updateMany({
      where: {
        id: requestId,
        societyId,
        status: { in: ['PENDING', 'ASSIGNED'] },
        OR: [{ assignedStaffId: null }, { assignedStaffId: staffId }],
      },
      data: { assignedStaffId: staffId, status: 'ACCEPTED' },
    });
    const req = await this.prisma.conciergeRequest.findFirst({
      where: { id: requestId, societyId },
      include: { resident: RESIDENT_BRIEF },
    });
    if (!req) throw new NotFoundException('Help request not found');
    if (count === 0) {
      // Accepting twice (several devices show the button) is fine; losing the
      // race to a colleague is not an error the guard can fix, so say who won.
      if (req.assignedStaffId === staffId) return req;
      throw new ConflictException({
        code: 'ALREADY_TAKEN',
        message: 'Another staff member has already taken this request.',
      });
    }
    this.notifyResident(req.resident?.userId, requestId, 'ACCEPTED');
    return req;
  }

  /** Hand a request back to the pool. Not yours → no-op (a lockscreen tap on a stale push). */
  async decline(userId: string, requestId: string, societyId: string) {
    const staffId = await this.staffIdOf(userId);
    const req = await this.prisma.conciergeRequest.findFirst({ where: { id: requestId, societyId } });
    if (!req) throw new NotFoundException('Help request not found');
    if (req.assignedStaffId !== staffId || !OPEN.includes(req.status)) return req;
    return this.prisma.conciergeRequest.update({
      where: { id: requestId },
      data: { assignedStaffId: null, status: 'PENDING' },
    });
  }

  async start(userId: string, requestId: string, societyId: string) {
    const req = await this.mine(requestId, await this.staffIdOf(userId), societyId);
    if (req.status === 'IN_PROGRESS') return req;
    if (req.status !== 'ASSIGNED' && req.status !== 'ACCEPTED') {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: `This request is ${req.status.toLowerCase()}.` });
    }
    return this.prisma.conciergeRequest.update({ where: { id: requestId }, data: { status: 'IN_PROGRESS' } });
  }

  /**
   * Finish a request with an optional photo and notes. The route used to take
   * no body at all, so the photo and notes the app sent were thrown away.
   */
  async complete(
    userId: string,
    requestId: string,
    societyId: string,
    body: { photoUrl?: string; notes?: string },
  ) {
    const req = await this.mine(requestId, await this.staffIdOf(userId), societyId);
    if (req.status === 'COMPLETED') return req;
    if (!OPEN.includes(req.status)) {
      throw new ConflictException({ code: 'INVALID_TRANSITION', message: `This request is ${req.status.toLowerCase()}.` });
    }
    const updated = await this.prisma.conciergeRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        ...(body.photoUrl ? { completionPhotoUrl: this.s3.publicUrlFor(body.photoUrl) } : {}),
        ...(body.notes?.trim() ? { completionNotes: body.notes.trim().slice(0, 1000) } : {}),
      },
      include: { resident: RESIDENT_BRIEF },
    });
    this.realtime.emit(`resident:${req.residentId}`, 'help:completed', { requestId });
    this.notifyResident(updated.resident?.userId, requestId, 'COMPLETED');
    return updated;
  }

  private notifyResident(userId: string | undefined, requestId: string, status: 'ACCEPTED' | 'COMPLETED') {
    if (!userId) return;
    const body =
      status === 'ACCEPTED'
        ? 'A staff member has taken your request and is on the way.'
        : 'Your request has been completed. Tap to rate the help you got.';
    void this.push
      .send(
        userId,
        { title: 'Help request update', body, category: 'daily_help', collapseKey: `concierge:${requestId}` },
        {
          type: status === 'COMPLETED' ? 'CONCIERGE_COMPLETED' : 'CONCIERGE_UPDATED',
          entityId: requestId,
          requestId,
          status,
        },
      )
      .catch((e) => this.logger.warn(`help request push failed id=${requestId}: ${(e as Error).message}`));
  }
}

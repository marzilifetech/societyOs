import { Injectable, NotFoundException, BadRequestException, ForbiddenException, GoneException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { PushService } from '../../common/notification/push.service';
import { WhatsAppService } from '../../common/notification/whatsapp.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { requireOwnedById } from '../../common/tenancy/require-owned.util';
import { BroadcastDto, UpdateNoticeDto } from './dto/notice.dto';

@Injectable()
export class NoticeService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private push: PushService,
    private whatsapp: WhatsAppService,
  ) {}

  async getNotices(
    societyId: string,
    opts?: { onlyPinned?: boolean; limit?: number },
  ) {
    return this.prisma.notice.findMany({
      where: {
        societyId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...(opts?.onlyPinned ? { isPinned: true } : {}),
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      ...(opts?.limit ? { take: opts.limit } : {}),
    });
  }

  async createNotice(societyId: string, data: any) {
    const { category, ...rest } = data;

    const notice = await this.prisma.notice.create({
      data: { societyId, category, ...rest, publishedAt: new Date() },
    });

    // WhatsApp side-effect: notify all residents with phone numbers
    // TODO: enable once WhatsApp/Twilio is configured (TWILIO_ACCOUNT_SID etc.)
    void this.prisma.user
      .findMany({ where: { societyId, role: 'RESIDENT' }, select: { phone: true } })
      .then((users) => {
        const phones = users.map((u) => u.phone).filter(Boolean) as string[];
        if (phones.length > 0) {
          const body = `[${category ?? 'Notice'}] ${notice.title}: ${notice.body ?? ''}`.slice(0, 1000);
          void this.whatsapp.broadcastToSociety(phones, body);
        }
      });

    return notice;
  }

  async broadcastEmergency(societyId: string, dto: BroadcastDto) {
    const notice = await this.prisma.notice.create({
      data: {
        societyId,
        title: dto.title,
        body: dto.message,
        category: 'EMERGENCY',
        isPinned: dto.severity === 'EMERGENCY',
        publishedAt: new Date(),
      },
    });

    const sentAt = notice.publishedAt!.toISOString();
    this.realtime.emitToSociety(societyId, 'emergency:broadcast', {
      title: dto.title,
      message: dto.message,
      severity: dto.severity,
      sentAt,
    });

    await this.push.sendToSociety(
      societyId,
      'RESIDENT',
      {
        title: dto.title,
        body: dto.message,
        critical: dto.severity === 'EMERGENCY',
        category: 'emergency',
      },
      { type: 'EMERGENCY_BROADCAST', noticeId: notice.id, severity: dto.severity },
    );

    return notice;
  }

  async getEmergencyBroadcasts(societyId: string, limit = 5) {
    return this.prisma.notice.findMany({
      where: { societyId, category: 'EMERGENCY' },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  async getPolls(societyId: string) {
    const polls = await this.prisma.poll.findMany({
      where: { societyId, deadline: { gt: new Date() } },
      include: { _count: { select: { votes: true } } },
    });

    return polls.map((poll) => ({
      ...poll,
      options: Array.isArray(poll.options) ? poll.options : [],
      voteCount: poll._count.votes,
    }));
  }

  async vote(pollId: string, userId: string, societyId: string, selectedOptions: number[]) {
    if (!Array.isArray(selectedOptions) || selectedOptions.length === 0) {
      throw new BadRequestException({
        code: 'VOTE_EMPTY',
        message: 'Select at least one option',
      });
    }

    const resident = await requireResidentByUserId(this.prisma, userId);
    if (resident.user.societyId !== societyId) {
      throw new ForbiddenException({ code: 'RESIDENT_SOCIETY_MISMATCH', message: 'Resident is not in this society context' });
    }

    const poll = await this.prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.societyId !== societyId) {
      throw new ForbiddenException({ code: 'POLL_SOCIETY_MISMATCH', message: 'Poll belongs to another society' });
    }
    if (poll.deadline.getTime() <= Date.now()) {
      throw new GoneException({ code: 'POLL_CLOSED', message: 'Voting has closed for this poll' });
    }

    const options = Array.isArray(poll.options) ? (poll.options as string[]) : [];
    if (options.length === 0) {
      throw new BadRequestException({ code: 'POLL_MISCONFIGURED', message: 'Poll has no options' });
    }

    const uniqueIdx = [...new Set(selectedOptions)];
    for (const idx of uniqueIdx) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
        throw new BadRequestException({
          code: 'INVALID_OPTION_INDEX',
          message: `Invalid option index: ${idx}`,
          maxIndex: options.length - 1,
        });
      }
    }

    return this.prisma.pollVote.upsert({
      where: { pollId_residentId: { pollId, residentId: resident.id } },
      create: { pollId, residentId: resident.id, selectedOptions: uniqueIdx },
      update: { selectedOptions: uniqueIdx },
    });
  }

  async getPollResults(pollId: string, societyId: string) {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.societyId !== societyId) {
      throw new ForbiddenException({ code: 'POLL_SOCIETY_MISMATCH', message: 'Poll belongs to another society' });
    }
    const options = Array.isArray(poll.options) ? (poll.options as string[]) : [];
    const votes = await this.prisma.pollVote.findMany({ where: { pollId } });
    const total = votes.length;

    const counts: Record<number, number> = {};
    for (const vote of votes) {
      const selected = Array.isArray(vote.selectedOptions) ? (vote.selectedOptions as number[]) : [];
      for (const idx of selected) {
        counts[idx] = (counts[idx] ?? 0) + 1;
      }
    }

    return {
      options: options.map((text, idx) => ({
        text,
        count: counts[idx] ?? 0,
        percentage: total > 0 ? Math.round(((counts[idx] ?? 0) / total) * 100) : 0,
      })),
    };
  }

  async deleteNotice(id: string, societyId: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');
    if (notice.societyId !== societyId) throw new ForbiddenException('Notice belongs to another society');
    return this.prisma.notice.delete({ where: { id } });
  }

  async updateNotice(id: string, societyId: string, dto: UpdateNoticeDto) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');
    if (notice.societyId !== societyId) throw new ForbiddenException('Notice belongs to another society');
    const { category, ...rest } = dto as any;
    return this.prisma.notice.update({
      where: { id },
      data: { ...(category !== undefined ? { category } : {}), ...rest },
    });
  }

  /**
   * Explicit pin (always sets isPinned=true). Symmetric with unpinNotice
   * (which sets false). The earlier `togglePin` flipped state on each call,
   * which is racy when two admins click simultaneously: both see "unpinned"
   * → both toggle to "pinned" → second click silently no-ops. Explicit
   * set-true / set-false keeps the result deterministic regardless of order.
   */
  async pinNotice(id: string, societyId: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');
    if (notice.societyId !== societyId) throw new ForbiddenException('Notice belongs to another society');
    return this.prisma.notice.update({
      where: { id },
      data: { isPinned: true },
    });
  }

  // ── Admin methods ────────────────────────────────────────────────────────────

  async createPoll(
    societyId: string,
    dto: { question: string; options: string[]; deadline: string; isAnonymous: boolean },
  ) {
    return this.prisma.poll.create({
      data: {
        societyId,
        question: dto.question,
        options: dto.options,
        deadline: new Date(dto.deadline),
        isAnonymous: dto.isAnonymous,
      },
    });
  }

  async getAllPolls(societyId: string) {
    const polls = await this.prisma.poll.findMany({
      where: { societyId },
      include: { _count: { select: { votes: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return polls.map((poll) => ({
      ...poll,
      options: Array.isArray(poll.options) ? poll.options : [],
      voteCount: poll._count.votes,
    }));
  }

  async closePoll(pollId: string, societyId: string) {
    await requireOwnedById(
      () => this.prisma.poll.findUnique({ where: { id: pollId } }),
      societyId,
      'Poll',
    );
    return this.prisma.poll.update({ where: { id: pollId }, data: { deadline: new Date() } });
  }

  // ── Property admin methods ───────────────────────────────────────────────────

  async getPropertyListings(societyId: string, status?: string) {
    return this.prisma.propertyListing.findMany({
      where: { societyId, ...(status ? { status: status as any } : {}) },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approvePropertyListing(id: string, societyId: string) {
    await requireOwnedById(
      () => this.prisma.propertyListing.findUnique({ where: { id } }),
      societyId,
      'Property listing',
    );
    return this.prisma.propertyListing.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async rejectPropertyListing(id: string, societyId: string, reason?: string) {
    await requireOwnedById(
      () => this.prisma.propertyListing.findUnique({ where: { id } }),
      societyId,
      'Property listing',
    );
    return this.prisma.propertyListing.update({
      where: { id },
      data: { status: 'WITHDRAWN', ...(reason ? { description: reason } : {}) },
    });
  }

  // ── Travel admin methods ─────────────────────────────────────────────────────

  async getTravelPauses(societyId: string, status?: string) {
    return this.prisma.travelPause.findMany({
      where: {
        resident: { user: { societyId } },
        ...(status ? { status: status as any } : {}),
      },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveTravelPause(id: string) {
    return this.prisma.travelPause.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async rejectTravelPause(id: string) {
    return this.prisma.travelPause.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // ── Resident Travel Pause methods ─────────────────────────

  async createTravelPause(
    userId: string,
    societyId: string,
    dto: { startDate: string; returnDate: string; servicesPaused: string[]; reason?: string },
  ) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    if (resident.flat.societyId !== societyId) {
      throw new ForbiddenException({
        code: 'TRAVEL_SOCIETY_MISMATCH',
        message: 'Travel pause must be created in your society context',
      });
    }

    const startDate = new Date(dto.startDate);
    const returnDate = new Date(dto.returnDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(returnDate.getTime())) {
      throw new BadRequestException({ code: 'INVALID_DATE', message: 'Invalid start or return date' });
    }
    if (returnDate < startDate) {
      throw new BadRequestException({
        code: 'INVALID_RANGE',
        message: 'Return date must be on or after start date',
      });
    }

    const overlap = await this.prisma.travelPause.findFirst({
      where: {
        residentId: resident.id,
        status: { in: ['PENDING', 'ACTIVE'] },
        AND: [{ startDate: { lte: returnDate } }, { returnDate: { gte: startDate } }],
      },
    });
    if (overlap) {
      throw new ConflictException({
        code: 'TRAVEL_OVERLAP',
        message: 'Another travel pause overlaps these dates',
        conflictingId: overlap.id,
      });
    }

    return this.prisma.travelPause.create({
      data: {
        residentId: resident.id,
        startDate,
        returnDate,
        servicesPaused: Array.isArray(dto.servicesPaused) ? dto.servicesPaused : [],
        ...(dto.reason ? { reason: dto.reason.slice(0, 500) } : {}),
      },
      include: { resident: { include: { user: true, flat: true } } },
    });
  }

  async getMyTravelPauses(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.travelPause.findMany({
      where: { residentId: resident.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reportTravelReturn(userId: string, pauseId: string, actualReturnDate: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.travelPause.update({
      where: { id: pauseId, residentId: resident.id },
      data: {
        status: 'COMPLETED' as any,
        actualReturnDate: new Date(actualReturnDate),
      },
    });
  }

  // ── Resident Property Listing methods ──────────────────────

  async createPropertyListing(
    userId: string,
    societyId: string,
    dto: { areaSqft: number; price: number; furnished: boolean; description?: string },
  ) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    if (resident.flat.societyId !== societyId) {
      throw new ForbiddenException({
        code: 'PROPERTY_SOCIETY_MISMATCH',
        message: 'Listing must be created in your society context',
      });
    }
    return this.prisma.propertyListing.create({
      data: {
        residentId: resident.id,
        societyId,
        areaSqft: dto.areaSqft,
        price: dto.price as any,
        furnished: dto.furnished,
        description: dto.description,
      },
      include: { resident: { include: { user: true, flat: true } } },
    });
  }

  async getMyListingsFromUser(userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    return this.prisma.propertyListing.findMany({
      where: { residentId: resident.id },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllListingsForSociety(societyId: string) {
    return this.prisma.propertyListing.findMany({
      where: { status: 'ACTIVE', societyId },
      include: { resident: { include: { user: true, flat: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async expressPropertyInterest(userId: string, societyId: string, listingId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    if (resident.flat.societyId !== societyId) {
      throw new ForbiddenException({
        code: 'LISTING_SOCIETY_MISMATCH',
        message: 'Listing interest must use your society context',
      });
    }

    const listing = await this.prisma.propertyListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.societyId !== societyId) {
      throw new ForbiddenException({ code: 'LISTING_OTHER_SOCIETY', message: 'Listing is in another society' });
    }
    if (listing.status !== 'ACTIVE') {
      throw new GoneException({
        code: 'LISTING_UNAVAILABLE',
        message: 'This listing is no longer available',
        status: listing.status,
      });
    }
    if (listing.residentId === resident.id) {
      throw new BadRequestException({
        code: 'LISTING_OWNED',
        message: 'Cannot express interest on your own listing',
      });
    }

    return this.prisma.propertyInterest.upsert({
      where: { listingId_residentId: { listingId, residentId: resident.id } },
      create: { listingId, residentId: resident.id },
      update: {},
      include: { resident: { include: { user: true, flat: true } } },
    });
  }
}

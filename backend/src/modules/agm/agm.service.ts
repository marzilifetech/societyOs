import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AgmMeetingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../../common/notification/push.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { VoteDto, VoteChoice, CreateResolutionDto } from './dto/agm.dto';

@Injectable()
export class AgmService {
  private readonly logger = new Logger(AgmService.name);
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async getMeetings(societyId: string) {
    const meetings = await this.prisma.agmMeeting.findMany({
      where: { societyId },
      include: { resolutions: true },
      orderBy: { date: 'desc' },
    });
    return meetings.map((m) => this.decorateMeeting(m));
  }

  /**
   * Create an AGM / general-body meeting.
   *
   * There was NO create endpoint at all — the admin screen POSTed
   * /agm/meetings and got a 404 back, which is the "Cannot create a meeting"
   * report. Notifying residents is part of scheduling a general-body meeting,
   * so it happens here rather than being a separate step someone must remember.
   */
  async createMeeting(
    societyId: string,
    dto: { title: string; date: string; agenda?: string[]; status?: AgmMeetingStatus },
  ) {
    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException({ code: 'TITLE_REQUIRED', message: 'Meeting title is required' });
    }
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException({ code: 'INVALID_DATE', message: 'A valid meeting date is required' });
    }

    const meeting = await this.prisma.agmMeeting.create({
      data: {
        societyId,
        title,
        date,
        agenda: (dto.agenda ?? []) as any,
        status: dto.status ?? AgmMeetingStatus.UPCOMING,
      },
      include: { resolutions: true },
    });

    void this.push
      ?.sendToSociety(
        societyId,
        'RESIDENT',
        {
          title: `Meeting scheduled: ${meeting.title}`,
          body: `${meeting.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} \u2014 view the agenda in the app.`,
          category: 'community',
          collapseKey: `agm:${meeting.id}`,
        },
        { type: 'AGM_MEETING_CREATED', entityId: meeting.id, meetingId: meeting.id },
      )
      .catch((e: Error) => this.logger.warn(`agm meeting push failed meeting=${meeting.id}: ${e.message}`));

    return this.decorateMeeting(meeting);
  }

  async updateMeeting(
    id: string,
    societyId: string,
    dto: { title?: string; date?: string; agenda?: string[]; status?: AgmMeetingStatus; minutesUrl?: string },
  ) {
    const existing = await this.prisma.agmMeeting.findFirst({ where: { id, societyId } });
    if (!existing) throw new NotFoundException('Meeting not found');

    const data: Record<string, any> = {};
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException({ code: 'TITLE_REQUIRED', message: 'Meeting title is required' });
      data.title = title;
    }
    if (dto.date !== undefined) {
      const date = new Date(dto.date);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException({ code: 'INVALID_DATE', message: 'A valid meeting date is required' });
      }
      data.date = date;
    }
    if (dto.agenda !== undefined) data.agenda = dto.agenda as any;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.minutesUrl !== undefined) data.minutesUrl = dto.minutesUrl || null;

    const updated = await this.prisma.agmMeeting.update({
      where: { id },
      data,
      include: { resolutions: true },
    });
    return this.decorateMeeting(updated);
  }

  /**
   * Shapes a meeting for admin/resident lists.
   *
   * `AgmResolution` has no `votingDeadline` column — `createResolution` stashes
   * it in the `votes` JSON under the reserved `__deadline` key. Surfacing it
   * here is what lets the admin screen render a deadline instead of
   * `undefined`. It also strips the raw ballot: `votes` is a map of
   * residentId -> choice, and returning it wholesale leaked every resident's
   * individual vote to any caller.
   */
  private decorateMeeting<T extends { resolutions?: any[] }>(meeting: T) {
    if (!Array.isArray(meeting.resolutions)) return meeting;
    return {
      ...meeting,
      resolutions: meeting.resolutions.map((r) => this.decorateResolution(r)),
    };
  }

  private decorateResolution(resolution: any) {
    const raw = (resolution?.votes as Record<string, any>) ?? {};
    const counts = { FOR: 0, AGAINST: 0, ABSTAIN: 0, total: 0 };
    for (const [key, value] of Object.entries(raw)) {
      if (key === '__proxies' || key === '__deadline') continue;
      const vote = value as string;
      if (vote === 'FOR' || vote === 'AGAINST' || vote === 'ABSTAIN') {
        counts[vote] += 1;
        counts.total += 1;
      }
    }
    const { votes: _omitted, ...rest } = resolution ?? {};
    return {
      ...rest,
      votingDeadline: raw.__deadline ?? null,
      voteSummary: counts,
    };
  }

  async getMeeting(id: string) {
    const meeting = await this.prisma.agmMeeting.findUnique({
      where: { id },
      include: { resolutions: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async vote(meetingId: string, userId: string, dto: VoteDto) {
    await this.getMeeting(meetingId);
    const resident = await requireResidentByUserId(this.prisma, userId);

    const resolution = await this.prisma.agmResolution.findUnique({ where: { id: dto.resolutionId } });
    if (!resolution || resolution.meetingId !== meetingId) {
      throw new NotFoundException('Resolution not found in this meeting');
    }

    const currentVotes = (resolution.votes as Record<string, string>) ?? {};
    // Idempotent: overwrite existing vote
    currentVotes[resident.id] = dto.vote;

    return this.prisma.agmResolution.update({
      where: { id: dto.resolutionId },
      data: { votes: currentVotes },
    });
  }

  async getResults(meetingId: string) {
    const meeting = await this.getMeeting(meetingId);
    return meeting.resolutions.map((resolution) => {
      const votes = (resolution.votes as Record<string, any>) ?? {};
      const counts = { FOR: 0, AGAINST: 0, ABSTAIN: 0, total: 0 };
      for (const [key, vote] of Object.entries(votes)) {
        if (key === '__proxies') continue;
        counts[vote as keyof typeof counts]++;
        counts.total++;
      }
      return { ...resolution, voteSummary: counts };
    });
  }

  async getMeetingWithMyVotes(meetingId: string, userId: string) {
    const meeting = await this.prisma.agmMeeting.findUnique({
      where: { id: meetingId },
      include: { resolutions: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const resident = await requireResidentByUserId(this.prisma, userId);

    const resolutions = meeting.resolutions.map((resolution) => {
      const allData = (resolution.votes as Record<string, any>) ?? {};
      const proxies: Record<string, string> = allData['__proxies'] ?? {};
      const counts = { FOR: 0, AGAINST: 0, ABSTAIN: 0, total: 0 };
      for (const [key, vote] of Object.entries(allData)) {
        if (key === '__proxies') continue;
        counts[vote as keyof typeof counts]++;
        counts.total++;
      }
      return {
        ...resolution,
        voteSummary: counts,
        myVote: allData[resident.id] ?? null,
        myProxy: proxies[resident.id] ?? null,
      };
    });

    return { ...meeting, resolutions };
  }

  async castResolutionVote(resolutionId: string, userId: string, vote: VoteChoice) {
    const resolution = await this.prisma.agmResolution.findUnique({ where: { id: resolutionId } });
    if (!resolution) throw new NotFoundException('Resolution not found');

    const meeting = await this.prisma.agmMeeting.findUnique({ where: { id: resolution.meetingId } });
    if (!meeting || meeting.status === 'COMPLETED') {
      throw new BadRequestException('Voting is closed for this meeting');
    }

    const resident = await requireResidentByUserId(this.prisma, userId);
    const currentVotes = (resolution.votes as Record<string, any>) ?? {};

    if (currentVotes[resident.id]) {
      throw new ConflictException('You have already voted on this resolution');
    }

    currentVotes[resident.id] = vote;

    const updated = await this.prisma.agmResolution.update({
      where: { id: resolutionId },
      data: { votes: currentVotes },
    });

    const counts = { FOR: 0, AGAINST: 0, ABSTAIN: 0, total: 0 };
    for (const [key, v] of Object.entries(currentVotes)) {
      if (key === '__proxies') continue;
      counts[v as keyof typeof counts]++;
      counts.total++;
    }

    return { ...updated, voteSummary: counts };
  }

  async createResolution(societyId: string, dto: CreateResolutionDto) {
    const meeting = await this.prisma.agmMeeting.findUnique({ where: { id: dto.meetingId } });
    if (!meeting || meeting.societyId !== societyId) {
      throw new NotFoundException('Meeting not found');
    }
    if (meeting.status === 'COMPLETED') {
      throw new BadRequestException('Cannot add resolutions to a completed meeting');
    }

    // Schema has no votingDeadline column on AgmResolution; stash inside the
    // votes JSON under reserved key "__deadline" (mirrors "__proxies" pattern).
    return this.prisma.agmResolution.create({
      data: {
        meetingId: dto.meetingId,
        title: dto.title,
        description: dto.description ?? '',
        votes: { __deadline: dto.votingDeadline },
      },
    });
  }

  async assignProxy(resolutionId: string, userId: string, proxyResidentId: string) {
    const resolution = await this.prisma.agmResolution.findUnique({ where: { id: resolutionId } });
    if (!resolution) throw new NotFoundException('Resolution not found');

    const meeting = await this.prisma.agmMeeting.findUnique({ where: { id: resolution.meetingId } });
    if (!meeting || meeting.status === 'COMPLETED') {
      throw new BadRequestException('Proxy assignment is closed for this meeting');
    }

    const resident = await requireResidentByUserId(this.prisma, userId);

    const proxyResident = await this.prisma.resident.findUnique({ where: { id: proxyResidentId } });
    if (!proxyResident) throw new NotFoundException('Proxy resident not found');

    if (resident.id === proxyResidentId) {
      throw new BadRequestException('Cannot assign yourself as proxy');
    }

    // Store proxies in the votes JSON under the reserved key "__proxies"
    const currentVotes = (resolution.votes as Record<string, any>) ?? {};
    const currentProxies: Record<string, string> = currentVotes['__proxies'] ?? {};
    currentProxies[resident.id] = proxyResidentId;
    currentVotes['__proxies'] = currentProxies;

    await this.prisma.agmResolution.update({
      where: { id: resolutionId },
      data: { votes: currentVotes },
    });

    return {
      resolutionId,
      assignedBy: resident.id,
      proxyResidentId,
      message: 'Proxy assigned successfully',
    };
  }
}

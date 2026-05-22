import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { VoteDto, VoteChoice, CreateResolutionDto } from './dto/agm.dto';

@Injectable()
export class AgmService {
  constructor(private prisma: PrismaService) {}

  async getMeetings(societyId: string) {
    return this.prisma.agmMeeting.findMany({
      where: { societyId },
      include: { resolutions: true },
      orderBy: { date: 'desc' },
    });
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

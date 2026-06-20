import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireResidentByUserId } from '../../common/utils/resident-context';
import { PushService } from '../../common/notification/push.service';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async getEvents(societyId: string, userId?: string) {
    const resident = userId ? await requireResidentByUserId(this.prisma, userId) : null;
    const events = await this.prisma.event.findMany({
      where: { societyId, status: 'PUBLISHED' },
      include: {
        _count: { select: { registrations: true } },
        registrations: resident
          ? {
              where: { residentId: resident.id },
              take: 1,
            }
          : false,
      },
      orderBy: { date: 'asc' },
    });

    return events.map((event) => ({
      ...event,
      category: event.category ?? 'OTHER',
      eventDate: event.date,
      eventTime: event.date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      registrationCount: event._count.registrations,
      myRegistration: resident
        ? event.registrations[0]
          ? { status: event.registrations[0].waitlisted ? 'WAITLISTED' : 'REGISTERED' }
          : null
        : null,
    }));
  }

  async getEvent(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { _count: { select: { registrations: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async register(eventId: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const event = await this.getEvent(eventId);
    const registrationCount = await this.prisma.eventRegistration.count({ where: { eventId } });
    const waitlisted = event.capacity != null && registrationCount >= event.capacity;

    try {
      return await this.prisma.eventRegistration.create({
        data: { eventId, residentId: resident.id, waitlisted },
      });
    } catch {
      throw new ConflictException('Already registered');
    }
  }

  async cancelRegistration(eventId: string, userId: string) {
    const resident = await requireResidentByUserId(this.prisma, userId);
    const deleted = await this.prisma.eventRegistration.delete({
      where: { eventId_residentId: { eventId, residentId: resident.id } },
    });

    // Auto-promote first waitlisted person when a confirmed spot opens up
    if (!deleted.waitlisted) {
      const nextInLine = await this.prisma.eventRegistration.findFirst({
        where: { eventId, waitlisted: true },
        orderBy: { registeredAt: 'asc' },
      });
      if (nextInLine) {
        const promoted = await this.prisma.eventRegistration.update({
          where: { id: nextInLine.id },
          data: { waitlisted: false },
          include: { resident: { select: { userId: true } }, event: { select: { title: true } } },
        });
        const promotedUserId = promoted.resident?.userId;
        if (promotedUserId) {
          const eventTitle = promoted.event?.title ?? 'the event';
          void this.push
            .send(
              promotedUserId,
              {
                title: 'You\'re off the waitlist',
                body: `A spot opened up — you're now registered for ${eventTitle}.`,
                category: 'community',
                collapseKey: `event:${eventId}:promote`,
              },
              { type: 'EVENT_WAITLIST_PROMOTED', entityId: eventId, eventId },
            )
            .catch((e) => this.logger.warn(`event waitlist push failed event=${eventId}: ${(e as Error).message}`));
        }
      }
    }

    return deleted;
  }

  async create(societyId: string, data: any) {
    const event = await this.prisma.event.create({
      data: {
        societyId,
        title: data.title,
        description: data.description,
        category: data.category,
        date: new Date(data.date),
        venue: data.venue ?? 'Community Hall',
        capacity: data.capacity,
        imageUrl: data.imageUrl,
        status: 'PUBLISHED',
      },
    });

    void this.push
      .sendToSociety(
        societyId,
        'RESIDENT',
        {
          title: `New event: ${event.title}`,
          body: event.description?.trim() || `${event.venue} · ${event.date.toLocaleDateString('en-IN')}`,
          category: 'community',
          collapseKey: `event:${event.id}`,
        },
        { type: 'EVENT_CREATED', entityId: event.id, eventId: event.id },
      )
      .catch((e) => this.logger.warn(`event created push failed event=${event.id}: ${(e as Error).message}`));

    return event;
  }

  async cancelEvent(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const updated = await this.prisma.event.update({ where: { id }, data: { status: 'CANCELLED' } });

    void (async () => {
      const registrations = await this.prisma.eventRegistration.findMany({
        where: { eventId: id },
        include: { resident: { select: { userId: true } } },
      });
      for (const reg of registrations) {
        const userId = reg.resident?.userId;
        if (!userId) continue;
        void this.push
          .send(
            userId,
            {
              title: 'Event cancelled',
              body: `"${event.title}" has been cancelled.`,
              category: 'community',
              collapseKey: `event:${id}:cancel`,
            },
            { type: 'EVENT_CANCELLED', entityId: id, eventId: id },
          )
          .catch((e) => this.logger.warn(`event cancelled push failed event=${id}: ${(e as Error).message}`));
      }
    })().catch((e) => this.logger.warn(`event cancelled fanout failed event=${id}: ${(e as Error).message}`));

    return updated;
  }

  async update(id: string, data: any) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        ...(data.date ? { date: new Date(data.date) } : {}),
        venue: data.venue,
        capacity: data.capacity,
      },
    });
  }

  async remove(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.eventRegistration.deleteMany({ where: { eventId: id } });
    await this.prisma.eventFeedback.deleteMany({ where: { eventId: id } });
    return this.prisma.event.delete({ where: { id } });
  }

  async submitFeedback(eventId: string, userId: string, rating: number, comment?: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const resident = await requireResidentByUserId(this.prisma, userId);
    const existing = await this.prisma.eventFeedback.findFirst({
      where: { eventId, residentId: resident.id },
    });
    if (existing) {
      return this.prisma.eventFeedback.update({
        where: { id: existing.id },
        data: { rating, comment },
      });
    }
    return this.prisma.eventFeedback.create({
      data: { eventId, residentId: resident.id, rating, comment },
    });
  }
}

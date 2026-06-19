import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { findResidentByUserId, requireResidentByUserId } from '../../common/utils/resident-context';

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}

  async getEvents(societyId: string, userId?: string) {
    const resident = userId ? await findResidentByUserId(this.prisma, userId) : null;
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
        await this.prisma.eventRegistration.update({
          where: { id: nextInLine.id },
          data: { waitlisted: false },
        });
      }
    }

    return deleted;
  }

  async create(societyId: string, data: any) {
    return this.prisma.event.create({
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
  }

  async cancelEvent(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.event.update({ where: { id }, data: { status: 'CANCELLED' } });
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

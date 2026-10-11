import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AmenityService } from './amenity.service';
import { CreateAmenityBookingDto } from './dto/amenity.dto';

describe('AmenityService', () => {
  const prisma: any = {
    resident: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', userId: 'u1', flat: {}, user: {} }) },
    amenity: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    amenityBooking: { findMany: jest.fn(), create: jest.fn() },
  };
  const push: any = { send: jest.fn().mockResolvedValue({ ok: true }) };
  const service = new AmenityService(prisma, push);
  const hall = { id: 'a1', societyId: 's1', name: 'Hall', isActive: true, capacity: 0, rules: null };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.amenity.findUnique.mockResolvedValue(hall);
    prisma.amenityBooking.findMany.mockResolvedValue([]);
    prisma.amenityBooking.create.mockImplementation(async ({ data }: any) => ({
      id: 'b1',
      ...data,
      amenity: hall,
    }));
  });

  it('accepts the shipped app booking body (startTime/endTime/notes, last slot ending 24:00)', async () => {
    const dto = plainToInstance(CreateAmenityBookingDto, {
      amenityId: 'a1',
      date: '2026-10-12',
      startTime: '23:00',
      endTime: '24:00',
      notes: 'Birthday',
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toEqual([]);

    await service.createBooking('u1', dto, 's1');
    expect(prisma.amenityBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ startSlot: '23:00', endSlot: '24:00' }) }),
    );
  });

  it('refuses an overlapping booking of a hall with no capacity set', async () => {
    prisma.amenityBooking.findMany.mockResolvedValue([{ guestCount: 1 }]);
    await expect(
      service.createBooking('u1', { amenityId: 'a1', date: '2026-10-12', startSlot: '18:00', endSlot: '19:00' }, 's1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'SLOT_TAKEN' }) });
  });

  it('lets overlapping bookings share an amenity up to its capacity', async () => {
    prisma.amenity.findUnique.mockResolvedValue({ ...hall, capacity: 10 });
    prisma.amenityBooking.findMany.mockResolvedValue([{ guestCount: 4 }]);
    await expect(
      service.createBooking('u1', { amenityId: 'a1', date: '2026-10-12', startSlot: '18:00', endSlot: '19:00', guestCount: 6 }, 's1'),
    ).resolves.toBeDefined();
    await expect(
      service.createBooking('u1', { amenityId: 'a1', date: '2026-10-12', startSlot: '18:00', endSlot: '19:00', guestCount: 7 }, 's1'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'SLOT_TAKEN' }) });
  });

  it("won't book another society's amenity", async () => {
    await expect(
      service.createBooking('u1', { amenityId: 'a1', date: '2026-10-12', startSlot: '18:00', endSlot: '19:00' }, 's2'),
    ).rejects.toThrow('Amenity not found');
  });

  it('shows amenities as bookable with hours from the admin schedule', async () => {
    prisma.amenity.findMany.mockResolvedValue([
      { ...hall, capacity: 40, rules: JSON.stringify({ openTime: '07:00', closeTime: '21:00', pricePerSlot: 500 }) },
    ]);
    const [a] = await service.findAll('s1');
    expect(a).toMatchObject({ status: 'AVAILABLE', availableFrom: '07:00', availableTo: '21:00', maxCapacity: 40, pricePerHour: 500 });
  });
});

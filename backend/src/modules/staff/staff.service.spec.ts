import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { StaffService } from './staff.service';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../common/storage/s3.service';
import { RealtimeGateway } from '../../common/realtime/realtime.gateway';
import { VisitorService } from '../visitor/visitor.service';

const mockPrisma = {
  staffMember: { findUnique: jest.fn(), update: jest.fn() },
  leaveRequest: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  flat: { findMany: jest.fn() },
  resident: { findFirst: jest.fn() },
  visitor: { findFirst: jest.fn() },
};

const mockVisitorService = {
  listForSociety: jest.fn(),
  approveVisitor: jest.fn(),
  rejectVisitor: jest.fn(),
};

describe('StaffService', () => {
  let service: StaffService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: {} },
        { provide: RealtimeGateway, useValue: { emit: jest.fn() } },
        { provide: VisitorService, useValue: mockVisitorService },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
    jest.clearAllMocks();

    mockPrisma.staffMember.findUnique.mockResolvedValue({
      id: 'staff-db-1',
      userId: 'user-1',
    });
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
  });

  describe('requestLeave', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z') });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('rejects leave starting before today', async () => {
      await expect(
        service.requestLeave('user-1', {
          type: 'CASUAL',
          startDate: '2026-06-14',
          endDate: '2026-06-16',
          reason: 'trip',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'PAST_DATE' }),
      });
      expect(mockPrisma.leaveRequest.findFirst).not.toHaveBeenCalled();
    });

    it('throws Conflict LEAVE_OVERLAP when another pending request overlaps dates', async () => {
      mockPrisma.leaveRequest.findFirst.mockResolvedValue({
        id: 'existing-leave',
        staffId: 'staff-db-1',
        status: 'PENDING',
      });

      await expect(
        service.requestLeave('user-1', {
          type: 'CASUAL',
          startDate: '2026-06-18',
          endDate: '2026-06-22',
          reason: 'break',
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.requestLeave('user-1', {
          type: 'CASUAL',
          startDate: '2026-06-18',
          endDate: '2026-06-22',
          reason: 'break',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'LEAVE_OVERLAP', conflictingId: 'existing-leave' }),
      });
      expect(mockPrisma.leaveRequest.create).not.toHaveBeenCalled();
    });
  });

  describe('visitor gate (security staff)', () => {
    it('isSecurityStaff detects SECURITY category', () => {
      expect(service.isSecurityStaff({ categories: ['SECURITY'], department: null })).toBe(true);
      expect(service.isSecurityStaff({ categories: [], department: 'SECURITY' })).toBe(true);
      expect(service.isSecurityStaff({ categories: ['PLUMBING'], department: 'MAINTENANCE' })).toBe(false);
    });

    it('getVisitorsForGate rejects non-security staff', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({
        id: 's1',
        categories: ['PLUMBING'],
        department: 'MAINTENANCE',
      });

      await expect(service.getVisitorsForGate('user-1', 'soc-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockVisitorService.listForSociety).not.toHaveBeenCalled();
    });

    it('getVisitorsForGate lists pending visitors for security staff', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({
        id: 's1',
        categories: ['SECURITY'],
        department: 'SECURITY',
      });
      mockVisitorService.listForSociety.mockResolvedValue([{ id: 'v1' }]);

      const rows = await service.getVisitorsForGate('user-1', 'soc-1', 'PENDING');

      expect(rows).toHaveLength(1);
      expect(mockVisitorService.listForSociety).toHaveBeenCalledWith('soc-1', {
        approvalStatus: 'PENDING',
        date: 'today',
      });
    });

    it('approveVisitorAsSecurity delegates to visitor service', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValue({
        id: 's1',
        categories: ['SECURITY'],
        department: 'SECURITY',
      });
      mockVisitorService.approveVisitor.mockResolvedValue({ id: 'v1', approvalStatus: 'APPROVED' });

      await service.approveVisitorAsSecurity('user-1', 'soc-1', 'v1');

      expect(mockVisitorService.approveVisitor).toHaveBeenCalledWith('v1', 'soc-1', 'user-1');
    });
  });

  describe('setProfilePhoto', () => {
    // Replaces the broken self-signed S3 PUT flow with a simple persist-the-URL
    // step. The staff app uploads via the Marzi /media proxy and then POSTs
    // here with the resulting public CDN URL. See backend/src/modules/staff/
    // staff.controller.ts -> POST /staff/profile/photo.

    it('persists the URL on the StaffMember row', async () => {
      mockPrisma.staffMember.update.mockResolvedValue({
        id: 'staff-db-1',
        photoUrl: 'https://cdn.marzi.test/avatars/abc.jpg',
      });

      const res = await service.setProfilePhoto('user-1', 'https://cdn.marzi.test/avatars/abc.jpg');

      expect(mockPrisma.staffMember.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { photoUrl: 'https://cdn.marzi.test/avatars/abc.jpg' },
        select: { id: true, photoUrl: true },
      });
      expect(res).toEqual({ ok: true, photoUrl: 'https://cdn.marzi.test/avatars/abc.jpg' });
    });

    it('rejects empty / non-http URLs with BadRequest', async () => {
      await expect(service.setProfilePhoto('user-1', '')).rejects.toThrow(/valid http/);
      await expect(service.setProfilePhoto('user-1', 'data:image/png;base64,...')).rejects.toThrow(/valid http/);
      await expect(service.setProfilePhoto('user-1', 'file:///tmp/x.jpg')).rejects.toThrow(/valid http/);
      // No update call should have been made for any of the above.
      expect(mockPrisma.staffMember.update).not.toHaveBeenCalled();
    });

    it('accepts http and https URLs equally', async () => {
      mockPrisma.staffMember.update.mockResolvedValue({ id: 'staff-db-1', photoUrl: 'http://x/y' });
      await expect(service.setProfilePhoto('user-1', 'http://x/y')).resolves.toBeTruthy();
      mockPrisma.staffMember.update.mockResolvedValue({ id: 'staff-db-1', photoUrl: 'https://x/y' });
      await expect(service.setProfilePhoto('user-1', 'https://x/y')).resolves.toBeTruthy();
    });

    it('404s when there is no StaffMember row for the user', async () => {
      mockPrisma.staffMember.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.setProfilePhoto('orphan-user', 'https://cdn.example/x.jpg'),
      ).rejects.toThrow(/staff profile not found/i);
    });
  });

  describe('Add Entry lookups', () => {
    // listFlatsForGate / lookupResidentByPhone / lookupVisitorByPhone — used by
    // the new "+ Add Entry" form on the staff app. PII guardrails: lookups
    // must never surface phone/email/document URLs in the response.

    describe('listFlatsForGate', () => {
      it('returns each flat with its primary resident name', async () => {
        mockPrisma.flat.findMany.mockResolvedValue([
          {
            id: 'flat-1',
            block: 'A',
            number: '302',
            residents: [{ id: 'r1', user: { name: 'Mr. Sharma' } }],
          },
          { id: 'flat-2', block: 'B', number: '101', residents: [] },
        ]);
        const out = await service.listFlatsForGate('soc1');
        expect(out).toEqual([
          {
            flatId: 'flat-1',
            block: 'A',
            number: '302',
            primaryResidentId: 'r1',
            primaryResidentName: 'Mr. Sharma',
          },
          {
            flatId: 'flat-2',
            block: 'B',
            number: '101',
            primaryResidentId: null,
            primaryResidentName: null,
          },
        ]);
        // Sort: prisma order is asc by block then number — assert the query
        // shape rather than the in-memory output.
        expect(mockPrisma.flat.findMany.mock.calls[0][0].orderBy).toEqual([
          { block: 'asc' },
          { number: 'asc' },
        ]);
      });

      it('does NOT include resident phone, email, or any document field', async () => {
        mockPrisma.flat.findMany.mockResolvedValue([]);
        await service.listFlatsForGate('soc1');
        const where = mockPrisma.flat.findMany.mock.calls[0][0];
        // Sanity: the include clause only picks user.name on the primary.
        const pickedFields = JSON.stringify(where.include);
        expect(pickedFields).not.toMatch(/phone/i);
        expect(pickedFields).not.toMatch(/email/i);
        expect(pickedFields).not.toMatch(/aadhaar/i);
      });
    });

    describe('lookupResidentByPhone', () => {
      it('returns the matched resident + flat coords on hit', async () => {
        mockPrisma.resident.findFirst.mockResolvedValue({
          id: 'r1',
          flat: { id: 'flat-1', block: 'A', number: '302' },
          user: { name: 'Mr. Sharma' },
        });
        const out = await service.lookupResidentByPhone('soc1', '+919999000001');
        expect(out).toEqual({
          residentId: 'r1',
          flatId: 'flat-1',
          block: 'A',
          number: '302',
          name: 'Mr. Sharma',
        });
      });

      it('rejects empty phone with 400 PHONE_REQUIRED', async () => {
        await expect(service.lookupResidentByPhone('soc1', '')).rejects.toThrow(/phone/i);
        await expect(service.lookupResidentByPhone('soc1', undefined)).rejects.toThrow(/phone/i);
        expect(mockPrisma.resident.findFirst).not.toHaveBeenCalled();
      });

      it('404s when no resident matches', async () => {
        mockPrisma.resident.findFirst.mockResolvedValue(null);
        await expect(service.lookupResidentByPhone('soc1', '+919999999999')).rejects.toThrow(
          /no resident/i,
        );
      });

      it('does an EXACT phone match (no substring probe)', async () => {
        mockPrisma.resident.findFirst.mockResolvedValue(null);
        await expect(service.lookupResidentByPhone('soc1', '999')).rejects.toThrow();
        const call = mockPrisma.resident.findFirst.mock.calls[0][0];
        // user.phone is set to the trimmed input, NOT a contains/startsWith.
        expect(call.where.user.phone).toBe('999');
      });
    });

    describe('lookupVisitorByPhone', () => {
      it('returns the last-known visitor (name + photo + type + partner)', async () => {
        mockPrisma.visitor.findFirst.mockResolvedValue({
          name: 'Amazon courier',
          photoUrl: 'https://cdn/x.jpg',
          type: 'DELIVERY',
          deliveryPartner: 'Amazon',
        });
        const out = await service.lookupVisitorByPhone('soc1', '+919876543210');
        expect(out).toEqual({
          name: 'Amazon courier',
          photoUrl: 'https://cdn/x.jpg',
          type: 'DELIVERY',
          deliveryPartner: 'Amazon',
        });
      });

      it('404s with VISITOR_NOT_FOUND when this phone has never visited', async () => {
        mockPrisma.visitor.findFirst.mockResolvedValue(null);
        await expect(service.lookupVisitorByPhone('soc1', '+919999999999')).rejects.toThrow(
          /never been seen|not been seen|visitor with that phone/i,
        );
      });
    });
  });
});

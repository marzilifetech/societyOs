import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VisitorService, DELIVERY_PARTNERS } from './visitor.service';

/**
 * createAtGate exercises the per-type push-payload branching + the
 * delivery-partner validation. We mock prisma + push + visitor gateway and
 * assert on the recorded calls rather than poking through nest's DI.
 */
describe('VisitorService.createAtGate — guest vs delivery', () => {
  const baseResident = {
    id: 'r1',
    userId: 'resident-user-1',
    flat: { id: 'flat-1', societyId: 'soc1' },
    user: { name: 'Mr. Sharma' },
  };

  const mockPrisma = {
    resident: { findFirst: jest.fn() },
    visitor: { create: jest.fn() },
  };
  const mockGateway = { emitVisitorArrived: jest.fn() };
  const mockPush = { send: jest.fn().mockResolvedValue({ ok: true }) };

  let service: VisitorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VisitorService(mockPrisma as any, mockGateway as any, mockPush as any);
    mockPrisma.resident.findFirst.mockResolvedValue(baseResident);
    mockPrisma.visitor.create.mockImplementation(async ({ data }: any) => ({
      id: 'v-new',
      ...data,
      resident: { ...baseResident, user: baseResident.user },
    }));
  });

  it('GUEST entry persists type=GUEST + creates a 2-button visitor_approval push', async () => {
    await service.createAtGate('guard-1', 'soc1', {
      residentId: 'r1',
      name: 'Mr. Kapoor',
      phone: '+919999000001',
    });

    expect(mockPrisma.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'GUEST',
          deliveryPartner: null,
          createdByStaffId: 'guard-1',
          approvalStatus: 'PENDING',
        }),
      }),
    );

    await new Promise((r) => setImmediate(r));
    const [userId, payload, data] = mockPush.send.mock.calls[0];
    expect(userId).toBe('resident-user-1');
    expect(payload.category).toBe('visitors_gate');
    expect(payload.actions).toHaveLength(2);
    expect(payload.actions.map((a: any) => a.id)).toEqual(['APPROVE', 'REJECT']);
    expect(data).toMatchObject({
      type: 'VISITOR_APPROVAL_REQUEST',
      actionGroup: 'visitor_approval',
    });
  });

  it('DELIVERY entry persists deliveryPartner + creates a 3-button delivery_approval push', async () => {
    await service.createAtGate('guard-1', 'soc1', {
      residentId: 'r1',
      name: 'Courier',
      phone: '+919999000002',
      type: 'DELIVERY',
      deliveryPartner: 'Amazon',
    });

    expect(mockPrisma.visitor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'DELIVERY',
          deliveryPartner: 'Amazon',
          createdByStaffId: 'guard-1',
        }),
      }),
    );

    await new Promise((r) => setImmediate(r));
    const [, payload, data] = mockPush.send.mock.calls[0];
    expect(payload.category).toBe('deliveries');
    expect(payload.actions).toHaveLength(3);
    expect(payload.actions.map((a: any) => a.id)).toEqual([
      'APPROVE',
      'LEAVE_AT_SECURITY',
      'REJECT',
    ]);
    expect(data).toMatchObject({
      type: 'DELIVERY_APPROVAL_REQUEST',
      actionGroup: 'delivery_approval',
      deliveryPartner: 'Amazon',
    });
  });

  it('accepts "Other: <custom>" free-text partner', async () => {
    await service.createAtGate('guard-1', 'soc1', {
      residentId: 'r1',
      name: 'Courier',
      type: 'DELIVERY',
      deliveryPartner: 'Other: Local Sweets Co',
    });
    expect(mockPrisma.visitor.create).toHaveBeenCalled();
  });

  it('rejects DELIVERY with no partner — code DELIVERY_PARTNER_REQUIRED', async () => {
    await expect(
      service.createAtGate('guard-1', 'soc1', {
        residentId: 'r1',
        name: 'Courier',
        type: 'DELIVERY',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.visitor.create).not.toHaveBeenCalled();
  });

  it('rejects DELIVERY with unrecognised partner — code DELIVERY_PARTNER_INVALID', async () => {
    await expect(
      service.createAtGate('guard-1', 'soc1', {
        residentId: 'r1',
        name: 'Courier',
        type: 'DELIVERY',
        deliveryPartner: 'Random Local Service',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects DELIVERY with absurdly long Other: string (DoS guard)', async () => {
    await expect(
      service.createAtGate('guard-1', 'soc1', {
        residentId: 'r1',
        name: 'Courier',
        type: 'DELIVERY',
        deliveryPartner: 'Other: ' + 'x'.repeat(200),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('404s when the residentId does not belong to the staff society', async () => {
    mockPrisma.resident.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.createAtGate('guard-1', 'soc1', {
        residentId: 'r-other-society',
        name: 'Courier',
        type: 'DELIVERY',
        deliveryPartner: 'Amazon',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('exposes a non-trivial DELIVERY_PARTNERS list', () => {
    // Cheap sanity check — if the list ever becomes empty, the resident copy
    // ("Amazon at the gate") breaks silently. Lock the floor.
    expect(DELIVERY_PARTNERS.length).toBeGreaterThanOrEqual(10);
    expect(DELIVERY_PARTNERS).toContain('Amazon');
    expect(DELIVERY_PARTNERS).toContain('Swiggy');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { VisitorService } from './visitor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitorGateway } from './visitor.gateway';
import { PushService } from '../../common/notification/push.service';

const mockPrisma = {
  visitor: { updateMany: jest.fn(), findUnique: jest.fn() },
};
const mockGateway = { emitVisitorArrived: jest.fn() };
const mockPush = { send: jest.fn() };

describe('VisitorService.decide — idempotent / race-safe', () => {
  let service: VisitorService;

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        VisitorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VisitorGateway, useValue: mockGateway },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();
    service = mod.get<VisitorService>(VisitorService);
    jest.clearAllMocks();
    // Bypass ownership/society check (covered elsewhere); focus on decision logic.
    jest.spyOn(service as any, 'findById').mockResolvedValue({ id: 'v1' });
  });

  it('first decision wins: PENDING -> APPROVED via a conditional update, applied=true', async () => {
    mockPrisma.visitor.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.visitor.findUnique.mockResolvedValue({ id: 'v1', approvalStatus: 'APPROVED' });

    const res = await service.decide('v1', 'soc1', 'u1', 'APPROVE');

    // The atomic guard: only transition from PENDING.
    expect(mockPrisma.visitor.updateMany).toHaveBeenCalledWith({
      where: { id: 'v1', approvalStatus: 'PENDING' },
      data: expect.objectContaining({ approvalStatus: 'APPROVED', approvedById: 'u1' }),
    });
    expect(res.applied).toBe(true);
    expect(res.decision).toBe('APPROVED');
  });

  it('a second/concurrent decision is a no-op that returns the decision that won', async () => {
    // Already decided => conditional update matches 0 rows.
    mockPrisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.visitor.findUnique.mockResolvedValue({ id: 'v1', approvalStatus: 'APPROVED' });

    const res = await service.decide('v1', 'soc1', 'u2', 'REJECT');

    expect(res.applied).toBe(false);
    // The first APPROVE stands; the racing REJECT does NOT overwrite it.
    expect(res.decision).toBe('APPROVED');
  });

  it('maps REJECT action to REJECTED', async () => {
    mockPrisma.visitor.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.visitor.findUnique.mockResolvedValue({ id: 'v1', approvalStatus: 'REJECTED' });

    await service.decide('v1', 'soc1', 'u1', 'REJECT');

    expect(mockPrisma.visitor.updateMany.mock.calls[0][0].data.approvalStatus).toBe('REJECTED');
  });

  it('maps LEAVE_AT_SECURITY action to LEFT_AT_SECURITY', async () => {
    mockPrisma.visitor.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.visitor.findUnique.mockResolvedValue({
      id: 'v1',
      approvalStatus: 'LEFT_AT_SECURITY',
      type: 'DELIVERY',
      name: 'Amazon courier',
      createdByStaffId: 'staff-1',
    });

    const res = await service.decide('v1', 'soc1', 'u1', 'LEAVE_AT_SECURITY');

    expect(mockPrisma.visitor.updateMany.mock.calls[0][0].data.approvalStatus).toBe('LEFT_AT_SECURITY');
    expect(res.decision).toBe('LEFT_AT_SECURITY');
    expect(res.applied).toBe(true);
  });

  it('fires a feedback push to the staff member who created the entry when applied=true', async () => {
    mockPrisma.visitor.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.visitor.findUnique.mockResolvedValue({
      id: 'v1',
      approvalStatus: 'APPROVED',
      type: 'DELIVERY',
      name: 'Amazon',
      createdByStaffId: 'staff-1',
    });
    mockPush.send.mockResolvedValue({ ok: true });

    await service.decide('v1', 'soc1', 'u1', 'APPROVE');

    // Allow the fire-and-forget push to schedule before assertions.
    await new Promise((r) => setImmediate(r));
    expect(mockPush.send).toHaveBeenCalled();
    const [staffUserId, payload, data] = mockPush.send.mock.calls[0];
    expect(staffUserId).toBe('staff-1');
    expect(payload.category).toBe('approval_results');
    expect(data).toMatchObject({
      type: 'VISITOR_DECISION_RESULT',
      visitId: 'v1',
      approvalStatus: 'APPROVED',
    });
  });

  it('does NOT fire the staff feedback push when applied=false (race loser)', async () => {
    mockPrisma.visitor.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.visitor.findUnique.mockResolvedValue({
      id: 'v1',
      approvalStatus: 'APPROVED',
      type: 'DELIVERY',
      name: 'Amazon',
      createdByStaffId: 'staff-1',
    });

    await service.decide('v1', 'soc1', 'u-late', 'REJECT');

    await new Promise((r) => setImmediate(r));
    expect(mockPush.send).not.toHaveBeenCalled();
  });
});

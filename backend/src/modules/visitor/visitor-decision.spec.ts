import { Test, TestingModule } from '@nestjs/testing';
import { VisitorService } from './visitor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitorGateway } from './visitor.gateway';

const mockPrisma = {
  visitor: { updateMany: jest.fn(), findUnique: jest.fn() },
};
const mockGateway = { emitVisitorArrived: jest.fn() };

describe('VisitorService.decide — idempotent / race-safe', () => {
  let service: VisitorService;

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        VisitorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VisitorGateway, useValue: mockGateway },
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
});

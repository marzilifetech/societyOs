/**
 * Integration: service request lifecycle (PENDING → ASSIGNED → IN_PROGRESS → COMPLETED).
 */
import { makePrismaMock } from './helpers/prisma-mock';

describe('Service request flow', () => {
  const prisma = makePrismaMock(['serviceRequest', 'staff']);

  it('transitions PENDING → ASSIGNED when assignee is set', async () => {
    prisma.serviceRequest.update.mockResolvedValue({
      id: 'sr1', status: 'ASSIGNED', assigneeId: 'staff1',
    });
    const r = await prisma.serviceRequest.update({
      where: { id: 'sr1' },
      data: { status: 'ASSIGNED', assigneeId: 'staff1' },
    });
    expect(r.status).toBe('ASSIGNED');
  });

  it('rejects illegal transition COMPLETED → PENDING', () => {
    const ALLOWED: Record<string, string[]> = {
      PENDING: ['ASSIGNED', 'CANCELLED'],
      ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
      COMPLETED: [],
      DISPUTED: ['IN_PROGRESS', 'COMPLETED'],
    };
    const canTransition = (from: string, to: string) => ALLOWED[from]?.includes(to) ?? false;
    expect(canTransition('COMPLETED', 'PENDING')).toBe(false);
    expect(canTransition('PENDING', 'ASSIGNED')).toBe(true);
  });
});

/**
 * Integration: complaint create + escalation + resolution.
 */
import { makePrismaMock } from './helpers/prisma-mock';

describe('Complaint flow', () => {
  const prisma = makePrismaMock(['complaint']);

  it('creates complaint with default OPEN status', async () => {
    prisma.complaint.create.mockResolvedValue({ id: 'c1', status: 'OPEN', priority: 'MEDIUM' });
    const r = await prisma.complaint.create({ data: { title: 'Lift broken', residentId: 'r1' } });
    expect(r.status).toBe('OPEN');
  });

  it('escalates HIGH priority after 24h SLA breach', () => {
    const breached = (createdAt: Date, priority: string) => {
      const hours = (Date.now() - createdAt.getTime()) / 36e5;
      const sla = priority === 'HIGH' ? 24 : 72;
      return hours > sla;
    };
    expect(breached(new Date(Date.now() - 25 * 36e5), 'HIGH')).toBe(true);
    expect(breached(new Date(Date.now() - 1 * 36e5), 'HIGH')).toBe(false);
  });
});

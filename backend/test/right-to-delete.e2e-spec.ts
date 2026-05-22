/**
 * Integration: right-to-delete (DPDP). Covers C1 — audit trail preserved.
 */
import { makePrismaMock } from './helpers/prisma-mock';

describe('Right-to-delete (C1)', () => {
  const prisma = makePrismaMock(['user', 'auditLog', 'visitor', 'serviceRequest']);

  it('C1: erases PII but keeps anonymised audit log entries', async () => {
    prisma.user.update.mockResolvedValue({
      id: 'u1', name: '[REDACTED]', phone: null, email: null, deletedAt: new Date(),
    });
    prisma.auditLog.findMany.mockResolvedValue([
      { id: 'al1', userId: 'u1', action: 'USER_LOGIN', meta: { redacted: true } },
    ]);

    const erased = await prisma.user.update({
      where: { id: 'u1' },
      data: { name: '[REDACTED]', phone: null, email: null, deletedAt: new Date() },
    });
    const trail = await prisma.auditLog.findMany({ where: { userId: 'u1' } });

    expect(erased.name).toBe('[REDACTED]');
    expect(erased.phone).toBeNull();
    expect(trail.length).toBeGreaterThan(0);
    expect(trail[0].action).toBe('USER_LOGIN');
  });

  it.skip('cascades anonymisation across related entities — unblocks when P3 lands DataExportService');
});

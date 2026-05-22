/**
 * Unit: SLA breach detection per priority.
 */
describe('SLA breach detection', () => {
  const SLA_HRS: Record<string, number> = { LOW: 168, MEDIUM: 72, HIGH: 24, URGENT: 4 };

  const isBreached = (createdAt: Date, priority: string, now = Date.now()) =>
    (now - createdAt.getTime()) / 36e5 > SLA_HRS[priority];

  it('URGENT breaches in 4h', () => {
    expect(isBreached(new Date(Date.now() - 5 * 36e5), 'URGENT')).toBe(true);
    expect(isBreached(new Date(Date.now() - 1 * 36e5), 'URGENT')).toBe(false);
  });

  it('LOW does not breach for a week', () => {
    expect(isBreached(new Date(Date.now() - 100 * 36e5), 'LOW')).toBe(false);
    expect(isBreached(new Date(Date.now() - 200 * 36e5), 'LOW')).toBe(true);
  });
});

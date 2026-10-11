import { auditWhere } from './compliance.controller';

const admin = { sub: 'a', role: 'ADMIN', societyId: 'soc-a' } as any;
const superAdmin = { sub: 's', role: 'SUPER_ADMIN', societyId: 'platform' } as any;

describe('auditWhere', () => {
  it("limits a society admin to their own society's log", () => {
    expect(auditWhere(admin, 'soc-a', {})).toEqual({ societyId: 'soc-a' });
  });

  it('gives super admins the platform-wide view', () => {
    expect(auditWhere(superAdmin, 'platform', {})).toEqual({});
  });

  it('applies filters and ignores unparseable dates instead of failing the query', () => {
    expect(
      auditWhere(admin, 'soc-a', { entity: 'User', adminId: 'x', from: 'garbage', to: '2026-10-01' }),
    ).toEqual({
      societyId: 'soc-a',
      entityType: { equals: 'User', mode: 'insensitive' },
      actorId: 'x',
      createdAt: { lte: new Date('2026-10-01') },
    });
  });
});

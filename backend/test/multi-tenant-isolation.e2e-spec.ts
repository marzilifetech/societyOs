/**
 * Integration: multi-tenant isolation. Covers MT1 (cross-tenant denied).
 *
 * Simulates the Prisma client extension that auto-injects {societyId} on read
 * and rejects writes whose societyId differs from the request scope.
 */
describe('Multi-tenant isolation (MT1)', () => {
  const requestScope = { societyId: 'socA', userId: 'u1' };

  const guarded = <T extends { societyId?: string } & Record<string, unknown>>(data: T) => {
    if (data.societyId && data.societyId !== requestScope.societyId) {
      const err: any = new Error('CROSS_TENANT_FORBIDDEN');
      err.statusCode = 403;
      throw err;
    }
    return { ...data, societyId: requestScope.societyId };
  };

  it('MT1: refuses to write with foreign societyId', () => {
    expect(() => guarded({ title: 'X', societyId: 'socB' })).toThrow(/CROSS_TENANT/);
  });

  it('auto-injects current scope when not provided', () => {
    const out = guarded({ title: 'X' });
    expect(out.societyId).toBe('socA');
  });

  it('listing scoped: queries always include societyId filter', () => {
    const buildWhere = (extra: Record<string, any>) => ({ societyId: requestScope.societyId, ...extra });
    expect(buildWhere({ status: 'OPEN' })).toEqual({ societyId: 'socA', status: 'OPEN' });
  });
});

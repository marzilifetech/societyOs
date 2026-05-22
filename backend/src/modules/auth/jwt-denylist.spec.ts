/**
 * Unit: JWT rotation denylist — revoked jti must reject, fresh jti must pass.
 */
describe('JWT denylist', () => {
  const denylist = new Set<string>();
  const revoke = (jti: string) => denylist.add(jti);
  const isRevoked = (jti: string) => denylist.has(jti);

  beforeEach(() => denylist.clear());

  it('fresh jti is not revoked', () => expect(isRevoked('jti1')).toBe(false));
  it('revoked jti returns true', () => {
    revoke('jti1');
    expect(isRevoked('jti1')).toBe(true);
  });
  it('revoking one jti does not affect another', () => {
    revoke('jti1');
    expect(isRevoked('jti2')).toBe(false);
  });

  it.todo('JwtStrategy.validate consults Redis denylist — unblocks when P1 ships JwtDenylistService');
});

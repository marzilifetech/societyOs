import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

// Per-request gate: every authed call hits validate(). We assert that
// SUSPENDED / ARCHIVED home societies are rejected so an existing JWT
// cannot keep working after a SUPER_ADMIN locks down a tenant.
describe('JwtStrategy.validate', () => {
  const mockPrisma = {
    user: { findUnique: jest.fn() },
  } as any;
  const mockRedis = { get: jest.fn().mockResolvedValue(null) } as any;
  const mockConfig = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(mockConfig, mockPrisma, mockRedis);
  });

  it('allows ACTIVE society + ACTIVE user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.ACTIVE,
      role: UserRole.RESIDENT,
      societyId: 'soc-1',
      society: { id: 'soc-1', status: 'ACTIVE' },
    });

    await expect(
      strategy.validate({ sub: 'u1', phone: '9', role: UserRole.RESIDENT, societyId: 'soc-1' } as any),
    ).resolves.toMatchObject({ sub: 'u1' });
  });

  // Regression: role must come from the DATABASE, not the token claim.
  //
  // validate() used to `return payload`, so RolesGuard authorised against the
  // role minted at login. Promoting a RESIDENT to STAFF had no effect until
  // their token happened to rotate — every /staff/* route kept 403ing while
  // the database said STAFF. Demotions were worse: the old, higher role stayed
  // valid until expiry.
  it('returns the CURRENT database role, overriding a stale token claim', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.ACTIVE,
      role: UserRole.STAFF, // promoted in the DB after the token was issued
      societyId: 'soc-1',
      society: { id: 'soc-1', status: 'ACTIVE' },
    });

    await expect(
      // Token still asserts the pre-promotion role.
      strategy.validate({ sub: 'u1', phone: '9', role: UserRole.RESIDENT, societyId: 'soc-1' } as any),
    ).resolves.toMatchObject({ sub: 'u1', role: UserRole.STAFF });
  });

  it('downgrades a stale elevated token claim to the current database role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.ACTIVE,
      role: UserRole.RESIDENT, // demoted in the DB
      societyId: 'soc-1',
      society: { id: 'soc-1', status: 'ACTIVE' },
    });

    await expect(
      strategy.validate({ sub: 'u1', phone: '9', role: UserRole.ADMIN, societyId: 'soc-1' } as any),
    ).resolves.toMatchObject({ role: UserRole.RESIDENT });
  });

  it('rejects when home society is SUSPENDED', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.ACTIVE,
      role: UserRole.RESIDENT,
      societyId: 'soc-1',
      society: { id: 'soc-1', status: 'SUSPENDED' },
    });

    await expect(
      strategy.validate({ sub: 'u1', phone: '9', role: UserRole.RESIDENT, societyId: 'soc-1' } as any),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SOCIETY_SUSPENDED' }),
    });
  });

  it('rejects when home society is ARCHIVED', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.ACTIVE,
      role: UserRole.RESIDENT,
      societyId: 'soc-1',
      society: { id: 'soc-1', status: 'ARCHIVED' },
    });

    await expect(
      strategy.validate({ sub: 'u1', phone: '9', role: UserRole.RESIDENT, societyId: 'soc-1' } as any),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SOCIETY_ARCHIVED' }),
    });
  });

  it('SUPER_ADMIN bypasses the society-status gate', async () => {
    // A super-admin sitting in a (somehow) SUSPENDED society should still get
    // through — their access is platform-level, not per-society. In practice
    // the Platform society is enforced ACTIVE by seed, but defence-in-depth.
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'super-1',
      status: UserStatus.ACTIVE,
      role: UserRole.SUPER_ADMIN,
      societyId: 'soc-platform',
      society: { id: 'soc-platform', status: 'SUSPENDED' },
    });

    await expect(
      strategy.validate({
        sub: 'super-1',
        phone: '9',
        role: UserRole.SUPER_ADMIN,
        societyId: 'soc-platform',
      } as any),
    ).resolves.toBeDefined();
  });

  it('rejects USER_REVOKED when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: 'u-missing' } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when user account is SUSPENDED even if society is ACTIVE', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.SUSPENDED,
      role: UserRole.RESIDENT,
      societyId: 'soc-1',
      society: { id: 'soc-1', status: 'ACTIVE' },
    });
    await expect(
      strategy.validate({ sub: 'u1' } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects USER_REVOKED when society relation is null (FK-orphan user)', async () => {
    // A token can outlive its tenant if the society record is deleted out
    // from under it. We must not NPE on `user.society.status`.
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u-orphan',
      status: UserStatus.ACTIVE,
      role: UserRole.RESIDENT,
      societyId: 'soc-gone',
      society: null,
    });
    await expect(
      strategy.validate({ sub: 'u-orphan', phone: '9', role: UserRole.RESIDENT, societyId: 'soc-gone' } as any),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'USER_REVOKED' }),
    });
  });
});

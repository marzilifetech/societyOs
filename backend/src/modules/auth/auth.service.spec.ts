import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { AuthRedis } from './redis.client';
import { ComplianceService } from '../compliance/compliance.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';

const mockPrisma = {
  society: { findUnique: jest.fn() },
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  resident: { findUnique: jest.fn(), update: jest.fn() },
};

describe('AuthService app activation', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { decode: jest.fn() } },
        { provide: OtpService, useValue: { verifyOtp: jest.fn().mockResolvedValue(true), sendOtp: jest.fn() } },
        {
          provide: TokenService,
          useValue: {
            issuePair: jest.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }),
            rotateRefresh: jest.fn(),
          },
        },
        {
          provide: TotpService,
          useValue: { isAdminRole: jest.fn().mockReturnValue(false), verifyForLogin: jest.fn() },
        },
        { provide: AuthRedis, useValue: { set: jest.fn().mockResolvedValue(undefined), get: jest.fn(), del: jest.fn() } },
        { provide: ComplianceService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1', status: 'ACTIVE' });
  });

  it('sets appActivatedAt on first resident login', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      phone: '9999999999',
      role: UserRole.RESIDENT,
      status: UserStatus.ACTIVE,
      societyId: 'soc-1',
      totpEnabled: false,
    });
    mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', appActivatedAt: null });
    mockPrisma.resident.update.mockResolvedValue({ id: 'res-1', appActivatedAt: new Date() });

    await service.verifyOtp({ phone: '9999999999', otp: '123456', societyId: 'soc-1' });

    expect(mockPrisma.resident.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { appActivatedAt: expect.any(Date) },
    });
  });

  it('does not update appActivatedAt when already set', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      phone: '9999999999',
      role: UserRole.RESIDENT,
      status: UserStatus.ACTIVE,
      societyId: 'soc-1',
      totpEnabled: false,
    });
    mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', appActivatedAt: new Date() });

    await service.verifyOtp({ phone: '9999999999', otp: '123456', societyId: 'soc-1' });

    expect(mockPrisma.resident.update).not.toHaveBeenCalled();
  });

  it('rejects suspended accounts', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      status: UserStatus.SUSPENDED,
      role: UserRole.RESIDENT,
      totpEnabled: false,
    });

    await expect(
      service.verifyOtp({ phone: '9999999999', otp: '123456', societyId: 'soc-1' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // Society lifecycle gate — added 2026-05.
  describe('society status gate', () => {
    it('sendOtp throws SOCIETY_SUSPENDED when society is suspended', async () => {
      mockPrisma.society.findUnique.mockResolvedValueOnce({ id: 'soc-1', status: 'SUSPENDED' });
      await expect(
        service.sendOtp({ phone: '9999999999', societyId: 'soc-1' } as any),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SOCIETY_SUSPENDED' }),
      });
    });

    it('sendOtp throws SOCIETY_ARCHIVED when society is archived', async () => {
      mockPrisma.society.findUnique.mockResolvedValueOnce({ id: 'soc-1', status: 'ARCHIVED' });
      await expect(
        service.sendOtp({ phone: '9999999999', societyId: 'soc-1' } as any),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SOCIETY_ARCHIVED' }),
      });
    });

    it('verifyOtp re-checks society status (race: suspended after sendOtp)', async () => {
      // Society was ACTIVE during sendOtp, became SUSPENDED before verifyOtp.
      mockPrisma.society.findUnique.mockResolvedValueOnce({ id: 'soc-1', status: 'SUSPENDED' });
      await expect(
        service.verifyOtp({ phone: '9999999999', otp: '123456', societyId: 'soc-1' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SOCIETY_SUSPENDED' }),
      });
      // Confirm the user lookup never happened — we failed closed before issuing tokens.
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('refreshToken treats orphan user (no society relation) as USER_REVOKED, never NPE', async () => {
      // Simulate FK orphan / stale include — user found but society relation null.
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        status: UserStatus.ACTIVE,
        role: UserRole.RESIDENT,
        societyId: 'soc-missing',
        phone: '+91999',
        society: null,
      });
      const fakeRefresh = 'tok.' + Buffer.from(
        JSON.stringify({ sub: 'u1', fid: 'fam-1', tid: 'tid-1', typ: 'refresh' }),
      ).toString('base64');
      // JwtService.decode is mocked in the harness to return undefined; replace
      // it just for this case so the service can read payload.sub.
      const jwtSvc = (service as any).jwt as { decode: jest.Mock };
      jwtSvc.decode.mockReturnValueOnce({ sub: 'u1' });

      await expect(service.refreshToken(fakeRefresh)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'USER_REVOKED' }),
      });
    });

    it('verifyOtp allows ACTIVE societies through (no regression)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        phone: '9999999999',
        role: UserRole.RESIDENT,
        status: UserStatus.ACTIVE,
        societyId: 'soc-1',
        totpEnabled: false,
      });
      mockPrisma.resident.findUnique.mockResolvedValue({ id: 'res-1', appActivatedAt: new Date() });

      const result = await service.verifyOtp({
        phone: '9999999999',
        otp: '123456',
        societyId: 'soc-1',
      });
      expect(result).toMatchObject({ accessToken: 'at', refreshToken: 'rt' });
    });
  });

  // C1: super-admin tenant-switch re-auth flow. Replaces the trivially-spoofed
  // X-ReAuth-Confirmed: 1 boolean header with a one-shot, signature-verified
  // re-auth token. Tests below cover the issuance side; consumeReauthToken is
  // exercised by the tenant middleware spec.
  describe('issueReauthToken (C1)', () => {
    const reauthUser = {
      id: 'sa-1',
      phone: '+919999900001',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      totpEnabled: true,
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(reauthUser);
      const jwtSvc = (service as any).jwt as { sign: jest.Mock; verify: jest.Mock };
      jwtSvc.sign = jest.fn().mockReturnValue('signed-reauth-token');
      jwtSvc.verify = jest.fn();
      const totpSvc = (service as any).totp as { verifyForLogin: jest.Mock };
      totpSvc.verifyForLogin = jest.fn().mockResolvedValue(true);
    });

    it('issues a token and stashes the jti in Redis (TOTP path)', async () => {
      const result = await service.issueReauthToken('sa-1', { totpCode: '123456' });
      expect(result).toEqual({ reauthToken: 'signed-reauth-token', expiresInSeconds: 5 * 60 });
      const redis = (service as any).redis as { set: jest.Mock };
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^reauth:/),
        'sa-1',
        5 * 60,
      );
    });

    it('rejects non-SUPER_ADMIN callers', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...reauthUser, role: UserRole.ADMIN });
      await expect(
        service.issueReauthToken('sa-1', { totpCode: '123456' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when TOTP enabled but code missing', async () => {
      await expect(service.issueReauthToken('sa-1', {})).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REAUTH_TOTP_REQUIRED' }),
      });
    });

    it('rejects on invalid TOTP code', async () => {
      const totpSvc = (service as any).totp as { verifyForLogin: jest.Mock };
      totpSvc.verifyForLogin = jest.fn().mockResolvedValue(false);
      await expect(
        service.issueReauthToken('sa-1', { totpCode: '000000' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: '2FA_INVALID_CODE' }),
      });
    });

    it('falls back to OTP when TOTP is not enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...reauthUser, totpEnabled: false });
      const otpSvc = (service as any).otp as { verifyOtp: jest.Mock };
      otpSvc.verifyOtp = jest.fn().mockResolvedValue(true);
      const result = await service.issueReauthToken('sa-1', { otp: '1234' });
      expect(result.reauthToken).toBe('signed-reauth-token');
      expect(otpSvc.verifyOtp).toHaveBeenCalledWith('+919999900001', '1234');
    });

    it('rejects when neither TOTP nor OTP path can satisfy verification', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...reauthUser, totpEnabled: false });
      await expect(service.issueReauthToken('sa-1', {})).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REAUTH_OTP_REQUIRED' }),
      });
    });
  });

  describe('consumeReauthToken (C1)', () => {
    beforeEach(() => {
      const jwtSvc = (service as any).jwt as { verify: jest.Mock };
      jwtSvc.verify = jest.fn();
      const redis = (service as any).redis as { get: jest.Mock; del: jest.Mock };
      redis.get = jest.fn();
      redis.del = jest.fn().mockResolvedValue(undefined);
    });

    it('returns userId and consumes the jti on first valid read', async () => {
      const jwtSvc = (service as any).jwt as { verify: jest.Mock };
      jwtSvc.verify.mockReturnValue({
        sub: 'sa-1',
        typ: 'reauth',
        purpose: 'tenant-switch',
        jti: 'jti-1',
      });
      const redis = (service as any).redis as { get: jest.Mock; del: jest.Mock };
      redis.get.mockResolvedValue('sa-1');

      const result = await service.consumeReauthToken('valid-token');
      expect(result).toEqual({ userId: 'sa-1' });
      expect(redis.del).toHaveBeenCalledWith('reauth:jti-1');
    });

    it('returns null when jti already consumed (one-shot)', async () => {
      const jwtSvc = (service as any).jwt as { verify: jest.Mock };
      jwtSvc.verify.mockReturnValue({
        sub: 'sa-1',
        typ: 'reauth',
        purpose: 'tenant-switch',
        jti: 'jti-1',
      });
      const redis = (service as any).redis as { get: jest.Mock };
      redis.get.mockResolvedValue(null);

      const result = await service.consumeReauthToken('replay');
      expect(result).toBeNull();
    });

    it('returns null on bad signature', async () => {
      const jwtSvc = (service as any).jwt as { verify: jest.Mock };
      jwtSvc.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      const result = await service.consumeReauthToken('forged');
      expect(result).toBeNull();
    });

    it('returns null when typ is not reauth (rejects access tokens)', async () => {
      const jwtSvc = (service as any).jwt as { verify: jest.Mock };
      jwtSvc.verify.mockReturnValue({ sub: 'sa-1', jti: 'jti-1' });
      const result = await service.consumeReauthToken('access-token');
      expect(result).toBeNull();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { AuthRedis } from './redis.client';
import { ComplianceService } from '../compliance/compliance.service';
import { JwtService } from '@nestjs/jwt';
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
        { provide: AuthRedis, useValue: { set: jest.fn().mockResolvedValue(undefined) } },
        { provide: ComplianceService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockPrisma.society.findUnique.mockResolvedValue({ id: 'soc-1' });
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
});

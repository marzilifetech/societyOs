import {
  isVerifyOtpTotpChallenge,
  type VerifyOtpTotpChallenge,
  type VerifyOtpSuccessPayload,
} from '../types';

describe('isVerifyOtpTotpChallenge', () => {
  const totpChallenge: VerifyOtpTotpChallenge = {
    totpRequired: true,
    userId: 'user-123',
  };

  const successPayload: VerifyOtpSuccessPayload = {
    token: 'tok',
    accessToken: 'access-tok',
    refreshToken: 'refresh-tok',
    user: {
      id: 'u1',
      phone: '+919000000000',
      role: 'STAFF',
      status: 'ACTIVE',
      name: 'Raju',
      societyId: 'soc-1',
    },
    isNewUser: false,
  };

  it('returns true for a TOTP challenge payload', () => {
    expect(isVerifyOtpTotpChallenge(totpChallenge)).toBe(true);
  });

  it('returns false for a success payload', () => {
    expect(isVerifyOtpTotpChallenge(successPayload)).toBe(false);
  });

  it('returns false when totpRequired is false', () => {
    const p = { ...totpChallenge, totpRequired: false } as any;
    expect(isVerifyOtpTotpChallenge(p)).toBe(false);
  });

  it('narrows type correctly (type guard)', () => {
    const payload = totpChallenge as VerifyOtpSuccessPayload | VerifyOtpTotpChallenge;
    if (isVerifyOtpTotpChallenge(payload)) {
      // TypeScript would allow accessing totpRequired here
      expect(payload.totpRequired).toBe(true);
      expect(payload.userId).toBe('user-123');
    }
  });
});

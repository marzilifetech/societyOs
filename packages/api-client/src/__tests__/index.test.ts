/**
 * Smoke-tests the barrel (index.ts) to ensure all public exports are present
 * and correctly re-exported. This exercises every line in index.ts and
 * guarantees the public API contract is stable.
 */
import * as pkg from '../index';

describe('package barrel (index.ts)', () => {
  it('exports ApiClient class', () => {
    expect(typeof pkg.ApiClient).toBe('function');
  });

  it('exports unwrapApiEnvelope function', () => {
    expect(typeof pkg.unwrapApiEnvelope).toBe('function');
  });

  it('exports isVerifyOtpTotpChallenge type-guard', () => {
    expect(typeof pkg.isVerifyOtpTotpChallenge).toBe('function');
  });

  it('isVerifyOtpTotpChallenge returns true for totp challenge shape', () => {
    const totp = { totpRequired: true as const, userId: 'u1' };
    expect(pkg.isVerifyOtpTotpChallenge(totp)).toBe(true);
  });

  it('isVerifyOtpTotpChallenge returns false for success payload shape', () => {
    const success = {
      token: 'tok',
      accessToken: 'at',
      refreshToken: 'rt',
      user: { id: 'u1', phone: '+91', role: 'STAFF', status: 'ACTIVE' },
      isNewUser: false,
    };
    expect(pkg.isVerifyOtpTotpChallenge(success)).toBe(false);
  });

  it('ApiClient instantiates correctly via the barrel', () => {
    const client = new pkg.ApiClient({
      baseUrl: 'https://api.example.com',
      getToken: () => null,
    });
    expect(client).toBeInstanceOf(pkg.ApiClient);
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.delete).toBe('function');
  });

  it('unwrapApiEnvelope via barrel unwraps data correctly', () => {
    expect(pkg.unwrapApiEnvelope({ data: { id: 1 }, meta: {}, error: null })).toEqual({ id: 1 });
  });
});

/**
 * Integration: OTP rate limit + lockout
 * Covers A1 (OTP expired), A2 (5x wrong = lockout), A3 (SMS provider failover).
 *
 * Pure-mock: builds a tiny in-memory rate limiter that mirrors the contract the
 * real OtpService is expected to expose. When P1 lands the real service we
 * remove the local stub and import OtpService directly — the assertions are
 * already encoded.
 */
describe('OTP rate limit & lockout (A1/A2/A3)', () => {
  type Attempt = { count: number; lockedUntil: number | null; lastSentAt: number };
  const attempts = new Map<string, Attempt>();
  const LOCK_AFTER = 5;
  const LOCK_MS = 15 * 60 * 1000;
  const OTP_TTL_MS = 5 * 60 * 1000;

  const otp = {
    generate: jest.fn(async (phone: string) => {
      attempts.set(phone, { count: 0, lockedUntil: null, lastSentAt: Date.now() });
      return { code: '123456', expiresAt: new Date(Date.now() + OTP_TTL_MS) };
    }),
    verify: jest.fn(async (phone: string, code: string, now = Date.now()) => {
      const a = attempts.get(phone);
      if (!a) return { ok: false, reason: 'NOT_SENT' };
      if (a.lockedUntil && a.lockedUntil > now) return { ok: false, reason: 'LOCKED' };
      if (now - a.lastSentAt > OTP_TTL_MS) return { ok: false, reason: 'EXPIRED' };
      if (code !== '123456') {
        a.count += 1;
        if (a.count >= LOCK_AFTER) a.lockedUntil = now + LOCK_MS;
        return { ok: false, reason: 'WRONG_CODE', remaining: Math.max(0, LOCK_AFTER - a.count) };
      }
      attempts.delete(phone);
      return { ok: true };
    }),
  };

  beforeEach(() => attempts.clear());

  it('A1: rejects OTP after 5 minutes (expired)', async () => {
    await otp.generate('+919999000001');
    const past = Date.now() + OTP_TTL_MS + 1;
    const res = await otp.verify('+919999000001', '123456', past);
    expect(res).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('A2: locks user after 5 wrong attempts', async () => {
    await otp.generate('+919999000002');
    for (let i = 0; i < 5; i++) {
      await otp.verify('+919999000002', '000000');
    }
    const sixth = await otp.verify('+919999000002', '123456');
    expect(sixth).toEqual({ ok: false, reason: 'LOCKED' });
  });

  it('A3: SMS provider failover — secondary used when primary throws', async () => {
    const primary = jest.fn().mockRejectedValueOnce(new Error('PRIMARY_DOWN'));
    const secondary = jest.fn().mockResolvedValue({ providerId: 'msg91', status: 'queued' });
    const send = async (phone: string, body: string) => {
      try {
        return await primary(phone, body);
      } catch {
        return await secondary(phone, body);
      }
    };
    const r = await send('+919999000003', 'Your OTP is 123456');
    expect(primary).toHaveBeenCalledTimes(1);
    expect(secondary).toHaveBeenCalledTimes(1);
    expect(r.providerId).toBe('msg91');
  });

  it.skip('integrates with real OtpService once P1 lands', () => {
    // unblocks when P1 ships OtpService with rate-limit + provider failover
  });
});

import { sign } from 'jsonwebtoken';
import { AppThrottlerGuard, bearerSubject } from './throttler.config';

const SECRET = 'test-secret';
process.env.JWT_SECRET = SECRET;
const jwt = (claims: object) => `Bearer ${sign(claims, SECRET)}`;
/** A token anyone could make: right shape, not signed by us. */
const forged = (claims: object) =>
  `Bearer h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;

describe('bearerSubject', () => {
  it('reads sub from a token we signed', () => {
    expect(bearerSubject({ headers: { authorization: jwt({ sub: 'u1' }) } })).toBe('u1');
  });

  it('ignores a forged or wrongly signed token (no filling someone else\'s bucket)', () => {
    expect(bearerSubject({ headers: { authorization: forged({ sub: 'guard-1' }) } })).toBeUndefined();
    expect(bearerSubject({ headers: { authorization: `Bearer ${sign({ sub: 'guard-1' }, 'other')}` } })).toBeUndefined();
  });

  it.each([
    [undefined],
    ['Basic abc'],
    ['Bearer not-a-jwt'],
    ['Bearer a.%%%.c'],
    [jwt({ sub: 42 })],
    [jwt({ sub: 'x'.repeat(65) })],
  ])('is undefined for %s', (authorization) => {
    expect(bearerSubject({ headers: { authorization } })).toBeUndefined();
  });
});

describe('AppThrottlerGuard tracker', () => {
  const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
  const track = (req: object) => (guard as any).getTracker(req) as Promise<string>;

  it('buckets signed-in requests per user, so users behind one carrier IP do not share a quota', async () => {
    const a = await track({ ip: '49.36.1.1', path: '/v1/staff/summary', headers: { authorization: jwt({ sub: 'a' }) } });
    const b = await track({ ip: '49.36.1.1', path: '/v1/staff/summary', headers: { authorization: jwt({ sub: 'b' }) } });
    expect(a).toBe('user:a');
    expect(b).toBe('user:b');
  });

  it('buckets anonymous requests per IP', async () => {
    await expect(track({ ip: '1.2.3.4', path: '/v1/societies', headers: {} })).resolves.toBe('1.2.3.4');
  });

  it('keeps IP+phone for OTP routes', async () => {
    await expect(
      track({ ip: '1.2.3.4', path: '/v1/auth/send-otp', body: { phone: '+919' }, headers: {} }),
    ).resolves.toBe('1.2.3.4|+919');
  });
});

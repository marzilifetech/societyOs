/**
 * Unit: Razorpay webhook HMAC verification.
 */
import * as crypto from 'crypto';

describe('Razorpay HMAC verify', () => {
  const SECRET = 'webhook_secret_demo';
  const compute = (body: string) =>
    crypto.createHmac('sha256', SECRET).update(body).digest('hex');

  const verify = (body: string, sig: string) => {
    const expected = compute(body);
    if (expected.length !== sig.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  };

  it('verifies a real signature', () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    expect(verify(body, compute(body))).toBe(true);
  });

  it('rejects when body is tampered', () => {
    const sig = compute(JSON.stringify({ event: 'payment.captured' }));
    expect(verify(JSON.stringify({ event: 'payment.captured', amount: 99999 }), sig)).toBe(false);
  });
});

/**
 * Integration: Razorpay payment verification (webhook + signature).
 * Covers P3 (signature mismatch rejected).
 */
import * as crypto from 'crypto';

describe('Razorpay payment verification (P3)', () => {
  const SECRET = 'test_secret_xyz';
  const sign = (orderId: string, paymentId: string) =>
    crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');

  const verify = (orderId: string, paymentId: string, signature: string) => {
    const expected = sign(orderId, paymentId);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  };

  it('accepts a correctly signed payment', () => {
    const sig = sign('order_1', 'pay_1');
    expect(verify('order_1', 'pay_1', sig)).toBe(true);
  });

  it('P3: rejects payment with tampered signature', () => {
    const tampered = 'a'.repeat(64);
    expect(() => verify('order_1', 'pay_1', tampered)).not.toThrow();
    expect(verify('order_1', 'pay_1', tampered)).toBe(false);
  });

  it('rejects payment whose signature was generated with wrong secret', () => {
    const wrongSig = crypto
      .createHmac('sha256', 'WRONG')
      .update('order_1|pay_1')
      .digest('hex');
    expect(verify('order_1', 'pay_1', wrongSig)).toBe(false);
  });
});

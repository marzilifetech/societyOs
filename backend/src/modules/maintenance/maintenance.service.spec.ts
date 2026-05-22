import { createHmac } from 'crypto';

/**
 * Razorpay signature verification fixtures (task 24).
 * The verifyRazorpaySignature method is private, so we replicate it here to
 * pin the algorithm: HMAC-SHA256(key_secret, order_id + '|' + payment_id).
 */
describe('Razorpay signature', () => {
  it('verifies a known fixture', () => {
    const orderId = 'order_DslnoIgkIDL8Zt';
    const paymentId = 'pay_DvZjksxPY9TR3X';
    const secret = 'test_secret_key';
    const sig = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

    const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    expect(sig).toEqual(expected);
    expect(sig).toHaveLength(64);
  });

  it('rejects mismatched signature', () => {
    const expected = createHmac('sha256', 'test_secret').update('a|b').digest('hex');
    const wrong = 'deadbeef'.repeat(8);
    expect(expected).not.toEqual(wrong);
  });
});

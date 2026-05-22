/**
 * Unit: TOTP window validation. Uses otplib (already in deps).
 */
import { authenticator } from 'otplib';

describe('TOTP window', () => {
  const secret = authenticator.generateSecret();

  it('current code is valid within window 1', () => {
    authenticator.options = { window: 1 };
    const token = authenticator.generate(secret);
    expect(authenticator.check(token, secret)).toBe(true);
  });

  it('random 6-digit code rejects', () => {
    expect(authenticator.check('000000', secret)).toBe(false);
  });
});

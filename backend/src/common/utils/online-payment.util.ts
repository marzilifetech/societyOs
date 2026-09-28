import { GoneException } from '@nestjs/common';

/**
 * Online payment is switched off: residents pay maintenance at the society
 * office, and the resident app no longer has a payment gateway.
 *
 * The resident-facing payment routes (maintenance order/verify, wallet
 * top-up) answer 410 through this helper instead of running. verify-payment
 * marked a bill PAID when called without a Razorpay signature, so leaving the
 * routes live let any resident "pay" a bill without paying. Older app builds
 * that still show a Pay button get a message they can act on.
 */
export function onlinePaymentDisabled(): never {
  throw new GoneException({
    code: 'ONLINE_PAYMENT_DISABLED',
    message: 'Online payment is not available. Please pay at the society office.',
  });
}

/**
 * E2E — Resident Maintenance Payments (BRD §3.2.8; RS-09)
 *
 * Story: RS-09 Resident pays maintenance online and downloads a receipt;
 *               doesn't need to hand over cash or visit the office.
 *
 * BRD §3.2.8 Maintenance Payments:
 *  - View dues: current, past-due, advance
 *  - Itemised breakdown (maintenance, water, parking, etc.)
 *  - Pay via UPI / Net Banking / Card / Wallet (Razorpay)
 *  - Download official receipts / invoices
 *  - Set up auto-pay for recurring payments
 *  - View complete payment history
 *  - Late payment interest displayed transparently
 *  - Reminders before due date
 */

describe('RS-09 Bills List (/maintenance)', () => {
  it.skip('GET /maintenance/bills returns array of MaintenanceBill', () => {});
  it.skip('Outstanding section lists PENDING + OVERDUE bills', () => {});
  it.skip('Payment History section lists SUCCESS bills', () => {});
  it.skip('shows status pill per bill (Due / Overdue / Paid)', () => {});
  it.skip('overdue bills show due-date in red and late interest line', () => {});
});

describe('Bill Detail Sheet', () => {
  it.skip('row tap opens modal with itemised breakdown (maintenance, parking, water…)', () => {});
  it.skip('shows period (Month YYYY), due date, total amount', () => {});
  it.skip('lists prior payments for this bill (partial/full)', () => {});
});

describe('RS-09 Razorpay Payment Flow', () => {
  it.skip('Pay button POSTs /maintenance/payment-order {billId} returning {amount, paymentId}', () => {});
  it.skip('opens Razorpay checkout SDK with prefilled amount + description', () => {});
  it.skip('on success, POSTs /maintenance/verify-payment {paymentId, gatewayRef}', () => {});
  it.skip('refetches bills list and shows new SUCCESS state', () => {});
  it.skip('on failure, shows error toast and bill remains PENDING', () => {});
});

describe('RS-09 Receipts & Invoices', () => {
  it.skip('paid bill detail shows "Download Receipt" button', () => {});
  it.skip('receipt URL is presigned and opens a PDF', () => {});
  it.skip('receipt contains: society name, flat, period, breakdown, payment ref, paid timestamp', () => {});
});

describe('Auto-Pay (BRD §3.2.8)', () => {
  it.skip('Settings → Auto-Pay toggle initialises Razorpay subscription mandate', () => {});
  it.skip('next-debit date and amount displayed when active', () => {});
  it.skip('cancel mandate removes auto-pay', () => {});
});

describe('Reminders (BRD §3.2.8)', () => {
  it.skip('local notification scheduled 7d before due-date for each PENDING bill', () => {});
  it.skip('FCM "bill-reminder" topic also surfaces in-app banner', () => {});
});

describe('Late Interest (BRD §3.2.8)', () => {
  it.skip('overdue bill detail shows late-interest line with rule explanation', () => {});
  it.skip('rule label e.g. "1.5% / month after due-date" pulled from society config', () => {});
});

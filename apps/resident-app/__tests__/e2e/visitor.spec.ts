/**
 * E2E — Resident Visitor Pre-Approval (BRD §3.1.1; RS-01)
 *
 * Story: RS-01 Resident pre-approves a visitor and shares a QR code;
 *               visitor can enter without resident answering a call.
 *
 * BRD §3.1.1 Visitor & Gate Management:
 *  - Pre-approve visitors with QR / OTP-based entry
 *  - Real-time notification on visitor arrival at gate
 *  - Visitor log + history
 *  - Delivery management (expected deliveries, missed alerts)
 *  - Cab / vehicle pre-approval gate pass
 *  - Domestic-help / frequent visitor with recurring approvals
 */

describe('RS-01 Visitor Pre-Approval Flow', () => {
  it.skip('Visitors tab lists my visitors via GET /visitors/my', () => {});
  it.skip('"+ New Visitor" button opens /visitor/new form', () => {});
  it.skip('form fields: name, phone, vehicle (optional), purpose, valid-from, valid-until', () => {});
  it.skip('POST /visitors creates visitor and returns {id, qrToken, validUntil}', () => {});
  it.skip('after create, navigates to /visitor/[id] showing QR code via react-native-qrcode-svg', () => {});
  it.skip('Share button uses Share API to send QR/OTP to visitor', () => {});
  it.skip('Deny button PATCH /visitors/:id/deny when guard prompts approval', () => {});
});

describe('RS-01 QR Code & OTP Display', () => {
  it.skip('QR encodes the qrToken; scanning at gate calls GET /visitors/qr/:token', () => {});
  it.skip('OTP fallback: 6-digit numeric is shown alongside QR', () => {});
  it.skip('QR expires at validUntil; UI shows "Expired" state past expiry', () => {});
  it.skip('Regenerate QR button issues a fresh token', () => {});
});

describe('Real-time Arrival Notification (BRD §3.1.1)', () => {
  it.skip('FCM topic visitor/:id/arrival updates the visitor card to "AT GATE"', () => {});
  it.skip('approval prompt appears with Allow / Deny buttons', () => {});
  it.skip('Allow PATCHes /visitors/:id/approve (or returns guard-side check-in)', () => {});
});

describe('Visitor Log & History', () => {
  it.skip('Visitors tab has "All / Today / Past 7 days" filters', () => {});
  it.skip('past visitors show entryAt and exitAt timestamps', () => {});
  it.skip('search by visitor name filters list', () => {});
});

describe('Delivery Management (BRD §3.1.1)', () => {
  it.skip('expected deliveries section lets resident pre-register expected courier', () => {});
  it.skip('missed delivery alert appears when guard logs a delivery while resident is away', () => {});
});

describe('Vehicle / Cab Pre-Approval', () => {
  it.skip('vehicle field accepts plate number; QR includes vehicle metadata', () => {});
  it.skip('Cab toggle generates a one-tap entry pass with cab driver name + plate', () => {});
});

describe('Recurring Domestic Help (BRD §3.1.1)', () => {
  it.skip('Recurring tab lists frequent visitors (cook, maid, milkman)', () => {});
  it.skip('toggle Activate/Deactivate days-of-week + time-window per visitor', () => {});
  it.skip('recurring entries auto-generate daily QR on schedule', () => {});
});

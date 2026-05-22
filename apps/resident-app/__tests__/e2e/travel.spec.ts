/**
 * E2E — Resident Travel Pause (BRD §3.2.10; RS-10)
 *
 * Story: RS-10 Resident submits a travel-pause request for 3 weeks;
 *               variable charges are paused while resident is away.
 *
 * BRD §3.2.10 Travel Mode (Maintenance Pause):
 *  - Submit travel request: travel start date, expected return date, reason (optional)
 *  - Specify which services to pause (newspaper, milk, canteen meals)
 *  - Admin reviews and approves
 *  - Maintenance dues paused/reduced per society rules
 *  - Auto-activation on return date; resident can also manually mark return
 *  - Push reminder 1 day before scheduled return
 *
 * IMPLEMENTATION NOTE (QA): As of 2026-04-30, NO resident-app screen exists for
 * travel pause. Backend has ONLY admin endpoints (GET/PATCH /admin/travel/pauses).
 * These tests document the expected resident-side flow which is currently MISSING.
 */

describe('RS-10 Travel Pause Submission (NOT IMPLEMENTED)', () => {
  it.skip('renders /travel/new with form: startDate, returnDate, reason (optional)', () => {});
  it.skip('multi-select chips for services to pause: Maintenance / Newspaper / Milk / Canteen / Cleaning', () => {});
  it.skip('returnDate must be > startDate; UI shows duration in days', () => {});
  it.skip('POST /travel/pauses {startDate, returnDate, reason, services} returns {id, status: PENDING}', () => {});
  it.skip('navigates to /travel/[id] showing PENDING approval state', () => {});
});

describe('RS-10 Travel List (/travel)', () => {
  it.skip('GET /travel/pauses/my returns my travel pause requests', () => {});
  it.skip('groups by status: Pending / Approved / Active / Completed / Rejected', () => {});
  it.skip('Active pause shows countdown to return date', () => {});
});

describe('Admin Approval Reflection (BRD §3.2.10)', () => {
  it.skip('FCM "travel-pause-approved" updates status without manual refresh', () => {});
  it.skip('rejection message from admin appears in detail view', () => {});
});

describe('Auto-Activation on Return (BRD §3.2.10)', () => {
  it.skip('on return date, status auto-transitions to COMPLETED via backend cron', () => {});
  it.skip('resident receives FCM "welcome-back" notification', () => {});
});

describe('Manual Return Mark', () => {
  it.skip('Active pause has "I\'m Back" button that PATCHes /travel/pauses/:id/return', () => {});
  it.skip('confirms with dialog before submission', () => {});
});

describe('Pre-Return Reminder (BRD §3.2.10)', () => {
  it.skip('local notification 1 day before scheduled return reminding resident', () => {});
  it.skip('reminder includes "Mark return early" deep-link if resident is back sooner', () => {});
});

describe('Billing Adjustment (BRD §3.2.10)', () => {
  it.skip('next bill detail shows "Travel Pause Discount" line item with -₹X', () => {});
  it.skip('discount calculation matches society config rules', () => {});
});

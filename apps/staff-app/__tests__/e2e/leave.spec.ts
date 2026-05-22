/**
 * E2E — Staff Leave & Holidays (BRD §4.4; §6.2 SS-04)
 *
 * Story: SS-04 Housekeeper applies for 2 days casual leave;
 *               leave is processed without visiting the office.
 *
 * BRD §4.4 Leave & Holiday Management:
 *  - Apply for leave: casual, medical, privilege
 *  - Select dates + submit reason
 *  - Track status: Pending → Approved / Rejected
 *  - View remaining leave balance per type
 *  - View official society holidays calendar
 *  - Admin approval workflow
 *  - Notification on approval / rejection
 */

describe('SS-04 Leave Application Flow', () => {
  it.skip('renders leave-type picker on /leave/new with options: CASUAL, MEDICAL, PRIVILEGE', () => {});
  it.skip('opens DateTimePicker for fromDate and toDate; toDate must be >= fromDate', () => {});
  it.skip('disables Submit until reason length >= 5 chars', () => {});
  it.skip('shows current balance per type before submission', () => {});
  it.skip('POSTs /staff/leave with {leaveType, fromDate, toDate, reason} and navigates to /leave/history', () => {});
  it.skip('shows error toast when fromDate is in the past', () => {});
  it.skip('queues request offline when network is down', () => {});
});

describe('Leave History', () => {
  it.skip('renders /leave/history with pending / approved / rejected tabs', () => {});
  it.skip('GETs /staff/leaves and groups by status', () => {});
  it.skip('shows admin note when leave is rejected', () => {});
  it.skip('opens detail card with date range + reason on tap', () => {});
  it.skip('refetches when push notification "leave-status-changed" arrives', () => {});
});

describe('SS-04 Leave Balance', () => {
  it.skip('renders /leave/balance with three cards: casual / medical / privilege', () => {});
  it.skip('GETs /staff/leave-balance and shows allocated / used / remaining per type', () => {});
  it.skip('shows next allocation date and YTD usage chart', () => {});
});

describe('Holiday Calendar (BRD §4.4)', () => {
  it.skip('renders /leave/holidays with 12-month calendar grid', () => {});
  it.skip('GETs /staff/holidays and highlights official society holidays', () => {});
  it.skip('shows holiday name + type (gazetted / festival / restricted) on tap', () => {});
});

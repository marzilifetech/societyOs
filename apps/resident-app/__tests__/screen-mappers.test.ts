/**
 * Pure mappers used by screens to read the backend's real field names and
 * enums (attendance rows, concierge statuses, visitor decisions, bill
 * breakdowns).
 */
import { attendanceByDate, todayAttendance } from '../src/utils/attendance';
import {
  conciergeStatus,
  conciergeStepIndex,
  conciergeTypeLabel,
  isConciergeActive,
} from '../src/utils/concierge';
import {
  canDecideVisitor,
  decisionMessage,
  isGatePassUsable,
  visitorSettledMessage,
} from '../src/utils/visitor';
import { billBreakdownRows } from '../src/utils/bill';

describe('attendanceByDate', () => {
  it('maps @db.Date rows to a YYYY-MM-DD → status map', () => {
    expect(
      attendanceByDate([
        { date: '2026-10-11T00:00:00.000Z', status: 'PRESENT' },
        { date: '2026-10-10T00:00:00.000Z', status: 'HALF_DAY' },
        { date: '2026-10-09T00:00:00.000Z', status: 'bogus' },
      ]),
    ).toEqual({ '2026-10-11': 'PRESENT', '2026-10-10': 'HALF_DAY' });
  });

  it('is empty (not a crash) for missing data', () => {
    expect(attendanceByDate(undefined)).toEqual({});
    expect(attendanceByDate(null)).toEqual({});
  });

  it("finds today's status, or null", () => {
    const rows = [{ date: '2026-10-11T00:00:00.000Z', status: 'ABSENT' }];
    expect(todayAttendance(rows, '2026-10-11')).toBe('ABSENT');
    expect(todayAttendance(rows, '2026-10-12')).toBeNull();
    expect(todayAttendance(undefined, '2026-10-11')).toBeNull();
  });
});

describe('concierge status', () => {
  it.each(['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'])('%s is active', (s) => {
    expect(isConciergeActive(s)).toBe(true);
  });

  it.each(['COMPLETED', 'CANCELLED'])('%s is not active', (s) => {
    expect(isConciergeActive(s)).toBe(false);
  });

  it('maps the stepper', () => {
    expect(conciergeStepIndex('PENDING')).toBe(0);
    expect(conciergeStepIndex('ASSIGNED')).toBe(1);
    expect(conciergeStepIndex('ACCEPTED')).toBe(1);
    expect(conciergeStepIndex('IN_PROGRESS')).toBe(2);
    expect(conciergeStepIndex('COMPLETED')).toBe(3);
  });

  it('labels statuses and types', () => {
    expect(conciergeStatus('PENDING')).toEqual({ tone: 'pending', label: 'Requested' });
    expect(conciergeStatus('ACCEPTED').tone).toBe('active');
    expect(conciergeStatus('CANCELLED').tone).toBe('cancelled');
    expect(conciergeTypeLabel('COURIER')).toBe('Package Pickup');
    expect(conciergeTypeLabel(undefined)).toBe('Request');
  });
});

describe('visitor decisions', () => {
  it('offers a decision only while pending and not yet at/through the gate', () => {
    expect(canDecideVisitor({ status: 'EXPECTED', approvalStatus: 'PENDING' })).toBe(true);
    expect(canDecideVisitor({ status: 'CHECKED_IN', approvalStatus: 'PENDING' })).toBe(false);
    expect(canDecideVisitor({ status: 'EXPECTED', approvalStatus: 'APPROVED' })).toBe(false);
    expect(canDecideVisitor({ status: 'EXPECTED', approvalStatus: 'REJECTED' })).toBe(false);
  });

  it('reports the applied decision, not the button pressed', () => {
    expect(decisionMessage('APPROVED', true).title).toBe('Entry Approved');
    expect(decisionMessage('LEFT_AT_SECURITY', true).title).toBe('Leave at Security');
    expect(decisionMessage('REJECTED', true).title).toBe('Entry Denied');
  });

  it('says when an earlier decision already won', () => {
    const m = decisionMessage('APPROVED', false);
    expect(m.title).toBe('Already decided');
    expect(m.body).toContain('approved');
  });

  it('describes a visitor that can no longer be decided on', () => {
    expect(visitorSettledMessage({ status: 'CHECKED_IN', approvalStatus: 'PENDING' }).title).toBe('Already inside');
    expect(visitorSettledMessage({ status: 'EXPECTED', approvalStatus: 'APPROVED' }).title).toBe('Entry Approved');
  });

  it('shows a gate pass only while it can still be used', () => {
    const now = Date.UTC(2026, 9, 11, 12);
    expect(isGatePassUsable({ status: 'EXPECTED', approvalStatus: 'APPROVED' }, now)).toBe(true);
    expect(isGatePassUsable({ status: 'EXPECTED', approvalStatus: 'REJECTED' }, now)).toBe(false);
    expect(isGatePassUsable({ status: 'EXPIRED' }, now)).toBe(false);
    expect(
      isGatePassUsable({ status: 'EXPECTED', validUntil: '2026-10-11T11:00:00.000Z' }, now),
    ).toBe(false);
    expect(
      isGatePassUsable({ status: 'EXPECTED', validUntil: '2026-10-11T13:00:00.000Z' }, now),
    ).toBe(true);
  });
});

describe('billBreakdownRows', () => {
  it('renders only known numeric fields, each formatted for what it is', () => {
    const rows = billBreakdownRows({
      base: '2500.5',
      rateMode: 'PER_SQFT',
      areaSqft: 1200,
      ratePerSqft: 2.08,
      travelPauseCredit: 300,
      pausedDays: 4,
      somethingElse: 99,
    });
    expect(rows.map((r) => r.key)).toEqual(['base', 'areaSqft', 'ratePerSqft', 'travelPauseCredit', 'pausedDays']);
    expect(rows.find((r) => r.key === 'base')!.value).toBe('₹2,500.5');
    expect(rows.find((r) => r.key === 'areaSqft')!.value).toBe('1,200 sq ft');
    expect(rows.every((r) => !r.value.includes('NaN'))).toBe(true);
  });

  it('is empty for missing or malformed breakdowns', () => {
    expect(billBreakdownRows(undefined)).toEqual([]);
    expect(billBreakdownRows('x')).toEqual([]);
    expect(billBreakdownRows([1, 2])).toEqual([]);
    expect(billBreakdownRows({ base: 'abc' })).toEqual([]);
  });
});

describe('complaintCategoryLabel', () => {
  const { complaintCategoryLabel } = require('../src/utils/complaint');
  it('turns enum values into readable labels', () => {
    expect(complaintCategoryLabel('NOISE')).toBe('Noise');
    expect(complaintCategoryLabel('NEIGHBOR')).toBe('Neighbour');
    expect(complaintCategoryLabel('COMMON_AREA')).toBe('Common Area');
    expect(complaintCategoryLabel(undefined)).toBeNull();
  });
});

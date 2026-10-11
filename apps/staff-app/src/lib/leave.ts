import { getUnwrapped, getUnwrappedArray } from './unwrapped-get';

/**
 * Leave, as the API sends it. The screens had their own guesses — balances
 * keyed `casual`/`medical` (the API uses `CASUAL`/`MEDICAL`), leaves with
 * `leaveType`/`fromDate`/`toDate` (the API uses `type`/`startDate`/`endDate`) —
 * so every balance read 0 of 0 and every date read "Invalid Date".
 */
export type LeaveType = 'CASUAL' | 'MEDICAL' | 'PRIVILEGE';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type LeaveBalance = Partial<Record<string, { used: number; total: number }>>;

export interface LeaveRecord {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  adminNote?: string | null;
  createdAt: string;
}

export const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'CASUAL', label: 'Casual' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'PRIVILEGE', label: 'Privilege' },
];

export const fetchLeaveBalance = () => getUnwrapped<LeaveBalance>('/staff/leave-balance');
export const fetchMyLeaves = () => getUnwrappedArray<LeaveRecord>('/staff/leaves');

/** Calendar days a leave covers, both ends included. */
export function leaveDays(start: string, end: string): number {
  const ms = new Date(end.slice(0, 10)).getTime() - new Date(start.slice(0, 10)).getTime();
  return Number.isFinite(ms) ? Math.max(1, Math.round(ms / 86_400_000) + 1) : 1;
}

/** Left of a leave type this year, or null when the API has no entry for it. */
export function remainingOf(balance: LeaveBalance | null | undefined, type: string): number | null {
  const entry = balance?.[type];
  return entry ? Math.max(0, entry.total - entry.used) : null;
}

/**
 * Today's date in India as YYYY-MM-DD. `new Date().toISOString()` is UTC, so
 * between midnight and 05:30 IST it named YESTERDAY — the date a night-shift
 * guard saw pre-filled, and the server then refused as "in the past".
 */
export function todayIst(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

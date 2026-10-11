/**
 * Attendance time rules, in India Standard Time.
 *
 * The server runs in UTC. Attendance used `new Date().setHours(0,0,0,0)` for
 * "today" and `setHours(9)` / `setHours(18)` for the late and early cut-offs,
 * all in SERVER time. So "today" changed at 05:30 IST (a guard checking in at
 * 01:00 was booked on the previous day), "late" meant after 14:30 IST and
 * "early departure" meant before 23:30 IST — almost every checkout was flagged
 * early and almost no one was ever late. The shift an admin assigned on the
 * Shift Timings page was never consulted.
 */

const IST_OFFSET_MINUTES = 330;
const DAY_MINUTES = 24 * 60;

export interface ShiftWindow {
  /** Minutes after IST midnight. */
  startMin: number;
  endMin: number;
}

/** 09:00–18:00 IST: what applies when no shift is assigned. */
export const DEFAULT_SHIFT: ShiftWindow = { startMin: 9 * 60, endMin: 18 * 60 };

/** Minutes after start before a check-in counts as late, unless the society sets its own. */
export const DEFAULT_GRACE_MINUTES = 10;

/** IST wall-clock minutes since midnight for an instant. */
export function istMinutesOfDay(now: Date): number {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + IST_OFFSET_MINUTES) % DAY_MINUTES;
}

/**
 * The IST calendar date of `now`, as the value to store in a `@db.Date`
 * column (midnight UTC of that date).
 */
export function istDateOf(now: Date): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** "HH:MM" (24h) → minutes after midnight, or null when malformed. */
export function parseHHMM(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** A shift template `{ startTime, endTime }`, or null when it can't be read. */
export function shiftFromTemplate(template: unknown): ShiftWindow | null {
  if (!template || typeof template !== 'object') return null;
  const t = template as { startTime?: unknown; endTime?: unknown };
  const startMin = parseHHMM(t.startTime);
  const endMin = parseHHMM(t.endTime);
  if (startMin === null || endMin === null || startMin === endMin) return null;
  return { startMin, endMin };
}

function durationOf(shift: ShiftWindow): number {
  return (shift.endMin - shift.startMin + DAY_MINUTES) % DAY_MINUTES;
}

/**
 * Late = checked in more than `graceMinutes` after the shift started, while
 * the shift is still running. Works across midnight: for a 22:00–06:00 shift a
 * check-in at 00:30 is 150 minutes late, one at 21:45 is early (not late).
 */
export function isLateCheckIn(now: Date, shift: ShiftWindow, graceMinutes = DEFAULT_GRACE_MINUTES): boolean {
  const sinceStart = (istMinutesOfDay(now) - shift.startMin + DAY_MINUTES) % DAY_MINUTES;
  return sinceStart > graceMinutes && sinceStart < durationOf(shift);
}

/**
 * Early departure = checked out while the shift was still running. Checking
 * out at or after the end (including the next morning for a night shift) is
 * not early.
 */
export function isEarlyCheckOut(now: Date, shift: ShiftWindow): boolean {
  const untilEnd = (shift.endMin - istMinutesOfDay(now) + DAY_MINUTES) % DAY_MINUTES;
  return untilEnd > 0 && untilEnd < durationOf(shift);
}

/** The guard's shift: their assigned template, else the society default, else 09:00–18:00. */
export function resolveShift(
  societyConfig: unknown,
  shiftTemplateId: string | null | undefined,
): { shift: ShiftWindow; graceMinutes: number } {
  const cfg = (societyConfig && typeof societyConfig === 'object' ? societyConfig : {}) as {
    shiftTemplates?: { id?: string }[];
    attendance?: { graceMinutes?: unknown };
  };
  const templates = Array.isArray(cfg.shiftTemplates) ? cfg.shiftTemplates : [];
  const assigned = shiftTemplateId ? templates.find((t) => t?.id === shiftTemplateId) : undefined;
  const grace = Number(cfg.attendance?.graceMinutes);
  return {
    shift: shiftFromTemplate(assigned) ?? DEFAULT_SHIFT,
    graceMinutes: Number.isFinite(grace) && grace >= 0 && grace <= 240 ? grace : DEFAULT_GRACE_MINUTES,
  };
}

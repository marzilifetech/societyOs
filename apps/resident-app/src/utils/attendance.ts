import { localDateString } from './date';

/** Backend DomesticAttendanceStatus. */
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'HOLIDAY';
export type AttendanceRow = { date: string; status: string };

/**
 * GET /domestic-help/:id returns `attendance` rows ({ date, status }). The
 * calendar wants a YYYY-MM-DD → status map. `date` is a @db.Date column, so
 * its UTC date part is the calendar day.
 */
export function attendanceByDate(rows: AttendanceRow[] | null | undefined): Record<string, AttendanceStatus> {
  const map: Record<string, AttendanceStatus> = {};
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row.date !== 'string') continue;
    const status = String(row.status ?? '').toUpperCase();
    if (status === 'PRESENT' || status === 'ABSENT' || status === 'HALF_DAY' || status === 'HOLIDAY') {
      map[row.date.slice(0, 10)] = status;
    }
  }
  return map;
}

/** Today's status from attendance rows, or null when not marked / not returned. */
export function todayAttendance(rows: AttendanceRow[] | null | undefined, today: string = localDateString()): AttendanceStatus | null {
  return attendanceByDate(rows)[today] ?? null;
}

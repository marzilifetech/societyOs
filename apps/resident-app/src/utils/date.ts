/**
 * Calendar dates ("YYYY-MM-DD") in the phone's local time zone.
 *
 * `toISOString().slice(0, 10)` gives the UTC date, which in India (+05:30) is
 * still yesterday between midnight and 05:30 — bookings, attendance and
 * pickups landed on the wrong day. Use these instead.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar date of `date` (default: now) as YYYY-MM-DD. */
export function localDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parses a value from the API or a picker. A bare YYYY-MM-DD is read as local
 * midnight (the JS default reads it as UTC midnight); anything else goes
 * through `new Date`. Returns null when the value isn't a date.
 */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

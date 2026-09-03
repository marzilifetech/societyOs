/**
 * Date/time helpers for the admin dashboard.
 *
 * WHY: `<input type="datetime-local">` speaks LOCAL wall-clock time with no
 * zone, while the API stores and returns UTC ISO strings. The service-request
 * screens bridged the two by hand:
 *
 *   defaultValue={sr.scheduledTime.slice(0, 16)}   // UTC wall-clock shown as local
 *   onBlur={... new Date(e.target.value).toISOString() ...}
 *
 * `.slice(0, 16)` on `2026-09-05T11:00:00.000Z` yields `2026-09-05T11:00`, so
 * the picker displayed 11:00 while the list (rendered via toLocaleString) showed
 * 16:30 IST — and every save round-tripped the value by another 5h30m. That is
 * the "scheduling always shows a fixed timing (4:30 PM)" report.
 *
 * Everything user-facing now goes through here, pinned to the society's zone so
 * the dashboard, the resident app and the staff app all agree on one clock.
 */
export const SOCIETY_TIME_ZONE = 'Asia/Kolkata';

/** Parts of an instant as they read on a wall clock in `timeZone`. */
function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Intl can emit "24" for midnight in some engines.
    hour: get('hour') === '24' ? '00' : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * ISO instant -> `YYYY-MM-DDTHH:mm` for a `datetime-local` input, in society time.
 * Returns '' for null/invalid input so the field renders empty rather than
 * "Invalid Date".
 */
export function toDateTimeLocalValue(
  iso: string | Date | null | undefined,
  timeZone: string = SOCIETY_TIME_ZONE,
): string {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = zonedParts(d, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * `datetime-local` value -> UTC ISO instant, interpreting the input as society
 * time rather than as the operator's browser zone.
 *
 * Computed by probing the zone offset at that instant, so it stays correct
 * without hardcoding +05:30 (and works for any zone this is pointed at).
 */
export function fromDateTimeLocalValue(
  value: string | null | undefined,
  timeZone: string = SOCIETY_TIME_ZONE,
): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  // Start by assuming the wall-clock time is UTC, then correct by the offset
  // the zone actually had at that moment.
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  const probe = new Date(asUtc);
  const p = zonedParts(probe, timeZone);
  const zonedAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offset = zonedAsUtc - asUtc;
  return new Date(asUtc - offset).toISOString();
}

/** Human date+time in society time, e.g. "5 Sep, 04:30 pm". */
export function formatDateTime(
  iso: string | Date | null | undefined,
  timeZone: string = SOCIETY_TIME_ZONE,
): string {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Human date in society time, e.g. "5 Sep 2026". */
export function formatDate(
  iso: string | Date | null | undefined,
  timeZone: string = SOCIETY_TIME_ZONE,
): string {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { timeZone, day: 'numeric', month: 'short', year: 'numeric' });
}

/** Formats a rupee amount, tolerating null/undefined instead of throwing. */
export function formatCurrency(amount: number | null | undefined): string {
  const n = Number(amount);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`;
}

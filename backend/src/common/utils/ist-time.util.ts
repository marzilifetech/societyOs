/**
 * India Standard Time helpers.
 *
 * Every society in the product operates on IST, but timestamps are stored in
 * UTC and rendered on whatever machine happens to be reading them. Exports and
 * schedule displays that used the host's default zone drifted by the 5h30m
 * offset — the same class of bug that made a service request scheduled for one
 * time consistently display as another.
 *
 * Everything user-facing goes through here so there is exactly one definition
 * of "what time is it for this society".
 */
export const SOCIETY_TIME_ZONE = 'Asia/Kolkata';

/** `YYYY-MM-DD HH:mm` in IST, or '' for null/invalid input. */
export function formatIst(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SOCIETY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/** `YYYY-MM-DD` in IST. */
export function formatIstDate(value: Date | string | null | undefined): string {
  return formatIst(value).slice(0, 10);
}

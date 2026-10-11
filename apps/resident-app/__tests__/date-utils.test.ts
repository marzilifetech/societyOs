// Pin the zone the app's users are in; Node applies a runtime TZ change.
process.env.TZ = 'Asia/Kolkata';

import { localDateString, parseLocalDate } from '../src/utils/date';

describe('localDateString', () => {
  it('uses the local calendar date just after midnight IST (UTC is still yesterday)', () => {
    const justAfterMidnight = new Date('2026-10-10T19:00:00.000Z'); // 00:30 IST on the 11th
    expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-10-10');
    expect(localDateString(justAfterMidnight)).toBe('2026-10-11');
  });

  it('zero-pads month and day', () => {
    expect(localDateString(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });

  it('defaults to now', () => {
    const now = new Date();
    expect(localDateString()).toBe(localDateString(now));
  });
});

describe('parseLocalDate', () => {
  it('reads a bare date as local midnight', () => {
    const d = parseLocalDate('2026-10-11')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 11, 0]);
  });

  it('round-trips with localDateString', () => {
    expect(localDateString(parseLocalDate('2026-03-31')!)).toBe('2026-03-31');
  });

  it('parses full ISO timestamps', () => {
    expect(parseLocalDate('2026-10-10T19:00:00.000Z')!.getTime()).toBe(Date.UTC(2026, 9, 10, 19));
  });

  it('returns null for empty or invalid input', () => {
    expect(parseLocalDate('')).toBeNull();
    expect(parseLocalDate(null)).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
    expect(parseLocalDate('not a date')).toBeNull();
  });
});

import {
  DEFAULT_SHIFT,
  istDateOf,
  istMinutesOfDay,
  isEarlyCheckOut,
  isLateCheckIn,
  parseHHMM,
  resolveShift,
  shiftFromTemplate,
} from './attendance-time';

/** An instant given as IST wall-clock time. */
const ist = (s: string) => new Date(`${s}+05:30`);

describe('IST day boundaries', () => {
  it('books a 01:00 IST check-in on that IST day, not the previous UTC day', () => {
    expect(istDateOf(ist('2026-10-11T01:00:00')).toISOString()).toBe('2026-10-11T00:00:00.000Z');
    expect(istDateOf(ist('2026-10-10T23:59:00')).toISOString()).toBe('2026-10-10T00:00:00.000Z');
  });

  it('reads IST wall-clock minutes', () => {
    expect(istMinutesOfDay(ist('2026-10-11T09:05:00'))).toBe(9 * 60 + 5);
    expect(istMinutesOfDay(ist('2026-10-11T00:30:00'))).toBe(30);
  });
});

describe('parseHHMM / shiftFromTemplate', () => {
  it('parses valid 24h times and rejects junk', () => {
    expect(parseHHMM('06:00')).toBe(360);
    expect(parseHHMM('23:59')).toBe(1439);
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('9am')).toBeNull();
    expect(shiftFromTemplate({ startTime: '10:00', endTime: '10:00' })).toBeNull();
  });
});

describe('late / early against the default 09:00–18:00 IST shift', () => {
  it('is late after the grace period, in IST (it used to mean after 14:30 IST)', () => {
    expect(isLateCheckIn(ist('2026-10-11T09:05:00'), DEFAULT_SHIFT, 10)).toBe(false);
    expect(isLateCheckIn(ist('2026-10-11T09:20:00'), DEFAULT_SHIFT, 10)).toBe(true);
    expect(isLateCheckIn(ist('2026-10-11T08:45:00'), DEFAULT_SHIFT, 10)).toBe(false);
  });

  it('is early before 18:00 IST only (it used to mean before 23:30 IST)', () => {
    expect(isEarlyCheckOut(ist('2026-10-11T17:30:00'), DEFAULT_SHIFT)).toBe(true);
    expect(isEarlyCheckOut(ist('2026-10-11T18:00:00'), DEFAULT_SHIFT)).toBe(false);
    expect(isEarlyCheckOut(ist('2026-10-11T19:15:00'), DEFAULT_SHIFT)).toBe(false);
  });
});

describe('overnight shift 22:00–06:00', () => {
  const night = shiftFromTemplate({ startTime: '22:00', endTime: '06:00' })!;

  it('handles late across midnight', () => {
    expect(isLateCheckIn(ist('2026-10-10T21:45:00'), night)).toBe(false);
    expect(isLateCheckIn(ist('2026-10-10T22:05:00'), night)).toBe(false);
    expect(isLateCheckIn(ist('2026-10-10T22:30:00'), night)).toBe(true);
    expect(isLateCheckIn(ist('2026-10-11T00:30:00'), night)).toBe(true);
  });

  it('handles early departure across midnight', () => {
    expect(isEarlyCheckOut(ist('2026-10-11T04:00:00'), night)).toBe(true);
    expect(isEarlyCheckOut(ist('2026-10-11T06:00:00'), night)).toBe(false);
    expect(isEarlyCheckOut(ist('2026-10-11T07:10:00'), night)).toBe(false);
  });
});

describe('resolveShift', () => {
  const config = {
    shiftTemplates: [{ id: 'n', name: 'Night', startTime: '22:00', endTime: '06:00' }],
    attendance: { graceMinutes: 5 },
  };

  it("uses the guard's assigned template and the society's grace period", () => {
    expect(resolveShift(config, 'n')).toEqual({ shift: { startMin: 1320, endMin: 360 }, graceMinutes: 5 });
  });

  it('falls back to 09:00–18:00 and 10 minutes grace', () => {
    expect(resolveShift(null, null)).toEqual({ shift: DEFAULT_SHIFT, graceMinutes: 10 });
    expect(resolveShift(config, 'missing').shift).toBe(DEFAULT_SHIFT);
    expect(resolveShift({ attendance: { graceMinutes: 'x' } }, null).graceMinutes).toBe(10);
  });
});

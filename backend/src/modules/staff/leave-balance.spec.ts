/**
 * Unit: leave balance calc. Covers L4 (holiday day excluded).
 *
 * Isolated logic test — pulls out the pure date math expected of
 * StaffService.calculateLeaveDays. Wires up via real service when P2 lands.
 */
describe('Leave balance — working day calc', () => {
  const isWeekend = (d: Date) => [0, 6].includes(d.getDay());
  const eachDay = (from: Date, to: Date) => {
    const out: Date[] = [];
    for (let t = +from; t <= +to; t += 86400000) out.push(new Date(t));
    return out;
  };

  const leaveDays = (from: Date, to: Date, holidays: Date[]) => {
    const hSet = new Set(holidays.map(h => h.toISOString().slice(0, 10)));
    return eachDay(from, to).filter(d => !isWeekend(d) && !hSet.has(d.toISOString().slice(0, 10))).length;
  };

  it('counts only weekdays', () => {
    // Mon 2026-01-05 → Sun 2026-01-11
    expect(leaveDays(new Date('2026-01-05'), new Date('2026-01-11'), [])).toBe(5);
  });

  it('L4: excludes holidays from count', () => {
    expect(
      leaveDays(new Date('2026-01-05'), new Date('2026-01-09'), [new Date('2026-01-07')]),
    ).toBe(4);
  });

  it.todo('integrates with StaffService.calculateLeaveDays — unblocks when P2 ships method');
});

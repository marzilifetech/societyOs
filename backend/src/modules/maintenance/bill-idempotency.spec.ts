/**
 * Unit: bill generation idempotency — re-running generation for the same
 * (society, year, month) must not create duplicate bills.
 */
describe('Bill idempotency', () => {
  type Bill = { id: string; societyId: string; flatId: string; year: number; month: number };
  const bills: Bill[] = [];

  const generate = (societyId: string, flatId: string, year: number, month: number) => {
    const exists = bills.find(
      b => b.societyId === societyId && b.flatId === flatId && b.year === year && b.month === month,
    );
    if (exists) return { created: false, bill: exists };
    const bill = { id: `b${bills.length + 1}`, societyId, flatId, year, month };
    bills.push(bill);
    return { created: true, bill };
  };

  beforeEach(() => { bills.length = 0; });

  it('first run creates a bill', () => {
    expect(generate('soc1', 'f1', 2026, 4).created).toBe(true);
  });

  it('second run for same period is a no-op', () => {
    generate('soc1', 'f1', 2026, 4);
    expect(generate('soc1', 'f1', 2026, 4).created).toBe(false);
  });

  it('different month creates a new bill', () => {
    generate('soc1', 'f1', 2026, 4);
    expect(generate('soc1', 'f1', 2026, 5).created).toBe(true);
  });
});

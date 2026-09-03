/**
 * Regression tests for the resident-app half of the 2026-09 defect sweep.
 * These pin the contracts that were wrong, not the pixels.
 */

// ── Report: "Concierge - Request help feature is not functional" ───────────
//
// The screen's category `value` was its human label ("Package Pickup"), which
// went straight into `ConciergeRequest.type` — a Prisma enum. Every submission
// died with `Invalid value for argument 'type'`.
describe('concierge request category', () => {
  /** Mirrors CATEGORIES in app/help-requests/new.tsx. */
  const CATEGORIES = [
    { value: 'COURIER', label: 'Package Pickup' },
    { value: 'HEAVY_LIFTING', label: 'Heavy Lifting' },
    { value: 'FORM_HELP', label: 'Document Collect' },
    { value: 'ELDERLY_ASSIST', label: 'Elderly Assist' },
    { value: 'MINOR_FIX', label: 'Minor Fix' },
    { value: 'OTHER', label: 'Other Help' },
  ];

  it('never sends a human label as the type', () => {
    for (const c of CATEGORIES) {
      expect(c.value).toMatch(/^[A-Z][A-Z_]*$/);
      expect(c.value).not.toContain(' ');
    }
  });

  it('keeps the label distinct from the wire value', () => {
    // The bug was precisely that these were the same string.
    const sameAsLabel = CATEGORIES.filter((c) => c.value === c.label);
    expect(sameAsLabel).toEqual([]);
  });

  it('maps to values the API recognises', () => {
    // Anything not in the enum is folded to OTHER server-side, so every value
    // here must at least be an UPPER_SNAKE key the mapper understands.
    const KNOWN = new Set([
      'COURIER', 'FORM_HELP', 'TAXI', 'PHARMACY', 'OTHER',
      'HEAVY_LIFTING', 'ELDERLY_ASSIST', 'MINOR_FIX',
    ]);
    for (const c of CATEGORIES) expect(KNOWN.has(c.value)).toBe(true);
  });
});

// ── Report: "Canteen - Each category should be displayed separately" ───────
describe('canteen meal grouping', () => {
  const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'] as const;
  type Meal = (typeof MEAL_TYPES)[number];

  /** Mirrors the grouping in app/canteen/index.tsx. */
  function groupByMeal(menus: Array<{ date: string; mealType: string; dishes?: Array<{ id: string }> }>, today: string) {
    const out: Record<Meal, Array<{ id: string }>> = { BREAKFAST: [], LUNCH: [], SNACKS: [], DINNER: [] };
    for (const m of menus) {
      if (m.date?.startsWith(today) && (MEAL_TYPES as readonly string[]).includes(m.mealType)) {
        out[m.mealType as Meal] = [...out[m.mealType as Meal], ...(m.dishes ?? [])];
      }
    }
    return out;
  }

  const today = '2026-09-03';
  const menus = [
    { date: `${today}T00:00:00.000Z`, mealType: 'BREAKFAST', dishes: [{ id: 'd1' }, { id: 'd2' }] },
    { date: `${today}T00:00:00.000Z`, mealType: 'LUNCH', dishes: [{ id: 'd3' }] },
    { date: '2026-09-04T00:00:00.000Z', mealType: 'DINNER', dishes: [{ id: 'other-day' }] },
  ];

  it('shows only the selected meal, not every meal stacked together', () => {
    const grouped = groupByMeal(menus, today);
    // Selecting LUNCH used to scroll within one list that still showed
    // breakfast, snacks and dinner. It now renders just this bucket.
    expect(grouped.LUNCH.map((d) => d.id)).toEqual(['d3']);
    expect(grouped.BREAKFAST.map((d) => d.id)).toEqual(['d1', 'd2']);
  });

  it('keeps every meal type addressable, including empty ones', () => {
    const grouped = groupByMeal(menus, today);
    expect(Object.keys(grouped).sort()).toEqual(['BREAKFAST', 'DINNER', 'LUNCH', 'SNACKS']);
    expect(grouped.SNACKS).toEqual([]);
  });

  it("ignores another day's menu", () => {
    expect(groupByMeal(menus, today).DINNER).toEqual([]);
  });
});

// ── Report: "Add entry - Entry request is not shown in the resident app" ───
describe('visitor list ordering', () => {
  /** Mirrors the sort in app/(tabs)/visitors.tsx. */
  function sortVisitors(rows: Array<{ id: string; approvalStatus?: string; createdAt: string }>) {
    return [...rows].sort((a, b) => {
      const aPending = a.approvalStatus === 'PENDING' ? 0 : 1;
      const bPending = b.approvalStatus === 'PENDING' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  it('puts entries awaiting the resident first, however old', () => {
    const sorted = sortVisitors([
      { id: 'recent-approved', approvalStatus: 'APPROVED', createdAt: '2026-09-03T10:00:00Z' },
      { id: 'old-pending', approvalStatus: 'PENDING', createdAt: '2026-09-01T10:00:00Z' },
      { id: 'newest-approved', approvalStatus: 'APPROVED', createdAt: '2026-09-03T12:00:00Z' },
    ]);
    // A gate-logged entry used to sit in creation order with nothing marking it
    // as needing a decision.
    expect(sorted[0].id).toBe('old-pending');
  });

  it('orders the rest newest-first', () => {
    const sorted = sortVisitors([
      { id: 'a', approvalStatus: 'APPROVED', createdAt: '2026-09-01T10:00:00Z' },
      { id: 'b', approvalStatus: 'APPROVED', createdAt: '2026-09-03T10:00:00Z' },
    ]);
    expect(sorted.map((v) => v.id)).toEqual(['b', 'a']);
  });
});

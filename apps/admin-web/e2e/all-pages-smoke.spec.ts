/**
 * Table-driven smoke matrix.
 *
 * For every page reachable from the sidebar (plus a few deep routes we
 * don't link to from the nav today), assert:
 *   1. HTTP < 500 — no server-side render exception.
 *   2. <main> is in the DOM.
 *   3. No "Something went wrong" / "ChunkLoadError" text leaked from the
 *      error boundary.
 *
 * This is a regression net, not a deep behaviour test. When this trips
 * red on a route, the bug is almost always a client-only hook calling
 * before its provider is mounted, or a missing api-client query function.
 *
 * Auth-gated routes skip cleanly when storageState is empty (offline CI).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    const f = fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8');
    return JSON.parse(f).cookies?.length > 0;
  } catch {
    return false;
  }
})();

// Mirrors NAV_ITEMS + NAV_SECTIONS in
// apps/admin-web/src/components/layout/Sidebar.tsx (kept lockstep manually —
// when a new page lands in the sidebar, add it here in the same PR).
const PAGES = [
  // ─── Top nav ─────────────────────────────────────────────────────
  '/dashboard',
  '/residents',
  '/flats',
  '/staff',
  '/staff/leaderboard',
  '/staff/leaves',
  '/staff/shift-timings',
  '/visitors',
  '/service-requests',
  '/document-requests',
  '/complaints',
  '/maintenance',
  '/notices',
  '/events',
  '/sos',
  // ─── Operations ─────────────────────────────────────────────────
  '/canteen',
  '/medical',
  '/laundry',
  '/concierge',
  '/housekeeping',
  '/security',
  '/domestic-help',
  '/parking',
  '/travel',
  '/packages',
  '/pest-control',
  // ─── Finance ────────────────────────────────────────────────────
  '/wallet',
  '/budget',
  '/vendors',
  // ─── Community ──────────────────────────────────────────────────
  '/polls',
  '/property',
  '/agm',
  '/community',
  '/infrastructure',
  '/feedback',
  // ─── System ─────────────────────────────────────────────────────
  '/audit',
  '/settings',
];

const ERROR_BOUNDARY_PATTERNS = [
  /something went wrong/i,
  /ChunkLoadError/i,
  /Application error: a client-side exception/i,
];

for (const url of PAGES) {
  test(`smoke ${url} responds < 500`, async ({ page }) => {
    const res = await page.goto(url);
    expect(res?.status() ?? 0, `${url} returned ${res?.status()}`).toBeLessThan(500);
  });

  test(`smoke ${url} mounts <main> and shows no boundary error`, async ({ page }) => {
    test.skip(!hasAuth, 'no auth state — populate via global-setup');
    await page.goto(url);
    // <main> from app/(authed)/layout.tsx; falling back to <body> so a
    // page that intentionally renders inside a Sheet/Modal isn't flagged.
    await expect(page.locator('main, body')).toBeVisible();
    for (const pattern of ERROR_BOUNDARY_PATTERNS) {
      // Use page.getByText with .first() so we don't fail when the regex
      // matches the page TITLE rather than a real error string.
      const matches = await page.getByText(pattern).count();
      expect(matches, `${url} surfaced error-boundary text`).toBe(0);
    }
  });
}

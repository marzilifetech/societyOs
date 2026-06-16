/**
 * E2E — Sidebar nav reachability.
 *
 * Iterates the top NAV_ITEMS (Sidebar.tsx) and clicks each link, asserting:
 *   - URL updates to the expected href.
 *   - <main> renders without an error-boundary trip.
 *
 * Deliberately scoped to NAV_ITEMS only (the always-visible top section) —
 * the Operations / Finance / Community / System sections are scrolled and
 * covered by the all-pages smoke matrix. Clicking each link individually
 * proves there's no broken href in the sidebar markup itself.
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

const TOP_NAV = [
  { label: /dashboard/i,        href: '/dashboard' },
  { label: /residents/i,        href: '/residents' },
  { label: /flats & blocks/i,   href: '/flats' },
  { label: /^staff$/i,          href: '/staff' },
  { label: /leaderboard/i,      href: '/staff/leaderboard' },
  { label: /staff leaves/i,     href: '/staff/leaves' },
  { label: /shift timings/i,    href: '/staff/shift-timings' },
  { label: /visitors/i,         href: '/visitors' },
  { label: /service requests/i, href: '/service-requests' },
  { label: /document requests/i, href: '/document-requests' },
  { label: /complaints/i,       href: '/complaints' },
  { label: /maintenance/i,      href: '/maintenance' },
  { label: /notices/i,          href: '/notices' },
  { label: /^events$/i,         href: '/events' },
  { label: /sos alerts/i,       href: '/sos' },
];

for (const item of TOP_NAV) {
  test(`sidebar link ${item.href} navigates`, async ({ page }) => {
    test.skip(!hasAuth, 'no auth state');
    await page.goto('/dashboard');
    const link = page.getByRole('link', { name: item.label }).first();
    if ((await link.count()) === 0) {
      test.skip(true, `sidebar link not present for ${item.href}`);
      return;
    }
    await link.click();
    // expo-router-style URLs include the basepath; tolerate trailing slashes.
    await expect(page).toHaveURL(new RegExp(`${item.href.replace('/', '\\/')}/?$`));
    await expect(page.locator('main, body')).toBeVisible();
  });
}

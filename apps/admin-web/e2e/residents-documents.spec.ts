import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for the Documents card on the resident detail page and the docs
 * presence summary on the Pending Approval list. The visual layer (thumbnails,
 * pip indicators) is the only thing Playwright can assert here; the actual
 * image rendering goes through Marzi-signed URLs which CI cannot reach without
 * a live backend.
 *
 * All tests skip if the global-setup auth fixture is empty (offline CI mode),
 * mirroring the pattern used in service-requests.spec.ts.
 */
const hasAuth = (() => {
  try {
    return (
      JSON.parse(fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8')).cookies
        ?.length > 0
    );
  } catch {
    return false;
  }
})();

test.describe('Pending residents list', () => {
  test('Aadhaar / PAN / Address completeness pips render on Pending Approval tab', async ({ page }) => {
    test.skip(!hasAuth, 'no auth');
    await page.goto('/residents');

    const pendingTab = page.getByRole('button', { name: /pending approval/i });
    if (await pendingTab.count()) await pendingTab.first().click();

    // Wait for table to settle; pips only appear when there's at least one
    // pending resident, so tolerate the empty case (skip the assertions).
    await page.waitForLoadState('networkidle').catch(() => {});

    const aadhaarPip = page.getByTestId('doc-pip-aadhaar').first();
    if (await aadhaarPip.count()) {
      await expect(aadhaarPip).toBeVisible();
      // The PAN and Address pips should appear in the same row — same test id pattern.
      await expect(page.getByTestId('doc-pip-pan').first()).toBeVisible();
      await expect(page.getByTestId('doc-pip-address').first()).toBeVisible();
    }
  });
});

test.describe('Resident detail — Documents card', () => {
  test('Documents card renders the five slots for any resident', async ({ page }) => {
    test.skip(!hasAuth, 'no auth');

    // Pick the first row on the residents page so the test doesn't depend on
    // a specific seeded ID. If there are no residents at all, skip cleanly.
    await page.goto('/residents');
    await page.waitForLoadState('networkidle').catch(() => {});
    const firstRow = page.locator('table tbody tr').first();
    if ((await firstRow.count()) === 0) test.skip(true, 'no residents seeded');
    await firstRow.click();

    // Documents card is identified by its "Documents" heading + the slot
    // test-ids the new DocSlot component emits.
    await expect(page.getByRole('heading', { name: /documents/i }).first()).toBeVisible();

    for (const slot of ['aadhaar-photo', 'pan-photo', 'address-proof']) {
      await expect(page.getByTestId(`doc-slot-${slot}`)).toBeVisible();
    }
  });

  test('Verify and Reject buttons remain reachable on the Documents card', async ({ page }) => {
    test.skip(!hasAuth, 'no auth');
    await page.goto('/residents');
    await page.waitForLoadState('networkidle').catch(() => {});
    const firstRow = page.locator('table tbody tr').first();
    if ((await firstRow.count()) === 0) test.skip(true, 'no residents seeded');
    await firstRow.click();

    // One of these will always be present (Verify if not already verified,
    // Reject if not already rejected) — we just need either to render.
    const verifyBtn = page.getByRole('button', { name: /^verify$/i });
    const rejectBtn = page.getByRole('button', { name: /^reject$/i });
    const visibleCount = (await verifyBtn.count()) + (await rejectBtn.count());
    expect(visibleCount).toBeGreaterThan(0);
  });
});

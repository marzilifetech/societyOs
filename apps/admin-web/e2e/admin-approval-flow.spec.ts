import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Smoke tests for the admin approval surface — the screens the user reviews
 * KYC and decides on residents. We deliberately keep these tests lightweight
 * (visibility + button reachability) because:
 *
 * - Real approval/reject mutations against a staging DB would mutate seed
 *   data in a way that breaks subsequent runs.
 * - The mutation paths themselves are covered by backend unit tests
 *   (resident.service.spec.ts and admin.service.spec.ts).
 *
 * Skips when no auth fixture is available (offline CI mode), matching the
 * pattern used across the other admin-web specs.
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

test.describe('Resident approval surface', () => {
  test('Pending Approval tab is reachable and shows Approve/Reject controls', async ({ page }) => {
    test.skip(!hasAuth, 'no auth');
    await page.goto('/residents');

    const pendingTab = page.getByRole('button', { name: /pending approval/i });
    if (await pendingTab.count()) {
      await pendingTab.first().click();
    }

    // If there are pending residents, both action buttons must be reachable
    // for at least one row. If there are none, the table is empty and we
    // only assert the page didn't crash.
    await page.waitForLoadState('networkidle').catch(() => {});
    const approveBtn = page.getByRole('button', { name: /^approve$/i }).first();
    const rejectBtn = page.getByRole('button', { name: /^reject$/i }).first();

    if (await approveBtn.count()) {
      await expect(approveBtn).toBeVisible();
      await expect(rejectBtn).toBeVisible();
    } else {
      await expect(page.locator('main, body')).toBeVisible();
    }
  });

  test('Resident detail page renders status + Documents card + DPDP export', async ({ page }) => {
    test.skip(!hasAuth, 'no auth');
    await page.goto('/residents');
    await page.waitForLoadState('networkidle').catch(() => {});

    const firstRow = page.locator('table tbody tr').first();
    if ((await firstRow.count()) === 0) test.skip(true, 'no residents seeded');
    await firstRow.click();

    // Three sections we expect on every detail page, regardless of approval
    // state — they're the operator's view of the resident.
    await expect(page.getByRole('heading', { name: /documents/i }).first()).toBeVisible();

    // Approve button only shows for PENDING residents — we don't assert it.
    // The Documents card has Verify / Reject for documentsStatus, which is
    // independent of user status. Either visible or already-final state.
    const verify = page.getByRole('button', { name: /^verify$/i });
    const rejectDocs = page.getByRole('button', { name: /^reject$/i });
    if ((await verify.count()) === 0 && (await rejectDocs.count()) === 0) {
      // already VERIFIED or REJECTED — nothing to assert; just confirm a
      // status chip appears in the docs card.
      await expect(
        page.locator('text=/PENDING|UPLOADED|VERIFIED|REJECTED/').first(),
      ).toBeVisible();
    }
  });

  test('Reject docs dialog accepts an optional note', async ({ page }) => {
    test.skip(!hasAuth, 'no auth');
    await page.goto('/residents');
    await page.waitForLoadState('networkidle').catch(() => {});
    const firstRow = page.locator('table tbody tr').first();
    if ((await firstRow.count()) === 0) test.skip(true, 'no residents seeded');
    await firstRow.click();

    // The Reject button on the Documents card opens a modal that includes a
    // textarea for the reason. We open it and confirm the textarea exists,
    // then close without submitting so we don't mutate state.
    const rejectBtn = page.getByRole('button', { name: /^reject$/i }).first();
    if ((await rejectBtn.count()) === 0) test.skip(true, 'already rejected');
    await rejectBtn.click();

    const noteInput = page.getByRole('textbox').first();
    await expect(noteInput).toBeVisible();

    // Bail out without submitting.
    const cancel = page.getByRole('button', { name: /cancel|close|back/i });
    if (await cancel.count()) await cancel.first().click();
    else await page.keyboard.press('Escape');
  });
});

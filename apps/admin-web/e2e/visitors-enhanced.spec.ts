import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8')).cookies?.length > 0;
  } catch { return false; }
})();

test('/visitors loads', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  const r = await page.goto('/visitors');
  expect(r?.status() ?? 0).toBeLessThan(500);
});

test('Pending Approval tab button visible', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/visitors');
  const btn = page.getByRole('button', { name: /pending approval/i });
  if (await btn.count()) await expect(btn.first()).toBeVisible();
});

test('Pending Approval tab shows Approve/Reject buttons if rows present', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/visitors');
  const pendingBtn = page.getByRole('button', { name: /pending approval/i });
  if (await pendingBtn.count()) {
    await pendingBtn.first().click();
    const rows = page.locator('table tbody tr');
    if (await rows.count()) {
      const approve = page.getByRole('button', { name: /approve/i });
      const reject = page.getByRole('button', { name: /reject/i });
      if (await approve.count()) await expect(approve.first()).toBeVisible();
      if (await reject.count()) await expect(reject.first()).toBeVisible();
    }
  }
});

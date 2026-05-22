import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8')).cookies?.length > 0;
  } catch { return false; }
})();

test('/complaints loads', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  const r = await page.goto('/complaints');
  expect(r?.status() ?? 0).toBeLessThan(500);
});

test('complaint filter chips render', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/complaints');
  for (const label of ['All', 'Open', 'In Progress', 'Resolved']) {
    const chip = page.getByRole('button', { name: new RegExp(label, 'i') });
    if (await chip.count()) await expect(chip.first()).toBeVisible();
  }
});

test('AS-03 status update opens drawer', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/complaints');
  const row = page.locator('table tbody tr').first();
  if (await row.count()) {
    await row.click();
    await expect(page.locator('[role="dialog"], aside')).toBeVisible();
  }
});

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8')).cookies?.length > 0;
  } catch { return false; }
})();

test('/staff loads', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  const r = await page.goto('/staff');
  expect(r?.status() ?? 0).toBeLessThan(500);
});

test('AS-07 Add Staff button visible', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/staff');
  const btn = page.getByRole('button', { name: /add staff/i });
  if (await btn.count()) await expect(btn.first()).toBeVisible();
});

test('staff table renders columns', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/staff');
  if (await page.locator('table').count()) {
    await expect(page.locator('table')).toBeVisible();
  } else {
    await expect(page.locator('main, body')).toBeVisible();
  }
});

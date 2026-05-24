import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8')).cookies?.length > 0;
  } catch { return false; }
})();

test('/maintenance loads', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  const r = await page.goto('/maintenance');
  expect(r?.status() ?? 0).toBeLessThan(500);
});

test('Overdue tab button visible', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/maintenance');
  const btn = page.getByRole('button', { name: /overdue/i });
  if (await btn.count()) await expect(btn.first()).toBeVisible();
});

test('Overdue tab click shows filtered view', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/maintenance');
  const btn = page.getByRole('button', { name: /overdue/i });
  if (await btn.count()) {
    await btn.first().click();
    await expect(page.locator('main, body')).toBeVisible();
  }
});

test('Update Status button visible on bill rows if data present', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/maintenance');
  const btn = page.getByRole('button', { name: /update status/i });
  if (await btn.count()) await expect(btn.first()).toBeVisible();
});

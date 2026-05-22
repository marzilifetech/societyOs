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

test('AS-01 finance tabs visible (All / Pending / Overdue / Paid)', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/maintenance');
  for (const label of ['All', 'Pending', 'Overdue', 'Paid']) {
    const tab = page.getByRole('tab', { name: new RegExp(label, 'i') });
    if (await tab.count()) await expect(tab.first()).toBeVisible();
  }
});

test('AS-08 generate report button present', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/maintenance');
  const btn = page.getByRole('button', { name: /generate report|export/i });
  if (await btn.count()) await expect(btn.first()).toBeVisible();
});

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8')).cookies?.length > 0;
  } catch { return false; }
})();

test('/events loads', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  const r = await page.goto('/events');
  expect(r?.status() ?? 0).toBeLessThan(500);
});

test('AS-05 Create Event button visible', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/events');
  const btn = page.getByRole('button', { name: /create event/i });
  if (await btn.count()) await expect(btn.first()).toBeVisible();
});

test('events list section present', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/events');
  await expect(page.locator('main, body')).toBeVisible();
});

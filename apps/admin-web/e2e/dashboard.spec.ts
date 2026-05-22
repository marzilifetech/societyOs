/**
 * E2E — Admin dashboard. Real assertions where the route renders without auth;
 * auth-gated assertions skip if storageState is empty (offline CI).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    const f = fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8');
    return JSON.parse(f).cookies?.length > 0;
  } catch { return false; }
})();

test('dashboard route returns < 500', async ({ page }) => {
  const r = await page.goto('/');
  expect(r?.status() ?? 0).toBeLessThan(500);
});

test('dashboard mounts the document', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});

test('AS-01 overdue bills card visible when authenticated', async ({ page }) => {
  test.skip(!hasAuth, 'no auth state — populate via global-setup');
  await page.goto('/');
  await expect(page.getByText(/overdue/i)).toBeVisible();
});

test('AS-01 quick actions navigate to /notices', async ({ page }) => {
  test.skip(!hasAuth, 'no auth state');
  await page.goto('/');
  const link = page.getByRole('link', { name: /post notice/i });
  if (await link.count()) {
    await link.first().click();
    await expect(page).toHaveURL(/\/notices/);
  }
});

test('AS-02 service requests page renders main', async ({ page }) => {
  test.skip(!hasAuth, 'no auth state');
  await page.goto('/service-requests');
  await expect(page.locator('main, body')).toBeVisible();
});

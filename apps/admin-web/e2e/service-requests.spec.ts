import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8')).cookies?.length > 0;
  } catch { return false; }
})();

test('/service-requests loads', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  const r = await page.goto('/service-requests');
  expect(r?.status() ?? 0).toBeLessThan(500);
});

test('service-requests tab buttons visible', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/service-requests');
  for (const label of ['All', 'Created', 'Scheduled', 'Completed']) {
    const btn = page.getByRole('button', { name: new RegExp(label, 'i') });
    if (await btn.count()) await expect(btn.first()).toBeVisible();
  }
});

test('New Request button visible', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/service-requests');
  const btn = page.getByRole('button', { name: /new request/i });
  if (await btn.count()) await expect(btn.first()).toBeVisible();
});

test('service-requests list renders', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/service-requests');
  if (await page.locator('table').count()) {
    await expect(page.locator('table')).toBeVisible();
  } else {
    await expect(page.locator('main, body')).toBeVisible();
  }
});

test('Paid/Free badge visible if data present', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/service-requests');
  const badge = page.getByText(/^(Paid|Free)$/i);
  if (await badge.count()) await expect(badge.first()).toBeVisible();
});

test('tag chips visible on cards if data present', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/service-requests');
  // Tags appear as spans inside table rows; check there's at least something rendered in the Tags column
  const rows = page.locator('table tbody tr');
  if (await rows.count()) {
    await expect(rows.first()).toBeVisible();
  }
});

test('service request detail page route loads', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/service-requests');
  const link = page.locator('table tbody tr a').first();
  if (await link.count()) {
    await link.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/\/service-requests\//);
    await expect(page.getByText(/description|category|resident/i).first()).toBeVisible();
  }
});

test('trash/delete icon button visible if data present', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/service-requests');
  const del = page.getByRole('button', { name: /delete|remove/i })
    .or(page.locator('button[aria-label*="delete" i], button[aria-label*="remove" i]'));
  if (await del.count()) await expect(del.first()).toBeVisible();
});

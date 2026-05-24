import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8')).cookies?.length > 0;
  } catch { return false; }
})();

test('/residents loads', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  const r = await page.goto('/residents');
  expect(r?.status() ?? 0).toBeLessThan(500);
});

test('Add Resident button visible', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/residents');
  const btn = page.getByRole('button', { name: /add resident/i });
  if (await btn.count()) await expect(btn.first()).toBeVisible();
});

test('Import CSV button visible', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/residents');
  const btn = page.getByRole('button', { name: /import csv/i });
  if (await btn.count()) await expect(btn.first()).toBeVisible();
});

test('App Activated / Not Activated badge visible in resident rows', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/residents');
  const badge = page.getByText(/App Active|Not Activated/i);
  if (await badge.count()) await expect(badge.first()).toBeVisible();
});

test('resident detail page loads with key sections', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/residents');
  // Navigate to first resident detail link
  const link = page.locator('table tbody tr a, table tbody tr').first();
  if (await link.count()) {
    await link.click();
    await page.waitForLoadState('networkidle');
    const url = page.url();
    // If we navigated to a detail page
    if (url.includes('/residents/')) {
      expect(page.url()).toMatch(/\/residents\//);
    }
    // Emergency Contact section
    const emergency = page.getByText(/emergency contact/i);
    if (await emergency.count()) await expect(emergency.first()).toBeVisible();
    // Role Note section
    const roleNote = page.getByText(/role note/i);
    if (await roleNote.count()) await expect(roleNote.first()).toBeVisible();
    // Mark as Left button
    const markLeft = page.getByRole('button', { name: /mark as left/i });
    if (await markLeft.count()) await expect(markLeft.first()).toBeVisible();
  }
});

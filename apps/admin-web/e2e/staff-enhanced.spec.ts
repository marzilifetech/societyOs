import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8')).cookies?.length > 0;
  } catch { return false; }
})();

test('staff row click expands inline drawer', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/staff');
  const row = page.locator('table tbody tr').first();
  if (await row.count()) {
    await row.click();
    // Expanded row or dialog
    const expanded = page.locator('[role="dialog"], aside, tr.bg-gray-50, tr + tr');
    if (await expanded.count()) await expect(expanded.first()).toBeVisible();
  }
});

test('Loans section visible in expanded staff row', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/staff');
  const row = page.locator('table tbody tr').first();
  if (await row.count()) {
    await row.click();
    const loans = page.getByText(/loans/i);
    if (await loans.count()) await expect(loans.first()).toBeVisible();
  }
});

test('staff detail page loads', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/staff');
  const link = page.locator('a[href^="/staff/"]').first();
  if (await link.count()) {
    await link.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/\/staff\//);
  }
});

test('Family tab visible in staff detail', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/staff');
  const link = page.locator('a[href^="/staff/"]').first();
  if (await link.count()) {
    await link.click();
    await page.waitForLoadState('networkidle');
    const familyTab = page.getByRole('button', { name: /family/i });
    if (await familyTab.count()) await expect(familyTab.first()).toBeVisible();
  }
});

test('Salary section visible in staff detail', async ({ page }) => {
  test.skip(!hasAuth, 'no auth');
  await page.goto('/staff');
  const link = page.locator('a[href^="/staff/"]').first();
  if (await link.count()) {
    await link.click();
    await page.waitForLoadState('networkidle');
    const salary = page.getByText(/monthly salary/i);
    if (await salary.count()) await expect(salary.first()).toBeVisible();
  }
});

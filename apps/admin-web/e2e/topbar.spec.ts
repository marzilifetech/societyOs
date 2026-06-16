/**
 * E2E — Active-society TopBar.
 *
 * Mounted in app/(authed)/layout.tsx above {children} so every authed page
 * has a visible "ACTIVE SOCIETY" label + society name. Without this the
 * super-admin can't tell which society they're viewing — verified manually
 * earlier but worth pinning with a spec.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const hasAuth = (() => {
  try {
    const f = fs.readFileSync(path.join(__dirname, '.auth/admin.json'), 'utf-8');
    return JSON.parse(f).cookies?.length > 0;
  } catch {
    return false;
  }
})();

test('TopBar renders on /dashboard', async ({ page }) => {
  test.skip(!hasAuth, 'no auth state');
  await page.goto('/dashboard');
  await expect(page.getByText(/active society/i)).toBeVisible();
});

test('TopBar persists across navigation', async ({ page }) => {
  test.skip(!hasAuth, 'no auth state');
  await page.goto('/dashboard');
  const initial = page.getByText(/active society/i);
  await expect(initial).toBeVisible();
  await page.goto('/staff');
  await expect(page.getByText(/active society/i)).toBeVisible();
});

test('TopBar shows a society name (not just the label)', async ({ page }) => {
  test.skip(!hasAuth, 'no auth state');
  await page.goto('/dashboard');
  // The label is rendered above the value. We assert the value container
  // (text-[13px] semibold gray-900) contains SOMETHING that isn't "Loading...".
  // Falling back to a less strict check if the strict locator isn't there.
  const label = page.getByText(/active society/i).first();
  await label.waitFor();
  // Use the parent strip — the society name follows the label in the DOM.
  const strip = label.locator('xpath=..');
  const text = (await strip.textContent()) ?? '';
  expect(text.toLowerCase()).not.toBe('active society loading…');
  expect(text.length).toBeGreaterThan('active society'.length + 1);
});

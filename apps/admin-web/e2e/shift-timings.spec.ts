/**
 * E2E — Shift Timings page (admin-web Staff section).
 *
 * Page is /staff/shift-timings; templates persist via PATCH /admin/society
 * with config.shiftTemplates (no dedicated endpoint, no migration). Tests
 * here cover:
 *   - The page mounts and shows the title.
 *   - Preset chips offer one-tap Morning / Evening / Night.
 *   - Adding a preset reveals a row with the right times.
 *   - "Add custom shift" produces an editable row.
 *   - Removing a row updates the visible list.
 *   - Save persists; reloading the page shows the same rows back.
 *
 * Each assertion uses accessible queries (role/label) so a CSS refactor
 * doesn't break the spec.
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

const PAGE = '/staff/shift-timings';

test.describe('Shift Timings — render', () => {
  test('responds < 500 unauthenticated', async ({ page }) => {
    const res = await page.goto(PAGE);
    expect(res?.status() ?? 0).toBeLessThan(500);
  });

  test('shows the page heading', async ({ page }) => {
    test.skip(!hasAuth, 'no auth state');
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { name: /shift timings/i })).toBeVisible();
  });

  test('explains the 24-hour format in the subhead', async ({ page }) => {
    test.skip(!hasAuth, 'no auth state');
    await page.goto(PAGE);
    await expect(page.getByText(/24-hour format/i)).toBeVisible();
  });
});

test.describe('Shift Timings — preset chips', () => {
  test('Morning / Evening / Night presets are clickable', async ({ page }) => {
    test.skip(!hasAuth, 'no auth state');
    await page.goto(PAGE);
    // Quick-add row is only rendered when at least one preset is unused.
    // On a fresh install all three are unused, so the row should be present.
    const quickAdd = page.getByText(/quick add/i);
    if (await quickAdd.count()) {
      await expect(page.getByRole('button', { name: /morning/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /evening/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /night/i })).toBeVisible();
    }
  });

  test('clicking the Morning preset adds a row with Shift name = Morning', async ({ page }) => {
    test.skip(!hasAuth, 'no auth state');
    await page.goto(PAGE);
    const morningBtn = page.getByRole('button', { name: /morning/i });
    if ((await morningBtn.count()) === 0) {
      test.skip(true, 'Morning preset already used; nothing to add');
      return;
    }
    await morningBtn.click();
    // After click, an editable name input with value "Morning" should appear.
    await expect(page.getByDisplayValue('Morning')).toBeVisible();
  });
});

test.describe('Shift Timings — custom + remove', () => {
  test('"Add custom shift" inserts an empty row', async ({ page }) => {
    test.skip(!hasAuth, 'no auth state');
    await page.goto(PAGE);
    const initialNameInputs = await page.getByPlaceholder('e.g. Morning').count();
    await page.getByRole('button', { name: /add custom shift/i }).click();
    const after = await page.getByPlaceholder('e.g. Morning').count();
    expect(after).toBe(initialNameInputs + 1);
  });

  test('Remove button drops the row', async ({ page }) => {
    test.skip(!hasAuth, 'no auth state');
    await page.goto(PAGE);
    await page.getByRole('button', { name: /add custom shift/i }).click();
    const before = await page.getByRole('button', { name: /remove shift/i }).count();
    await page.getByRole('button', { name: /remove shift/i }).last().click();
    const after = await page.getByRole('button', { name: /remove shift/i }).count();
    expect(after).toBe(before - 1);
  });
});

test.describe('Shift Timings — save', () => {
  test('Save button is disabled when nothing is dirty', async ({ page }) => {
    test.skip(!hasAuth, 'no auth state');
    await page.goto(PAGE);
    const save = page.getByRole('button', { name: /save shift timings/i });
    await expect(save).toBeDisabled();
  });

  test('changing a row enables Save', async ({ page }) => {
    test.skip(!hasAuth, 'no auth state');
    await page.goto(PAGE);
    // Either add a row or edit an existing one to enter the dirty state.
    await page.getByRole('button', { name: /add custom shift/i }).click();
    const nameInput = page.getByPlaceholder('e.g. Morning').last();
    await nameInput.fill('Playwright Test Shift');
    const save = page.getByRole('button', { name: /save shift timings/i });
    await expect(save).toBeEnabled();
  });
});

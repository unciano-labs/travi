import { test, expect } from '@playwright/test';
import { skipReason, storageStatePath } from '../fixtures/roles';

const reason = skipReason('admin');
test.skip(reason !== null, reason ?? '');
test.use({ storageState: storageStatePath('admin') });

test.describe('Admin (signed in)', () => {
  test('finance page loads', async ({ page }) => {
    await page.goto('/admin/finance');
    await expect(page).toHaveURL(/\/admin\/finance/);
    await expect(page.getByRole('heading', { level: 1, name: 'Finance' })).toBeVisible();
  });

  test('admins are kept out of the user dashboards', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/admin(\/|$)/);
  });
});

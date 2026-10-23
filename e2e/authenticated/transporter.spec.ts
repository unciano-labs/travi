import { test, expect } from '@playwright/test';
import { skipReason, storageStatePath } from '../fixtures/roles';

const reason = skipReason('transporter');
test.skip(reason !== null, reason ?? '');
test.use({ storageState: storageStatePath('transporter') });

test.describe('Transporter (signed in)', () => {
  test('vehicles page lists the fleet or an empty state', async ({ page }) => {
    await page.goto('/dashboard/transporter/vehicles');
    await expect(page).toHaveURL(/\/dashboard\/transporter\/vehicles/);
    await expect(page.getByRole('heading', { level: 1, name: 'Vehicles Fleet' })).toBeVisible();
    await expect(page.getByText('No vehicles listed yet').or(page.getByRole('button', { name: 'Edit Vehicle' }).first())).toBeVisible();
  });
});

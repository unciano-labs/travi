import { test, expect } from '@playwright/test';
import { WRITES_DISABLED_MESSAGE, skipReason, storageStatePath, writesAllowed } from '../fixtures/roles';

const reason = skipReason('organizer');
test.skip(reason !== null, reason ?? '');
test.use({ storageState: storageStatePath('organizer') });

test.describe('Organizer (signed in)', () => {
  test('new tour form shows the publish checklist', async ({ page }) => {
    await page.goto('/dashboard/organizer/tours/new');
    await expect(page.getByRole('heading', { level: 1, name: 'Create New Tour' })).toBeVisible();
    await expect(page.getByText('Before you can publish')).toBeVisible();
    // The checklist loads the server-side readiness, then lists every rule.
    await expect(page.getByText('At least one itinerary day with a title')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('A cover image')).toBeVisible();
    // New tours can only be saved as drafts.
    await expect(page.getByRole('button', { name: 'Published' })).toHaveCount(0);
  });

  test('create a draft tour and see what it still needs to publish', async ({ page }) => {
    test.skip(!writesAllowed, WRITES_DISABLED_MESSAGE);
    const title = `E2E draft ${Date.now()}`;

    await page.goto('/dashboard/organizer/tours/new');
    await page.getByLabel('Tour Title').fill(title);

    // Provinces and cities come from the public PSGC API.
    const province = page.locator('#tour-province');
    await expect(province.locator('option')).not.toHaveCount(1, { timeout: 20_000 });
    await province.selectOption({ index: 1 });
    const city = page.locator('#tour-city');
    await expect(city).toBeEnabled();
    await expect(city.locator('option')).not.toHaveCount(1, { timeout: 20_000 });
    await city.selectOption({ index: 1 });

    await page.getByLabel('Specific Address / Meetup Point').fill('E2E meetup point');
    await page.getByLabel('Description').fill('Created by the automated end-to-end test suite. Safe to delete.');
    await page.getByLabel('Price per Person (₱)').fill('1500');
    await page.getByLabel('Duration (Days)').fill('1');
    await page.getByRole('button', { name: 'Save Tour' }).click();

    await expect(page).toHaveURL(/\/dashboard\/organizer\/tours$/, { timeout: 30_000 });
    const heading = page.getByRole('heading', { name: title });
    await expect(heading).toBeVisible();

    // Open the new draft: a tour without schedules, itinerary or cover cannot be published yet.
    const card = page.locator('div').filter({ has: heading }).filter({ has: page.getByRole('link', { name: 'Edit Tour' }) }).last();
    await card.getByRole('link', { name: 'Edit Tour' }).click();
    await expect(page).toHaveURL(/\/dashboard\/organizer\/tours\/[0-9a-f-]{36}\/edit/);
    await expect(page.getByText('Before you can publish')).toBeVisible();
    await expect(page.getByText('Missing: At least one open schedule with a future start date')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Published' })).toBeDisabled();
  });
});

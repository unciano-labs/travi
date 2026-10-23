import { test, expect } from '@playwright/test';
import { WRITES_DISABLED_MESSAGE, skipReason, storageStatePath, writesAllowed } from '../fixtures/roles';

const reason = skipReason('traveler');
test.skip(reason !== null, reason ?? '');
test.use({ storageState: storageStatePath('traveler') });

test.describe('Traveler (signed in)', () => {
  test('my bookings page loads', async ({ page }) => {
    await page.goto('/dashboard/traveler/bookings');
    await expect(page).toHaveURL(/\/dashboard\/traveler\/bookings/);
    await expect(page.getByRole('heading', { level: 1, name: 'My Bookings' })).toBeVisible();
  });

  test('book a tour and reach the payment page', async ({ page }) => {
    test.skip(!writesAllowed, WRITES_DISABLED_MESSAGE);
    // Creates a PENDING booking; the 15-minute pending expiry releases the seats again.

    const slug = process.env.E2E_TOUR_SLUG;
    if (slug) {
      await page.goto(`/tours/${slug}`);
    } else {
      await page.goto('/tours');
      const firstTour = page.locator('a[href^="/tours/"]:not([href="/tours"])').first();
      await expect(firstTour, 'no published tour on staging; seed one or set E2E_TOUR_SLUG').toBeVisible({ timeout: 15_000 });
      await firstTour.click();
      await expect(page).toHaveURL(/\/tours\/[^/?]+$/);
    }

    const book = page.getByRole('button', { name: /^Book (This|Private) Tour$/ });
    await expect(book, 'the tour has no bookable schedule; seed an open future schedule with seats').toBeEnabled({ timeout: 15_000 });
    await book.click();

    await expect(page).toHaveURL(/\/tours\/[^/]+\/booking\/[0-9a-f-]{36}\/pay/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Complete Payment' })).toBeVisible();
  });
});

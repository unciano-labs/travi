import { test, expect } from '@playwright/test';

test.describe('Tour Exploration & Booking Card Interaction', () => {
  test('Clicking a tour card navigates to tour details with interactive booking card', async ({ page }) => {
    await page.goto('/');

    // Locate the first tour link and click it
    const firstTourLink = page.locator('a[href^="/tours/"]').first();
    await expect(firstTourLink).toBeVisible({ timeout: 10000 });
    
    await firstTourLink.click();
    await expect(page).toHaveURL(/\/tours\/[a-z0-9-]+/);

    // Verify detail page elements
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Verify booking card exists
    const bookingCard = page.locator('.sticky, form, .bg-white.rounded-3xl');
    await expect(bookingCard.first()).toBeVisible();
  });
});

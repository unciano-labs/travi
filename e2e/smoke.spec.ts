import { test, expect } from '@playwright/test';

test.describe('Marketplace Smoke & Navigation', () => {
  test('Landing page loads and renders core elements', async ({ page }) => {
    await page.goto('/');

    // Verify Title & Header
    await expect(page).toHaveTitle(/Travi/i);
    await expect(page.locator('header').getByRole('link', { name: /travi/i })).toBeVisible();

    // Verify Main Hero and CTA
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    
    // Verify Navigation Links
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('Public tours section renders catalog cards', async ({ page }) => {
    await page.goto('/');

    // Wait for tour links to appear
    const tourLinks = page.locator('a[href^="/tours/"]');
    await expect(tourLinks.first()).toBeVisible({ timeout: 10000 });
    
    const count = await tourLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

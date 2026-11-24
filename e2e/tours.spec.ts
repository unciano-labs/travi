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

    // Verify blue verified organizer badge is shown on the booking card and operator section
    const verifiedBadges = page.getByText('Verified organizer');
    await expect(verifiedBadges).toHaveCount(2);

    // Verify booking card exists
    const bookingCard = page.locator('.sticky, form, .bg-white.rounded-3xl');
    await expect(bookingCard.first()).toBeVisible();

    // Verify heading and body share the unified Plus Jakarta Sans font
    const fonts = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const body = document.body;
      return {
        h1Font: h1 ? getComputedStyle(h1).fontFamily : '',
        bodyFont: getComputedStyle(body).fontFamily,
      };
    });
    expect(fonts.h1Font).toBe(fonts.bodyFont);
    expect(fonts.bodyFont.toLowerCase()).toContain('plus jakarta sans');

    // Verify gallery lightbox opens and slides with next/prev controls
    const firstGalleryBtn = page.locator('button[aria-label^="Open gallery image 1 of"]');
    if ((await firstGalleryBtn.count()) > 0) {
      await firstGalleryBtn.first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/^1 \/ \d+$/)).toBeVisible();

      const nextBtn = dialog.getByRole('button', { name: 'Next image' });
      if ((await nextBtn.count()) > 0) {
        await nextBtn.click();
        await expect(dialog.getByText(/^2 \/ \d+$/)).toBeVisible();
        await dialog.getByRole('button', { name: 'Previous image' }).click();
        await expect(dialog.getByText(/^1 \/ \d+$/)).toBeVisible();
      }
      await dialog.getByRole('button', { name: 'Close image modal' }).click();
      await expect(dialog).toBeHidden();
    }
  });

  test('Landing page category tabs filter tours and link to /tours', async ({ page }) => {
    await page.goto('/');

    const categoryTab = page.getByRole('tab', { name: 'Island Hopping' });
    await expect(categoryTab).toBeVisible();
    await categoryTab.click();
    await expect(categoryTab).toHaveAttribute('aria-selected', 'true');

    const browseAllLink = page.locator('#tours a[href^="/tours"]').last();
    await expect(browseAllLink).toHaveAttribute('href', /\/tours\?theme=island_hopping/);
  });

  test('/tours page displays catalog with categories and search', async ({ page }) => {
    await page.goto('/tours');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/adventure/i);
    await expect(page.getByText(/Showing 1–\d+ of \d+ tours/)).toBeVisible();

    // Category navigation
    const catNav = page.getByRole('navigation', { name: 'Tour categories' });
    await catNav.getByRole('link', { name: 'Culinary & Food' }).click();
    await expect(page).toHaveURL(/\/tours\?theme=culinary_food/);
    await expect(page.locator('a[href^="/tours/"]').first()).toBeVisible();

    // Search feature
    const searchInput = page.getByLabel('Where to?');
    await searchInput.fill('Siargao');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/tours\?.*q=Siargao/);
    await expect(page.locator('a[href^="/tours/"]').first()).toBeVisible();
  });

  test('/destinations page displays regional destinations with filters and links to /tours', async ({ page }) => {
    await page.goto('/destinations');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/explore next/i);
    await expect(page.getByText(/Showing \d+ of \d+ Philippine destinations/)).toBeVisible();

    // Region filter
    const visayasTab = page.getByRole('tab', { name: 'Visayas' });
    await visayasTab.click();
    await expect(visayasTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { level: 2, name: 'Cebu' })).toBeVisible();

    // Search destinations
    await page.getByLabel('Search destinations').fill('Bohol');
    await expect(page.getByRole('heading', { level: 2, name: 'Bohol' })).toBeVisible();

    // Explore link navigates to filtered /tours
    await page.getByRole('link', { name: /Explore Tours/i }).first().click();
    await expect(page).toHaveURL(/\/tours\?destination=Bohol/);
  });
});

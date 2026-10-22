import { test, expect } from '@playwright/test';

test.describe('Landing Page Comprehensive E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('1. Navigation Header & Branding', async ({ page }) => {
    // Check Header Logo
    const headerLogo = page.locator('header').getByRole('link', { name: /travi/i });
    await expect(headerLogo).toBeVisible();

    // Check Navigation Anchor Links
    await expect(page.getByRole('link', { name: /tours/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /destinations/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('2. Hero Section & Search Bar Interactivity', async ({ page }) => {
    // Check Hero Headlines
    const heroHeading = page.getByRole('heading', { level: 1 });
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toHaveText(/philippines/i);

    // Check Search Form Elements if present
    const searchInput = page.locator('input[placeholder*="destination" i], input[placeholder*="search" i]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('Manila');
      await expect(searchInput.first()).toHaveValue('Manila');
    }
  });

  test('3. Public Tours Catalog & Card Anatomy', async ({ page }) => {
    // Ensure catalog container is visible
    const tourLinks = page.locator('a[href^="/tours/"]');
    await expect(tourLinks.first()).toBeVisible({ timeout: 10000 });

    const totalTours = await tourLinks.count();
    expect(totalTours).toBeGreaterThan(0);

    // Verify first tour card contains pricing and title text
    const firstTourCard = tourLinks.first();
    await expect(firstTourCard).toBeVisible();
    const cardText = await firstTourCard.textContent();
    expect(cardText?.length).toBeGreaterThan(5);
  });

  test('4. Destinations Section', async ({ page }) => {
    // Check if destinations section exists and has destination elements
    const destinationsHeading = page.getByRole('heading', { name: /destination/i });
    if (await destinationsHeading.count() > 0) {
      await expect(destinationsHeading.first()).toBeVisible();
    }
  });

  test('5. Partner Onboarding Call-to-Action Section', async ({ page }) => {
    // Look for Partner / Organizer / Transporter promotion cards
    const organizerText = page.getByText(/organizer/i);
    await expect(organizerText.first()).toBeVisible();

    const transporterText = page.getByText(/transport/i);
    await expect(transporterText.first()).toBeVisible();
  });

  test('6. Footer & Legal Information', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Verify footer links
    await expect(footer.getByText(/terms|privacy|support|copyright|travi/i).first()).toBeVisible();
  });

  test('7. Mobile Viewport Navigation', async ({ page }) => {
    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Verify Header on mobile
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check if mobile menu button exists
    const menuButton = page.locator('button[aria-label*="menu" i], header button');
    if (await menuButton.count() > 0) {
      await expect(menuButton.first()).toBeVisible();
    }
  });
});

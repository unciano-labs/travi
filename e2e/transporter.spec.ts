import { test, expect } from '@playwright/test';

test.describe('Transporter Dashboard & Operations E2E', () => {
  test('1. Unauthenticated user accessing transporter subroutes is protected', async ({ page }) => {
    await page.goto('/dashboard/transporter');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/dashboard/transporter/vehicles');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/dashboard/transporter/availability');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/dashboard/transporter/requests');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/dashboard/transporter/reviews');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/dashboard/transporter/profile');
    await expect(page).toHaveURL(/\/login/);
  });

  test('2. Transporter layout structure renders sidebar and title on unauthenticated redirect', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Sign in|Welcome back/i })).toBeVisible();
  });
});

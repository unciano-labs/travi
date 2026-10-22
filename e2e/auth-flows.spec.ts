import { test, expect } from '@playwright/test';

// Phase 3.4 Accounts (BIZ-10, BIZ-12, BIZ-15): unauthenticated paths only.
test.describe('Account flows', () => {
  test('login links to forgot password', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
    await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
  });

  test('login shows only known messages from the query string', async ({ page }) => {
    await page.goto('/login?message=check_email');
    await expect(page.getByText('Check your email to confirm your account')).toBeVisible();

    await page.goto('/login?message=Call%20support%20at%20555');
    await expect(page.getByText('Call support at 555')).toHaveCount(0);
  });

  test('protected pages send you to login with a return path', async ({ page }) => {
    await page.goto('/dashboard/traveler/bookings');
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Ftraveler%2Fbookings/);
    await expect(page.locator('input[name="next"]')).toHaveValue('/dashboard/traveler/bookings');
  });

  test('login ignores an off-site next', async ({ page }) => {
    await page.goto('/login?next=//evil.example');
    await expect(page.locator('input[name="next"]')).toHaveCount(0);
  });

  test('signup preselects the partner role from the URL', async ({ page }) => {
    await page.goto('/signup?role=organizer');
    await expect(page.getByRole('radio', { name: /Organizer/ })).toBeChecked();
    await expect(page.locator('#signup-password')).toHaveAttribute('minlength', '8');
  });

  test('reset password without a recovery link offers a new link', async ({ page }) => {
    await page.goto('/auth/reset-password');
    await expect(page.getByRole('heading', { name: 'Reset link expired' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request a new reset link' })).toBeVisible();
  });

  test('auth callback without a code fails safely and never leaves the site', async ({ page }) => {
    await page.goto('/auth/callback?next=//evil.example');
    await expect(page).toHaveURL(/\/login\?message=link_invalid/);
    await expect(page.getByText('That link is invalid or has expired')).toBeVisible();
  });
});

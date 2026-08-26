import { test, expect } from '@playwright/test';

test.describe('Route Guards & RBAC Protection', () => {
  test('Unauthenticated user accessing /admin is redirected to /admin/login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });

  test('Unauthenticated user accessing /dashboard is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });

  test('Unauthenticated user accessing /dashboard/organizer is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard/organizer');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Unauthenticated user accessing /dashboard/transporter is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard/transporter');
    await expect(page).toHaveURL(/\/login/);
  });
});

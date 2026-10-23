import { test as setup, expect } from '@playwright/test';
import { ROLES, credentials, productionTargetReason, storageStatePath, type Role } from '../fixtures/roles';

// Runs once before the "authenticated" project (playwright.config.ts): signs in each role through
// the real login form and saves its cookies, so specs start already signed in.
const LOGIN: Record<Role, { url: string; email: string; password: string; home: RegExp }> = {
  traveler: { url: '/login', email: '#login-email', password: '#login-password', home: /\/dashboard\/traveler/ },
  organizer: { url: '/login', email: '#login-email', password: '#login-password', home: /\/dashboard\/(organizer|traveler)/ },
  transporter: { url: '/login', email: '#login-email', password: '#login-password', home: /\/dashboard\/(transporter|traveler)/ },
  admin: { url: '/admin/login', email: '#admin-login-email', password: '#admin-login-password', home: /\/admin(\/|$)/ },
};

for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const blocked = productionTargetReason();
    setup.skip(blocked !== null, blocked ?? '');
    const creds = credentials(role);
    setup.skip(!creds, `E2E_${role.toUpperCase()}_EMAIL / _PASSWORD not set`);

    const form = LOGIN[role];
    await page.goto(form.url);
    await page.locator(form.email).fill(creds!.email);
    await page.locator(form.password).fill(creds!.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page, `${role} login did not leave the login page; check the credentials and that the account is seeded`).toHaveURL(
      form.home,
      { timeout: 30_000 }
    );
    await page.context().storageState({ path: storageStatePath(role) });
  });
}

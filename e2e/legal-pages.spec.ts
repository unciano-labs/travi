import { test, expect } from '@playwright/test';

// Phase 4 (LEG-01…04, LEG-06, LEG-11): public policy and trust pages render, carry the draft notice
// while LEGAL_REVIEW_COMPLETE is false, and are linked from the footer and the signup form.
const PAGES = [
  { path: '/terms', heading: 'Terms of Service' },
  { path: '/privacy', heading: 'Privacy Notice' },
  { path: '/refund-policy', heading: 'Refund & Cancellation Policy' },
  { path: '/cookies', heading: 'Cookie Policy' },
  { path: '/partner-terms', heading: 'Partner Terms' },
  { path: '/about', heading: 'About Travi' },
  { path: '/faq', heading: 'Frequently Asked Questions' },
  { path: '/contact', heading: 'Contact & Support' },
];

test.describe('Legal and trust pages', () => {
  for (const { path, heading } of PAGES) {
    test(`${path} renders with the draft notice`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.getByText('Draft — pending review by Philippine counsel.')).toBeVisible();
      // Placeholders never leak as raw TODOs.
      await expect(page.getByText(/TODO:/)).toHaveCount(0);
    });
  }

  test('policy pages show their version', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByText(/Version \S+ · Last updated/)).toBeVisible();
  });

  test('footer links to the legal pages and shows the business identity block', async ({ page }) => {
    await page.goto('/about');
    const footer = page.locator('footer');
    for (const name of ['Terms of Service', 'Privacy Notice', 'Cookie Policy', 'Refund & Cancellation', 'Partner Terms']) {
      await expect(footer.getByRole('link', { name })).toBeVisible();
    }
    await expect(footer.getByText('Operated by:')).toBeVisible();
  });

  test('contact form has the complaint topic and validates the booking reference format', async ({ page }) => {
    await page.goto('/contact?topic=complaint_organizer');
    await expect(page.getByLabel('Topic')).toHaveValue('complaint_organizer');
    await expect(page.getByLabel(/Booking reference/)).toHaveAttribute('pattern', '[Bb][Kk]-[0-9A-Fa-f]{6}');
  });

  test('signup requires accepting the Terms and Privacy Notice', async ({ page }) => {
    await page.goto('/signup');
    const consent = page.locator('#signup-accept-terms');
    await expect(consent).toHaveAttribute('required', '');
    await expect(page.getByRole('link', { name: 'Terms of Service' }).first()).toHaveAttribute('href', '/terms');
  });

  test('sitemap lists the legal pages', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml')).text();
    for (const { path } of PAGES) expect(body).toContain(`${path}</loc>`);
  });
});

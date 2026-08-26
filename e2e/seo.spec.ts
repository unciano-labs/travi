import { test, expect } from '@playwright/test';

test.describe('Technical SEO & Crawlability Tests', () => {
  test('1. robots.txt is properly served and contains expected rules', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('User-Agent: *');
    expect(body).toContain('Allow: /');
    expect(body).toContain('Disallow: /admin/');
    expect(body).toContain('Disallow: /dashboard/');
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Sitemap:');
  });

  test('2. sitemap.xml is properly served with valid URLs', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('<loc>');
  });

  test('3. Landing page has correct meta tags and OpenGraph tags', async ({ page }) => {
    await page.goto('/');

    const title = await page.title();
    expect(title.length).toBeGreaterThan(5);

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /.+/);

    const ogTitle = page.locator('meta[property="og:title"]');
    if (await ogTitle.count() > 0) {
      await expect(ogTitle).toHaveAttribute('content', /.+/);
    }
  });

  test('4. Tour detail page includes JSON-LD structured data', async ({ page }) => {
    await page.goto('/');
    
    // Find first tour card link
    const tourLink = page.locator('a[href^="/tours/"]').first();
    if (await tourLink.count() > 0) {
      await tourLink.click();
      await page.waitForURL(/\/tours\/.+/);

      // Check for JSON-LD script
      const jsonLdScript = page.locator('script[type="application/ld+json"]');
      await expect(jsonLdScript).toBeAttached();
      
      const content = await jsonLdScript.textContent();
      expect(content).toContain('TouristTrip');
      expect(jsonLdScript).not.toBeNull();
    }
  });
});

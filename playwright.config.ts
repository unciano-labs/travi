import { defineConfig, devices } from '@playwright/test';

// Target selection:
// - PLAYWRIGHT_TEST_BASE_URL set: test that deployment/server as-is; no local server is started or reused.
// - Otherwise: start the app on PORT (default 3000). CI runs the production build (`next start`, after
//   `npm run build`); locally it runs `next dev` and reuses a dev server that is already running there.
const externalBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;
const isCI = !!process.env.CI;
const port = Number(process.env.PORT) || 3000;
const baseURL = externalBaseURL || `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      // Public, signed-out flows.
      name: 'chromium',
      testIgnore: /authenticated\//,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Signs each role in once and saves its cookies (skips roles without E2E_<ROLE>_* credentials).
      name: 'auth-setup',
      testMatch: /authenticated\/auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Signed-in flows against STAGING only. See e2e/README.md.
      name: 'authenticated',
      testMatch: /authenticated\/.*\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: isCI ? `npm run start -- --port ${port}` : `npm run dev -- --port ${port}`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120 * 1000,
      },
});

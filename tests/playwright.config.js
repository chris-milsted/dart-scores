import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for integration tests.
 *
 * The tests expect the containerised app to be running on localhost:8080.
 * Start it first:
 *   podman run --rm -d -p 8080:8080 --name dart-tracker-test dart-tracker:latest
 * Then run:
 *   npx playwright test
 * Stop after tests:
 *   podman stop dart-tracker-test
 */
export default defineConfig({
  testDir: './integration',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:8080',
    // No JavaScript errors tolerated
    javaScriptEnabled: true,
    // Screenshot on failure
    screenshot: 'only-on-failure',
    // Trace on retry
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});

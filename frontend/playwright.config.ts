import { defineConfig, devices } from '@playwright/test';

/**
 * FAFLOW Playwright E2E configuration.
 *
 * Runs against the backend TestClient (via local dev server).
 * To run: npx playwright test --config=playwright.config.ts
 *
 * Note: These tests require the backend to be running at localhost:8000
 * and the frontend dev server at localhost:5173.
 * Start both before running: see docs/testing.md for full instructions.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // ordered: login must complete before others
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: '../reports/playwright-report', open: 'never' }],
    ['junit', { outputFile: '../reports/playwright-results.xml' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // API requests go directly to backend
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});

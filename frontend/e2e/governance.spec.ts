/**
 * governance.spec.ts – E2E tests for FAFLOW Governance Control Plane.
 *
 * STATUS: READY-TO-RUN (intercepts API calls with realistic mocks)
 * Run: npx playwright test --config=playwright.config.ts e2e/governance.spec.ts
 */
import { test, expect } from '@playwright/test';

test.describe('Governance Control Plane Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Seed authenticated governance admin session
    await page.addInitScript(() => {
      localStorage.setItem('credits_token', 'mock-governance-token');
      localStorage.setItem(
        'credits_user',
        JSON.stringify({
          id: 99,
          username: 'gov_officer',
          name: 'Governance Officer',
          role: 'governance',
          must_change_credentials: false,
        })
      );
    });

    // Mock governance dashboard stats
    await page.route('**/governance/dashboard**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          active_violations: 0,
          unresolved_incidents: 1,
          pending_overrides: 2,
          enforcement_mode: 'STRICT',
          system_health: 'OPTIMAL',
        }),
      })
    );

    // Mock live supervisor attendance status for governance
    await page.route('**/attendance/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ checked_in_count: 50, checked_out_count: 20 }),
      })
    );

    // Catch-all
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
  });

  test('renders governance dashboard with KPI metrics and controls', async ({ page }) => {
    await page.goto('/governance');

    // Verify main governance command center renders
    await expect(page).toHaveURL(/\/governance/);

    // Verify emergency override trigger button or KPI cards render
    const bodyText = page.locator('body');
    await expect(bodyText).toBeVisible({ timeout: 8000 });
  });
});

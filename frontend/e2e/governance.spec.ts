/**
 * governance.spec.ts – E2E tests for FAFLOW Governance Control Plane.
 *
 * STATUS: READY-TO-RUN (intercepts API calls with realistic mocks)
 * Run: npx playwright test --config=playwright.config.ts e2e/governance.spec.ts
 */
import { test, expect } from '@playwright/test';

test.describe('Governance Control Plane Dashboard', () => {
const GOVERNANCE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwicm9sZSI6ImdvdmVybmFuY2UiLCJleHAiOjE4MjIyMTU3NTB9.7o6SdN78Rrw24NEjrpzvCMOp2twsZicsaCKx54imvZs';
const GOVERNANCE_USER = {
  id: 2,
  username: 'governence@26022006',
  name: 'Governance Command Center',
  role: 'governance',
  must_change_credentials: false,
  policy_version_accepted: 'v1.0.0',
  onboarding_completed: true,
};

  test.beforeEach(async ({ page }) => {
    // Seed authenticated governance admin session with real JWT
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('credits_token', token);
      localStorage.setItem('credits_user', JSON.stringify(user));
    }, { token: GOVERNANCE_TOKEN, user: GOVERNANCE_USER });

    // Public settings
    await page.route('**/settings/public', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ institution_name: 'FAFLOW University' }),
      })
    );

    // Mock governance overview
    await page.route('**/governance/overview', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          critical_status: {
            needs_cover_count: 0,
            on_leave_count: 2,
            available_count: 14,
            overrides_today: 1,
          },
          needs_cover_items: [],
          extended_leaves: [],
        }),
      })
    );
  });

  test('renders governance dashboard with KPI metrics and controls', async ({ page }) => {
    await page.goto('/governance');

    // Verify main governance command center renders
    await expect(page).toHaveURL(/\/governance/);

    // Verify Command Center header & KPI cards
    await expect(page.getByText(/Command Center/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Need Cover').first()).toBeVisible();
    await expect(page.getByText('Overrides Today').first()).toBeVisible();

    // Verify emergency override action button
    const overrideBtn = page.getByRole('button', { name: /Override/i }).first();
    await expect(overrideBtn).toBeVisible();
  });
});

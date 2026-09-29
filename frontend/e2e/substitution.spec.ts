/**
 * substitution.spec.ts – E2E tests for FAFLOW substitution workflows.
 *
 * STATUS: READY-TO-RUN (intercepts API calls with realistic mocks)
 * Run: npx playwright test --config=playwright.config.ts e2e/substitution.spec.ts
 */
import { test, expect } from '@playwright/test';

test.describe('Teacher Substitution Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Seed authenticated teacher session
    await page.addInitScript(() => {
      localStorage.setItem('credits_token', 'mock-teacher-token');
      localStorage.setItem(
        'credits_user',
        JSON.stringify({
          id: 5,
          username: 'teacher_jane',
          name: 'Jane Smith',
          role: 'teacher',
          must_change_credentials: false,
        })
      );
    });

    // Public settings
    await page.route('**/settings/public', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ institution_name: 'FAFLOW University' }),
      })
    );

    // Substitution enabled status
    await page.route('**/teacher/substitution/enabled', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ teachers_mode_enabled: true }),
      })
    );

    // Mock teacher leaves requiring substitution
    await page.route('**/teacher/substitution/my-leaves**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 88,
            date: '2026-09-30',
            day_order: 3,
            period_number: 2,
            reason: 'Medical checkup',
            is_emergency: false,
            is_expired: false,
            status: 'approved',
          },
        ]),
      })
    );

    await page.route('**/leaves/my**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await page.route('**/teacher/substitution/active-covers**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await page.route('**/teacher/substitution/past-covers**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await page.route('**/departments**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'Computer Science' }]),
      })
    );
  });

  test('renders substitution dashboard with tabs and leaves list', async ({ page }) => {
    await page.goto('/teacher/substitution');

    // Verify tabs
    const needsCoverTab = page.getByRole('button', { name: /Needs Cover/i });
    await expect(needsCoverTab).toBeVisible({ timeout: 8000 });

    const assignedCoverTab = page.getByRole('button', { name: /Assigned Cover/i });
    await expect(assignedCoverTab).toBeVisible();

    // Verify the mock leave appears in the table
    await expect(page.getByText('Medical checkup').first()).toBeVisible();

    // Verify Assign Sub button exists
    const assignBtn = page.getByRole('button', { name: /Assign Sub/i }).first();
    await expect(assignBtn).toBeVisible();
  });
});

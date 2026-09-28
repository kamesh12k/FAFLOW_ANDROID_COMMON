/**
 * leave.spec.ts – E2E tests for FAFLOW leave application flows.
 *
 * STATUS: READY-TO-RUN (intercepts API calls with realistic mocks)
 * Run: npx playwright test --config=playwright.config.ts e2e/leave.spec.ts
 */
import { test, expect } from '@playwright/test';

test.describe('Teacher Leave Application Flow', () => {
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

    // Mock academic calendar
    await page.route('**/academic-calendar/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          date: '2026-09-29',
          is_working_day: true,
          day_order: 2,
          notes: 'Regular instruction day',
        }),
      })
    );

    // Mock leave policies & balances
    await page.route('**/leave-policies**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Casual Leave', code: 'CL', max_days: 12 },
          { id: 2, name: 'Earned Leave', code: 'EL', max_days: 20 },
        ]),
      })
    );

    await page.route('**/leave-balances/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { policy_id: 1, allocated: 12, used: 2, remaining: 10 },
          { policy_id: 2, allocated: 20, used: 5, remaining: 15 },
        ]),
      })
    );

    // Mock teacher timetable
    await page.route('**/timetable/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    // Fallback catch-all for other endpoints
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
  });

  test('renders leave application form with summary view', async ({ page }) => {
    await page.goto('/teacher/leave/apply');

    // Page must render Request Summary heading
    await expect(page.getByText(/Request Summary/i).first()).toBeVisible({ timeout: 8000 });

    // Cancel link back to leaves history should exist
    const cancelLink = page.getByRole('link', { name: /Cancel/i });
    await expect(cancelLink).toBeVisible();

    // Verify submit button is present
    const submitBtn = page.getByRole('button', { name: /Submit Leave Request|Blocked/i });
    await expect(submitBtn).toBeVisible();
  });
});

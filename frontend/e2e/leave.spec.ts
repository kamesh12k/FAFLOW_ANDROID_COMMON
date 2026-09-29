/**
 * leave.spec.ts – E2E tests for FAFLOW leave application flows.
 *
 * STATUS: READY-TO-RUN (intercepts API calls with realistic mocks)
 * Run: npx playwright test --config=playwright.config.ts e2e/leave.spec.ts
 */
import { test, expect } from '@playwright/test';

test.describe('Teacher Leave Application Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[Browser Console Error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => console.log(`[Browser PageError] ${err.message}`));

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

    // Campus mode & policy
    await page.route('**/campus-operations/mode', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'assisted' }),
      })
    );
    await page.route('**/policy/current', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    );
    await page.route('**/leaves/evaluate-policy', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ can_submit: true, violations: [], projected_balance: 9 }),
      })
    );

    // Mock leave policies & balances
    await page.route('**/leave-policies**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Casual Leave', code: 'CL', entitlement: 12, period: 'YEAR' },
          { id: 2, name: 'Earned Leave', code: 'EL', entitlement: 20, period: 'YEAR' },
        ]),
      })
    );

    await page.route('**/leave-balances/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balances: [
            { policy_id: 1, entitlement: 12, consumed: 2, remaining: 10 },
            { policy_id: 2, entitlement: 20, consumed: 5, remaining: 15 },
          ],
          substitution_credit_balance: 0,
        }),
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

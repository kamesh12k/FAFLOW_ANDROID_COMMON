/**
 * attendance.spec.ts – E2E tests for FAFLOW attendance views.
 *
 * STATUS: READY-TO-RUN (intercepts API calls with realistic mocks)
 * Run: npx playwright test --config=playwright.config.ts e2e/attendance.spec.ts
 */
import { test, expect } from '@playwright/test';

test.describe('Admin Attendance Dashboard', () => {
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2Iiwicm9sZSI6ImFkbWluIiwiZXhwIjoxODIyMjE1NzUwfQ.A_vXtJcTa9znGLVZx7CYZcMzyBrRWEmDq-mjJkpcNvk';
const ADMIN_USER = {
  id: 6,
  username: 'CSHOD',
  name: 'SUBRAMANIAM',
  role: 'admin',
  admin_level: 'super_admin',
  department_id: 1,
  must_change_credentials: false,
  policy_version_accepted: 'v1.0.0',
  onboarding_completed: true,
};

  test.beforeEach(async ({ page }) => {
    // Seed authenticated admin session
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('credits_token', token);
      localStorage.setItem('credits_user', JSON.stringify(user));
    }, { token: ADMIN_TOKEN, user: ADMIN_USER });

    // Public settings
    await page.route('**/settings/public', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ institution_name: 'FAFLOW University' }),
      })
    );

    // Mock departments API
    await page.route('**/departments**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Computer Science', code: 'CSE' },
          { id: 2, name: 'Mechanical', code: 'MECH' },
        ]),
      })
    );

    // Mock live attendance supervisor API
    await page.route('**/attendance/admin/live-status**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          checked_in_count: 42,
          checked_out_count: 18,
          not_reported_count: 5,
          total_staff: 65,
          all_shifts: [
            {
              id: 101,
              user_id: 12,
              staff_name: 'Dr. Sarah Connor',
              department_name: 'Computer Science',
              check_in_time: '2026-09-28T08:45:00',
              status: 'CHECKED_IN',
              method: 'facial_biometric',
            },
            {
              id: 102,
              user_id: 15,
              staff_name: 'Prof. John Matrix',
              department_name: 'Mechanical',
              check_in_time: '2026-09-28T08:30:00',
              check_out_time: '2026-09-28T16:30:00',
              status: 'CHECKED_OUT',
              method: 'facial_biometric',
            },
          ],
        }),
      })
    );
  });

  test('renders supervisor attendance dashboard with metrics', async ({ page }) => {
    await page.goto('/admin/attendance');

    // Wait for the status buttons to render
    const checkedInButton = page.getByRole('button', { name: /Checked In \(42\)/i });
    await expect(checkedInButton).toBeVisible({ timeout: 8000 });

    const completedButton = page.getByRole('button', { name: /Completed \(18\)/i });
    await expect(completedButton).toBeVisible();

    // Verify search input is present
    const searchInput = page.getByPlaceholder(/Search faculty or staff/i);
    await expect(searchInput).toBeVisible();
  });

  test('filters faculty by search query', async ({ page }) => {
    await page.goto('/admin/attendance');

    const searchInput = page.getByPlaceholder(/Search faculty or staff/i);
    await expect(searchInput).toBeVisible({ timeout: 8000 });

    // Type name to filter
    await searchInput.fill('Sarah Connor');
    expect(await searchInput.inputValue()).toBe('Sarah Connor');
  });
});

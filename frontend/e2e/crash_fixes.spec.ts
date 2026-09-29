import { test, expect } from '@playwright/test';

const TEACHER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxODIyMjE2NjE3fQ.H403w9ube8C2LIj0BKTPFeDaNzO8LdCDVdALoPkm6sI';
const TEACHER_USER = {
  id: 11,
  username: '25CSGAA',
  name: 'AISHWARYA G',
  role: 'teacher',
  department_id: 1,
  department: 'Computer Science & Engineering',
  must_change_credentials: false,
  policy_version_accepted: 'v1.0.0',
  onboarding_completed: true,
};

test.describe('Phase 1 Crash Fixes Reproduction & Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Seed authenticated teacher session
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('credits_token', token);
      localStorage.setItem('credits_user', JSON.stringify(user));
    }, { token: TEACHER_TOKEN, user: TEACHER_USER });

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

    // Mock policies
    await page.route('**/leave-policies/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Casual Leave', code: 'CL', max_days_per_year: 12 },
        ]),
      })
    );

    // Mock balances
    await page.route('**/leave-balances/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ balances: [], substitution_credit_balance: 3 }),
      })
    );
  });

  test('Bug 1 — /teacher/leave/apply renders successfully without ReferenceError for AlertTriangleIcon', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('http://localhost:5173/teacher/leave/apply');
    await page.waitForLoadState('domcontentloaded');

    // Verify page header is rendered
    const heading = page.locator('h1:has-text("Apply for Leave")');
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Assert zero page errors (no ReferenceError: AlertTriangleIcon is not defined)
    const refErrors = pageErrors.filter((e) => e.message.includes('AlertTriangleIcon'));
    expect(refErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Bug 4 — /teacher/student-attendance handles 422 validation errors without React Error #31', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('response', (res) => {
      if (res.status() === 401) {
        console.log(`401 DETECTED: ${res.request().method()} ${res.url()}`);
      }
    });

    // Mock classes endpoint to prevent 401 redirect
    await page.route('**/classes**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    // Force 422 Pydantic response on schedule endpoint
    await page.route('**/student-attendance/**', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: [
            {
              type: 'missing',
              loc: ['body', 'period_number'],
              msg: 'Field required',
              input: null,
            },
          ],
        }),
      })
    );

    await page.goto('http://localhost:5173/teacher/student-attendance');
    await page.waitForLoadState('domcontentloaded');

    // Verify page title is rendered
    const title = page.locator('h1:has-text("Student Attendance")');
    await expect(title).toBeVisible({ timeout: 10000 });

    // Verify error banner rendered the formatted text
    const errorAlert = page.locator('text=period_number: Field required');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });

    // Assert zero minified React Error #31 or other page errors occurred
    const react31Errors = pageErrors.filter(
      (e) => e.message.includes('Minified React error #31') || e.message.includes('Objects are not valid as a React child')
    );
    expect(react31Errors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});

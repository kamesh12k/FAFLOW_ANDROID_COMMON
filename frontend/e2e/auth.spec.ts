/**
 * auth.spec.ts – E2E tests for FAFLOW authentication flows.
 *
 * STATUS: READY-TO-RUN (requires running backend + frontend dev server)
 * Run: npx playwright test --config=playwright.config.ts e2e/auth.spec.ts
 *
 * The tests use API route interception so they don't need a real database.
 * They verify the UI behaviour given mocked API responses.
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/settings/public', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ institution_name: 'FAFLOW University' }),
      })
    );
  });

  test('login page renders key elements', async ({ page }) => {
    // Intercept – no real backend needed for render test
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(page).toHaveTitle(/FAFLOW|Login|Attendance/i);
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('invalid credentials shows error message', async ({ page }) => {
    // Mock the auth endpoint to return 401
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Incorrect username or password' }),
      })
    );

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithUsername('baduser', 'badpassword');

    // Error alert must appear
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('successful login redirects away from login page', async ({ page }) => {
    // Mock a successful login response with an access token matching backend Token schema
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-token',
          token_type: 'bearer',
          user: {
            id: 1,
            name: 'Test Teacher',
            email: 'teacher1@college.edu',
            role: 'teacher',
            department: 'Computer Science',
            must_change_credentials: false,
          },
        }),
      })
    );

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithUsername('teacher1', 'password123');

    // After successful login, URL should change away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 8000 });
    expect(page.url()).not.toContain('/login');
  });
});

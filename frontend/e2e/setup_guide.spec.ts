import { test, expect } from '@playwright/test';

test.describe('Admin Setup Guide & Readiness (/admin/setup)', () => {
  test.beforeEach(async ({ page }) => {
    // Generate valid JWT token for CSHOD (id=6) and set in localStorage
    await page.addInitScript(() => {
      localStorage.setItem(
        'credits_token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2Iiwicm9sZSI6ImFkbWluIiwiZXhwIjoxODA2MjI2MTU2fQ.y7KJNWFtTxEEXMxZ7Kb14InFYITPggYH-5iTzOe2Mxo'
      );
      localStorage.setItem(
        'credits_user',
        JSON.stringify({
          id: 6,
          username: 'CSHOD',
          name: 'CS Department Head',
          role: 'admin',
          admin_level: 'super_admin',
          department_id: 1,
          must_change_credentials: false,
          policy_version_accepted: '1.0',
          onboarding_completed: true,
        })
      );
    });
  });

  test('renders roadmap with all 10 step action buttons with full text and no leaked querySelector strings', async ({ page }) => {
    await page.goto('/admin/setup');
    await expect(page.locator('h1')).toContainText('Admin Setup Guide', { timeout: 10000 });

    // Wait for progress percentage to appear
    await expect(page.locator('main')).toContainText('%');

    // Verify no stray querySelector or template strings are visible
    const mainText = await page.locator('main').innerText();
    expect(mainText).not.toContain('document.querySelector');
    expect(mainText).not.toContain('querySelector(');

    // Verify all 10 step action buttons render with expected descriptive text
    const expectedActionTexts = [
      'Manage Departments',
      'Configure Academic Calendar',
      'Configure Rooms & Labs',
      'Manage Faculty',
      'Configure Classes',
      'Manage Subjects',
      'Import / Add Students',
      'Generate Day Order Schedule',
      'Build Timetable Schedule',
      'Configure Geofences',
    ];

    const stepButtons = page.locator('.space-y-4 .card a.btn');
    const buttonCount = await stepButtons.count();
    expect(buttonCount).toBe(10);

    for (let i = 0; i < expectedActionTexts.length; i++) {
      const button = stepButtons.nth(i);
      await expect(button).toContainText(expectedActionTexts[i]);
      await expect(button).toContainText('→');
      // Ensure button is not empty or just an arrow
      const text = (await button.innerText()).trim();
      expect(text).not.toBe('→');
      expect(text.length).toBeGreaterThan(5);
    }
  });

  test('navigates across all 5 tabs and confirms interactive functionality without errors', async ({ page }) => {
    await page.goto('/admin/setup');
    await expect(page.locator('h1')).toContainText('Admin Setup Guide');

    // Tab 2: Visual Dependency Map
    await page.getByRole('button', { name: /Visual Dependency Map/i }).click();
    await expect(page.locator('h2')).toContainText('Evidence-Driven Architecture & Dependency Map');
    await expect(page.getByText('11 Verified Entity Nodes')).toBeVisible();

    // Tab 3: Runtime Data Flows
    await page.getByRole('button', { name: /Runtime Data Flows/i }).click();
    await expect(page.getByRole('button', { name: /Class Timetable Workflow/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Faculty Leave Workflow/i })).toBeVisible();

    // Tab 4: Module Readiness Matrix
    await page.getByRole('button', { name: /Module Readiness Matrix/i }).click();
    await expect(page.locator('h2')).toContainText('Functional Module Readiness');
    await expect(page.locator('text=Ready for faculty usage').first()).toBeVisible();

    // Tab 5: Searchable Guide & FAQs
    await page.getByRole('button', { name: /Searchable Guide & FAQs/i }).click();
    await page.getByPlaceholder(/Search topics/i).fill('Timetable');
    await expect(page.getByText('Why is my Timetable configuration blocked?')).toBeVisible();
  });
});

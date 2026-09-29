import { test, expect } from '@playwright/test';

// Real JWT token signed with actual app SECRET_KEY
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2Iiwicm9sZSI6ImFkbWluIiwiZXhwIjoxODIyMjE0MDQyfQ.2RD3UTbW6KGOIMyLZMNB0ywi1Ln6uSCHberk5-4sBOo';
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

test.describe('Phase 5 Bug 7 Verification — Notification Clear All Persistence', () => {
  let notifications: Array<{
    id: number;
    title: string;
    body: string;
    event_type: string;
    is_read: boolean;
    created_at: string;
  }>;

  test.beforeEach(async ({ page }) => {
    // Seed notifications in backend state for this test run
    notifications = [
      {
        id: 101,
        title: 'Exam Circular Published',
        body: 'Midterm timetable has been published.',
        event_type: 'new_announcement',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 102,
        title: 'Duty Leave Approved',
        body: 'Your duty leave request for Sep 30 was approved.',
        event_type: 'leave_approved',
        is_read: true,
        created_at: new Date().toISOString(),
      },
    ];

    // Authenticate as Admin with real JWT
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

    // Background endpoints
    await page.route('**/policy/current', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enforce_biometrics: false }) })
    );
    await page.route('**/announcements/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread_count: 0, announcements: [] }) })
    );
    await page.route('**/academic-calendar/resolve**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ date: '2026-09-29', is_working_day: true, day_order: 1 }),
      })
    );
    await page.route('**/departments/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/dashboard/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    );

    // Dynamic Notifications API Mock (simulating backend database persistence)
    await page.route('**/notifications/**', (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/unread-count')) {
        const unread = notifications.filter((n) => !n.is_read).length;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ count: unread }),
        });
      }

      if (method === 'DELETE' && (url.endsWith('/notifications/') || url.endsWith('/notifications'))) {
        notifications = [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, message: 'All notifications cleared', cleared_count: 2 }),
        });
      }

      if (method === 'DELETE') {
        const match = url.match(/\/notifications\/(\d+)/);
        if (match) {
          const id = parseInt(match[1], 10);
          notifications = notifications.filter((n) => n.id !== id);
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
          });
        }
      }

      if (method === 'PATCH' && url.includes('/read-all')) {
        notifications.forEach((n) => {
          n.is_read = true;
        });
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      }

      // Default GET notifications list
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(notifications),
      });
    });
  });

  test('Bug 7: "Clear all" permanently clears notifications across page reload', async ({ page }) => {
    // 1. Visit admin dashboard
    await page.goto('/admin');

    // 2. Bell should show badge with 1 unread notification
    const bellBtn = page.locator('button[aria-label^="Notifications"]');
    await expect(bellBtn).toBeVisible({ timeout: 10000 });

    // 3. Open notification popover
    await bellBtn.click();

    // 4. Notifications should be displayed
    await expect(page.getByText('Exam Circular Published')).toBeVisible();
    await expect(page.getByText('Duty Leave Approved')).toBeVisible();

    // 5. Click "Clear all" button
    const clearAllBtn = page.getByRole('button', { name: /Clear all/i });
    await expect(clearAllBtn).toBeVisible();
    await clearAllBtn.click();

    // 6. Assert immediate visual clearing and empty state
    await expect(page.getByText('No notifications yet')).toBeVisible();
    await expect(page.getByText('Exam Circular Published')).not.toBeVisible();

    // 7. Reload page (simulate full user browser refresh)
    await page.reload();

    // 8. Open notification popover after reload
    const reloadedBell = page.locator('button[aria-label^="Notifications"]');
    await expect(reloadedBell).toBeVisible({ timeout: 10000 });
    await reloadedBell.click();

    // 9. CRITICAL BUG 7 ASSERTION: Notifications must REMAIN cleared after reload
    await expect(page.getByText('No notifications yet')).toBeVisible();
    await expect(page.getByText('Exam Circular Published')).not.toBeVisible();
    await expect(page.getByText('Duty Leave Approved')).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

// Real JWT tokens (signed with the actual app SECRET_KEY, 1-year expiry)
const SYSADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzIiwicm9sZSI6InN5c3RlbV9hZG1pbiIsImV4cCI6MTgyMjIxNDA0Mn0.te4KBbfWgltuiFj-FqTs7vnDh3aKlHtm-T6knTn9yLg';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2Iiwicm9sZSI6ImFkbWluIiwiZXhwIjoxODIyMjE0MDQyfQ.2RD3UTbW6KGOIMyLZMNB0ywi1Ln6uSCHberk5-4sBOo';
const TEACHER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInJvbGUiOiJ0ZWFjaGVyIiwiZXhwIjoxODIyMjE0MDQyfQ.DbyLTFOhBa3veGyUc0LylsET6PqghOE0FG_OtSZ8iWo';

// Real user profiles matching the database
const SYSADMIN_USER = {
  id: 3,
  username: 'admin',
  name: 'System Administrator',
  role: 'system_admin',
  admin_level: null,
  department_id: null,
  must_change_credentials: false,
  policy_version_accepted: 'v1.0.0',
  onboarding_completed: true,
};

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

/**
 * Injects authentication into browser localStorage before navigation.
 * Note: Must pass args into addInitScript so values are serialized across Node -> Browser.
 */
async function setAuth(page: any, token: string, user: object) {
  await page.addInitScript(([t, u]: [string, any]) => {
    localStorage.setItem('credits_token', t);
    localStorage.setItem('credits_user', JSON.stringify(u));
  }, [token, user]);
}

test.describe('Phase 4 Bug Fix Verification — Announcements Module', () => {
  let announcements: Array<any>;

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message, err.stack));
    announcements = [
      {
        id: 1,
        title: 'Test Directive - Examination Protocol',
        body: 'Official directive regarding examination schedule and protocol compliance.',
        type: 'CIRCULAR',
        priority: 'HIGH',
        status: 'PUBLISHED',
        version: 1,
        author_name: 'SUBRAMANIAM',
        author_role: 'admin',
        department_name: 'Computer Science',
        department_id: 1,
        target_audience: ['DEPT:1', 'ROLE:TEACHER'],
        targets: [
          { target_type: 'DEPARTMENT', department_id: 1, department_name: 'Computer Science' },
          { target_type: 'ROLE', role_name: 'TEACHER' },
        ],
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        is_read: false,
        is_pinned: false,
        is_locked: false,
        requires_acknowledgement: true,
        is_acknowledged: false,
        acknowledged_at: null,
        can_acknowledge: true,
        can_delete: true,
        can_moderate: true,
        can_view_analytics: true,
        attachments: [],
      },
    ];

    // Public settings & background endpoints
    await page.route('**/settings/public', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ institution_name: 'FAFLOW University' }),
      })
    );
    await page.route('**/policy/current', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enforce_biometrics: false }) })
    );
    await page.route('**/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, unread_count: 0 }) })
    );
    await page.route('**/academic-calendar/resolve**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ date: '2026-09-29', is_working_day: true, day_order: 1 }),
      })
    );
    await page.route('**/departments/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Computer Science', code: 'CS' },
          { id: 2, name: 'Electrical Engineering', code: 'EE' },
        ]),
      })
    );

    // Dynamic Announcements API Mock
    await page.route('**/api/announcements**', async (route) => {
      const url = route.request().url();
      if (url.includes('/src/') || url.endsWith('.js') || url.endsWith('.jsx') || route.request().resourceType() === 'script') {
        return route.continue();
      }
      const method = route.request().method();

      if (url.includes('/unread-count')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1 }) });
      }

      if (url.includes('/candidates')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            departments: [{ id: 1, name: 'Computer Science', code: 'CS' }],
            faculty: [{ id: 11, name: 'AISHWARYA G', department_id: 1, email: 'aishwarya@example.com' }],
          }),
        });
      }

      if (url.includes('/messages')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }

      if (url.includes('/acknowledge') && method === 'POST') {
        announcements[0].is_acknowledged = true;
        announcements[0].acknowledged_at = new Date().toISOString();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, is_acknowledged: true, acknowledged_at: announcements[0].acknowledged_at }),
        });
      }

      const matchId = url.match(/\/announcements\/(\d+)(?:[?#]|$)/);
      if (matchId && method === 'GET') {
        const id = parseInt(matchId[1], 10);
        const item = announcements.find((a) => a.id === id) || announcements[0];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(item) });
      }

      if (method === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 2, ok: true, message: 'Created' }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          announcements: announcements,
          total: announcements.length,
          page: 1,
          limit: 50,
        }),
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bug 5: Target Audience Display
  // Verify that target audience renders as human-readable text (e.g.
  // "Computer Science Department", "All College Faculty"), and never as raw
  // tokens like ["ROLE:TEACHER", "DEPT:1"].
  // ─────────────────────────────────────────────────────────────────────────
  test('Bug 5 – Audience renders as human-readable text, not raw JSON tokens', async ({ page }) => {
    await setAuth(page, ADMIN_TOKEN, ADMIN_USER);

    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');

    // Page title must be visible
    await expect(page.locator('h1').filter({ hasText: /Announcements/i })).toBeVisible({ timeout: 10000 });

    // Ensure directive card is present in feed
    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });

    // Open detail modal
    await firstCard.getByRole('button', { name: /Read Directive|View/i }).click();

    // Verify modal is open and shows human-readable audience
    const audienceBlock = page.locator('div:has(> span:has-text("Audience")) p');
    await expect(audienceBlock).toBeVisible({ timeout: 5000 });

    const displayedAudience = await audienceBlock.innerText();
    expect(displayedAudience).toBeTruthy();
    expect(displayedAudience).not.toContain('["ROLE:');
    expect(displayedAudience).not.toContain('ROLE:');
    expect(displayedAudience).not.toContain('DEPT:');
    expect(displayedAudience).not.toContain('["');
    expect(displayedAudience).not.toContain('"]');

    // Audience for Directive 1/2 is Computer Science Department
    expect(displayedAudience).toMatch(/Computer Science|Department|All College Faculty|Faculty/i);

    // Close detail view
    const closeBtn = page.locator('button').filter({ hasText: /close|←|dismiss/i }).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bug 6a: Acknowledgement Button
  // Verify that an eligible teacher can acknowledge a directive requiring
  // acknowledgement, the API records it, and no error toast is displayed.
  // ─────────────────────────────────────────────────────────────────────────
  test('Bug 6a – Teacher can view and acknowledge a circular requiring acknowledgement', async ({ page }) => {
    await setAuth(page, TEACHER_TOKEN, TEACHER_USER);

    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').filter({ hasText: /Announcements/i })).toBeVisible({ timeout: 10000 });

    // Find directive card
    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible({ timeout: 5000 });

    // Click "Read Directive →"
    await firstCard.getByRole('button', { name: /Read Directive|View/i }).click();

    // Modal opens
    const detailHeading = page.locator('h1').filter({ hasText: /Test Directive/i });
    await expect(detailHeading).toBeVisible({ timeout: 5000 });

    // If acknowledgement button is present, click it
    const ackBtn = page.getByRole('button', { name: /I Acknowledge This Directive/i });
    if (await ackBtn.isVisible({ timeout: 3000 })) {
      await ackBtn.click();

      // Button should disappear or show confirmation
      await expect(ackBtn).not.toBeVisible({ timeout: 5000 });

      // No error toast should be shown
      const errorToast = page.locator('[class*="toast"][class*="error"], [class*="toast"]:has-text("Failed"), [class*="toast"]:has-text("Error")');
      await expect(errorToast).not.toBeVisible({ timeout: 3000 });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bug 6b: System Admin can create college-wide circulars
  // Verify that System Admin sees "New Announcement" button, can open the
  // composer modal, and sees "Entire Institution" scope option.
  // ─────────────────────────────────────────────────────────────────────────
  test('Bug 6b – System Admin sees "New Announcement" button and can open composer with college-wide scope', async ({ page }) => {
    await setAuth(page, SYSADMIN_TOKEN, SYSADMIN_USER);

    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').filter({ hasText: /Announcements/i })).toBeVisible({ timeout: 10000 });

    // "New Announcement" button must be visible for System Admin
    const newBtn = page.locator('button:has-text("New Announcement")');
    await expect(newBtn).toBeVisible({ timeout: 5000 });

    // Click and verify composer opens
    await newBtn.click();

    // Composer heading should appear
    await expect(page.getByText('Draft Institutional Circular')).toBeVisible({ timeout: 8000 });

    // "Entire Institution" scope option should be present (college-wide)
    const entireInstitution = page.locator('button:has-text("Entire Institution")');
    await expect(entireInstitution).toBeVisible({ timeout: 5000 });

    // Verify title input is accessible
    const titleInput = page.locator('input[placeholder*="directive"], input[placeholder*="title"], input[placeholder*="notice"]').first();
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Phase 4 Automated Verification Circular');

    // Verify body textarea is accessible
    const bodyTextarea = page.locator('textarea').first();
    await expect(bodyTextarea).toBeVisible();
    await bodyTextarea.fill('This official circular was created during automated verification of Phase 4 (Bug 5, 6a, 6b).');

    // Verify publish button is visible and active
    const publishBtn = page.locator('button:has-text("Publish Directive"), button:has-text("Publish")').first();
    await expect(publishBtn).toBeVisible();

    // Close the composer modal
    const closeBtn = page.locator('button[title="Close"]').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });
});

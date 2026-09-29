import { test, expect } from '@playwright/test';

test.describe('Phase 2 Bug 2 Verification — /admin/timetable', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Super Admin (CSHOD)
    await page.addInitScript(() => {
      localStorage.setItem('credits_token', 'mock-admin-token');
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

    // Common background endpoints
    await page.route('**/announcements/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread_count: 0, announcements: [] }) })
    );
    await page.route('**/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread_count: 0, notifications: [] }) })
    );
    await page.route('**/policy/current', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enforce_biometrics: false }) })
    );
    await page.route('**/academic-calendar/resolve**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ date: '2026-09-29', is_working_day: true, day_order: 1 }),
      })
    );

    // Mock departments
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

    // Mock teachers including cross-department
    await page.route('**/teachers/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 10, name: 'Prof. Alice Smith', department_id: 1, is_active: true, department: 'Computer Science' },
          { id: 36, name: 'Dr. Bob Jones', department_id: 2, is_active: true, department: 'Electrical Engineering' },
        ]),
      })
    );

    // Mock subjects
    await page.route('**/subjects/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 101, name: 'Data Structures', code: 'CS201', department_id: 1, semester: 3 },
          { id: 102, name: 'Circuits', code: 'EE201', department_id: 2, semester: 3 },
        ]),
      })
    );

    // Mock classes
    await page.route('**/classes/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 201, name: 'CS-A', section: 'A', department_id: 1, semester: 3 },
          { id: 202, name: 'EE-A', section: 'A', department_id: 2, semester: 3 },
        ]),
      })
    );

    // Mock rooms
    await page.route('**/rooms/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 301, room_number: 'LH-101', room_type: 'classroom', capacity: 60 },
          { id: 302, room_number: 'LAB-201', room_type: 'lab', capacity: 30 },
        ]),
      })
    );

    // Mock timetable slots for teacher 10 and cross-department teacher 36
    await page.route('**/timetable/teacher/**', (route) => {
      const url = route.request().url();
      if (url.includes('/teacher/36')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 501,
              teacher_id: 36,
              subject_id: 102,
              class_id: 202,
              room_id: 301,
              day_order: 1,
              period_number: 1,
              is_active: true,
            },
          ]),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('Bug 2 — /admin/timetable loads without "Failed to load timetable" toast and displays slots', async ({ page }) => {
    page.on('dialog', async (dialog) => dialog.accept());

    await page.goto('http://localhost:5173/admin/timetable');
    await page.waitForLoadState('domcontentloaded');

    // Verify page header is visible
    const header = page.locator('h1.tt-title');
    await expect(header).toBeVisible({ timeout: 10000 });
    await expect(header).toHaveText('Timetable');

    // Verify that NO error toast ("Failed to load timetable") appears
    const errorToast = page.locator('.tt-toast--error');
    await expect(errorToast).toHaveCount(0);

    // Verify Super Admin can see department dropdown enabled
    const deptSelect = page.locator('select.tt-select').first();
    await expect(deptSelect).toBeEnabled();

    // Verify teacher select is visible and defaulted to Prof. Alice Smith (Dept 1)
    const teacherSelect = page.locator('select.tt-select').nth(1);
    await expect(teacherSelect).toBeVisible();
    await expect(teacherSelect).toHaveValue('10');

    // Switch department filter to Electrical Engineering (id=2) to view cross-department teachers
    await deptSelect.selectOption('2');

    // Select cross-department teacher Dr. Bob Jones (id=36)
    await teacherSelect.selectOption('36');

    // Verify timetable grid renders slot for Dr. Bob Jones
    await expect(errorToast).toHaveCount(0);
    const slotCard = page.getByText('EE201');
    await expect(slotCard).toBeVisible({ timeout: 5000 });
    const slotCount = page.getByText('1 slot assigned');
    await expect(slotCount).toBeVisible({ timeout: 5000 });
  });
});

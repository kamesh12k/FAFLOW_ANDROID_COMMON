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

    // Public settings & common background endpoints
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
    await page.route('**/announcements/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread_count: 0, announcements: [] }) })
    );

    // Mock setup readiness endpoint
    await page.route('**/admin/setup-readiness', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_steps: 10,
          completed_steps: 10,
          progress_percent: 100,
          steps: [
            {
              id: 'departments',
              step_number: 1,
              title: 'Academic Departments',
              category: 'foundation',
              why_required: 'Departments form the organizational backbone.',
              what_depends_on_it: ['Faculty Accounts', 'Class Sections', 'Curriculum Subjects'],
              required_fields: ['Department Name', 'Code'],
              config_url: '/admin/departments',
              action_text: 'Manage Departments',
              current_count: 5,
              unit_label: 'departments configured',
              status: 'ready',
              is_complete: true,
              is_blocked: false,
              prerequisites: [],
              block_reason: null,
            },
            {
              id: 'academic_calendar',
              step_number: 2,
              title: 'Academic Calendar & Terms',
              category: 'foundation',
              why_required: 'Calendar defines teaching terms and rotational cycle.',
              what_depends_on_it: ['Day Order Sequences', 'Timetable Matrix'],
              required_fields: ['Academic Year', 'Term Start', 'Term End'],
              config_url: '/admin/academic-calendar',
              action_text: 'Configure Academic Calendar',
              current_count: 2,
              unit_label: 'calendar terms active',
              status: 'ready',
              is_complete: true,
              is_blocked: false,
              prerequisites: [],
              block_reason: null,
            },
            {
              id: 'rooms',
              step_number: 3,
              title: 'Rooms, Lecture Halls & Labs',
              category: 'structure',
              why_required: 'Physical spaces for timetable slots.',
              what_depends_on_it: ['Timetable Slots', 'Lab Sessions'],
              required_fields: ['Room Number', 'Room Type', 'Capacity'],
              config_url: '/admin/rooms',
              action_text: 'Configure Rooms & Labs',
              current_count: 15,
              unit_label: 'venues available',
              status: 'ready',
              is_complete: true,
              is_blocked: false,
              prerequisites: [],
              block_reason: null,
            },
            {
              id: 'teachers',
              step_number: 4,
              title: 'Faculty Members & Staff',
              category: 'people',
              why_required: 'Staff take attendance and conduct lectures.',
              what_depends_on_it: ['Timetable Assignments', 'Substitution Engine'],
              required_fields: ['Full Name', 'Email', 'Department'],
              config_url: '/admin/teachers',
              action_text: 'Manage Faculty',
              current_count: 28,
              unit_label: 'faculty members registered',
              status: 'ready',
              is_complete: true,
              is_blocked: false,
              prerequisites: [],
              block_reason: null,
            },
            {
              id: 'classes',
              step_number: 5,
              title: 'Classes & Sections',
              category: 'structure',
              why_required: 'Cohort groups for scheduling.',
              what_depends_on_it: ['Students', 'Timetable'],
              required_fields: ['Class Name', 'Section', 'Department'],
              config_url: '/admin/classes',
              action_text: 'Configure Classes',
              current_count: 8,
              unit_label: 'classes configured',
              status: 'ready',
              is_complete: true,
              is_blocked: false,
              prerequisites: [],
              block_reason: null,
            },
            {
              id: 'subjects',
              step_number: 6,
              title: 'Course Subjects & Curriculum',
              category: 'curriculum',
              why_required: 'Course curriculum with credit weights.',
              what_depends_on_it: ['Timetable Slots', 'Attendance'],
              required_fields: ['Subject Code', 'Subject Name', 'Credits'],
              config_url: '/admin/subjects',
              action_text: 'Manage Subjects',
              current_count: 24,
              unit_label: 'subjects cataloged',
              status: 'ready',
              is_complete: true,
              is_blocked: false,
              prerequisites: [],
              block_reason: null,
            },
            {
              id: 'students',
              step_number: 7,
              title: 'Student Directory',
              category: 'people',
              why_required: 'Enrolled students receiving attendance.',
              what_depends_on_it: ['Attendance Sessions', 'Absence Alerts'],
              required_fields: ['Roll Number', 'Full Name', 'Class Section'],
              config_url: '/admin/classes',
              action_text: 'Import / Add Students',
              current_count: 320,
              unit_label: 'students enrolled',
              status: 'ready',
              is_complete: true,
              is_blocked: false,
              prerequisites: [],
              block_reason: null,
            },
            {
              id: 'day_order',
              step_number: 8,
              title: 'Day Order Schedule',
              category: 'scheduling',
              why_required: '6-Day rotational order cycle.',
              what_depends_on_it: ['Daily Timetable Matcher'],
              required_fields: ['Calendar Dates', 'Day Orders (1-6)'],
              config_url: '/admin/academic-calendar',
              action_text: 'Generate Day Order Schedule',
              current_count: 90,
              unit_label: 'days scheduled',
              status: 'ready',
              is_complete: true,
              is_blocked: false,
              prerequisites: [],
              block_reason: null,
            },
            {
              id: 'timetable',
              step_number: 9,
              title: 'Timetable Matrix',
              category: 'scheduling',
              why_required: 'Master slot mapping.',
              what_depends_on_it: ['Live Class Attendance', 'Substitution Alerts'],
              required_fields: ['Class', 'Subject', 'Teacher', 'Day Order', 'Period'],
              config_url: '/admin/timetable',
              action_text: 'Build Timetable Schedule',
              current_count: 140,
              unit_label: 'timetable slots scheduled',
              status: 'ready',
              is_complete: true,
              is_blocked: false,
              prerequisites: [],
              block_reason: null,
            },
            {
              id: 'geofences',
              step_number: 10,
              title: 'Campus Geofences',
              category: 'operations',
              why_required: 'GPS boundaries for staff attendance punch-in.',
              what_depends_on_it: ['Mobile Check-In', 'Duty Punch Verification'],
              required_fields: ['Campus Center Coordinates', 'Radius in Meters'],
              config_url: '/admin/geofences',
              action_text: 'Configure Geofences',
              current_count: 3,
              unit_label: 'geofence zones active',
              status: 'ready',
              is_complete: true,
              is_blocked: false,
              prerequisites: [],
              block_reason: null,
            },
          ],
          module_readiness: [
            {
              id: 'student_attendance',
              name: 'Student Attendance Module',
              description: 'Allows teachers to mark period attendance with real-time absence tracking.',
              status: 'READY',
              status_label: 'Operational & Ready',
              route_url: '/admin/student-attendance',
              action_text: 'Open Student Attendance',
              requirements: [{ title: 'All Prerequisites Met', is_satisfied: true }],
              missing_prerequisites: [],
            },
            {
              id: 'timetable',
              name: 'Master Timetable & Scheduling',
              description: 'Controls weekly class schedules, room allocations, and faculty period assignments.',
              status: 'READY',
              status_label: 'Ready for Scheduling',
              route_url: '/admin/timetable',
              action_text: 'Open Timetable Grid',
              requirements: [{ title: 'Timetable Matrix Mapped', is_satisfied: true }],
              missing_prerequisites: [],
            },
            {
              id: 'substitutions',
              name: 'Leave & Auto-Substitution Engine',
              description: 'Finds conflict-free substitute faculty and dispatches alter-assignment alerts.',
              status: 'READY',
              status_label: 'Active & Ready',
              route_url: '/admin/today-substitutions',
              action_text: 'View Substitutions',
              requirements: [{ title: 'Faculty & Slots Linked', is_satisfied: true }],
              missing_prerequisites: [],
            },
            {
              id: 'staff_attendance',
              name: 'Staff Geofence Check-In',
              description: 'Validates physical presence on campus for staff punch-in.',
              status: 'READY',
              status_label: 'Geofence Enabled',
              route_url: '/admin/attendance',
              action_text: 'Open Staff Attendance',
              requirements: [{ title: 'Campus Geofence Zones Active', is_satisfied: true }],
              missing_prerequisites: [],
            },
            {
              id: 'leaves',
              name: 'Faculty Leave Management',
              description: 'Processes staff leave applications and duty quota tracking.',
              status: 'READY',
              status_label: 'Ready for Submissions',
              route_url: '/admin/leaves',
              action_text: 'Manage Leaves',
              requirements: [{ title: 'Leave Quotas Configured', is_satisfied: true }],
              missing_prerequisites: [],
            },
          ],
          data_flow: {
            nodes: [
              { id: 'departments', label: 'Departments', category: 'Foundation', purpose: 'Root unit', used_by: [], current_count: 5, config_url: '/admin/departments' },
              { id: 'academic_year', label: 'Academic Year & Terms', category: 'Foundation', purpose: 'Timeline', used_by: [], current_count: 2, config_url: '/admin/academic-calendar' },
              { id: 'rooms', label: 'Rooms & Labs', category: 'Structure', purpose: 'Physical venues', used_by: [], current_count: 15, config_url: '/admin/rooms' },
              { id: 'teachers', label: 'Faculty & Staff', category: 'People', purpose: 'Teaching staff', used_by: [], current_count: 28, config_url: '/admin/teachers' },
              { id: 'classes', label: 'Classes & Sections', category: 'Structure', purpose: 'Cohorts', used_by: [], current_count: 8, config_url: '/admin/classes' },
              { id: 'subjects', label: 'Course Subjects', category: 'Curriculum', purpose: 'Curriculum', used_by: [], current_count: 24, config_url: '/admin/subjects' },
              { id: 'students', label: 'Student Directory', category: 'People', purpose: 'Students', used_by: [], current_count: 320, config_url: '/admin/classes' },
              { id: 'calendar_days', label: 'Day Order Calendar', category: 'Scheduling', purpose: 'Day orders', used_by: [], current_count: 90, config_url: '/admin/academic-calendar' },
              { id: 'timetable', label: 'Timetable Matrix', category: 'Scheduling', purpose: 'Slots', used_by: [], current_count: 140, config_url: '/admin/timetable' },
              { id: 'attendance', label: 'Student Attendance', category: 'Operations', purpose: 'Records', used_by: [], current_count: 50, config_url: '/admin/student-attendance' },
              { id: 'substitutions', label: 'Alter Assignments', category: 'Operations', purpose: 'Replacements', used_by: [], current_count: 12, config_url: '/admin/today-substitutions' },
            ],
            edges: [
              { from_node: 'departments', to_node: 'teachers', relationship: 'Affiliated with', is_hard_dependency: true },
            ],
          },
        }),
      })
    );
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

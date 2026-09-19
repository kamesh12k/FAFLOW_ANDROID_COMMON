const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8000';
const OUT_DIR = path.join('C:/Users/kames/.gemini/antigravity-ide/brain/f21d8419-137f-439e-9255-b6c1feff5448/screenshots/web');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function login(identifier, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Login failed for ${identifier}: ${res.status} ${txt}`);
  }
  return res.json();
}

async function injectAuth(page, token, user) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((tok, usr) => {
    localStorage.clear();
    localStorage.setItem('credits_token', tok);
    localStorage.setItem('credits_user', JSON.stringify(usr));
  }, token, user);
}

async function capture(page, url, filename, waitMs = 4000) {
  const fullPath = path.join(OUT_DIR, filename);
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    // Wait for content to render — look for meaningful DOM nodes
    await page.waitForFunction(() => {
      const body = document.body;
      return body && body.innerText.trim().length > 50;
    }, { timeout: 8000 }).catch(() => {});
    // Extra buffer for charts/maps/API data
    await new Promise(r => setTimeout(r, waitMs));
    await page.screenshot({ path: fullPath, type: 'png' });
    const { size } = fs.statSync(fullPath);
    console.log(`✅ ${filename} (${Math.round(size/1024)}KB)`);
  } catch (e) {
    console.log(`❌ ${filename}: ${e.message.slice(0,100)}`);
    try { await page.screenshot({ path: fullPath, type: 'png' }); } catch {}
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  console.log('Logging in to get tokens...');
  const adminData   = await login('admin', 'admin');
  const principalData = await login('principal', 'Password123').catch(() => null);
  const teacherData   = await login('teacher_cse_2@example.com', 'Password123').catch(() => null);
  const managerData   = await login('manager', 'Password123').catch(() => null);

  // Helper to print full user from token
  const decodeJwt = t => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()); } catch { return {}; } };
  const adminUser   = adminData.user   ?? { role: 'system_admin', ...decodeJwt(adminData.access_token) };
  const principalUser = principalData?.user ?? { role: 'principal',    ...decodeJwt(principalData?.access_token) };
  const teacherUser   = teacherData?.user   ?? { role: 'teacher',      ...decodeJwt(teacherData?.access_token) };
  const managerUser   = managerData?.user   ?? { role: 'manager',      ...decodeJwt(managerData?.access_token) };

  console.log('Tokens acquired. Starting captures...\n');

  // ─── PUBLIC ───────────────────────────────────────────────────────────────
  const pubPage = await browser.newPage();
  await capture(pubPage, `${BASE_URL}/login`,    '01_login.png',    2500);
  await capture(pubPage, `${BASE_URL}/register`, '02_register.png', 2500);
  await pubPage.close();

  // ─── ADMIN ────────────────────────────────────────────────────────────────
  const adminPage = await browser.newPage();
  await injectAuth(adminPage, adminData.access_token, adminUser);

  const adminRoutes = [
    ['/admin/dashboard',                  '03_admin_dashboard.png'],
    ['/admin/attendance',                 '04_admin_staff_attendance.png'],
    ['/admin/student-attendance',         '05_admin_student_attendance.png'],
    ['/admin/teachers',                   '06_admin_teachers.png'],
    ['/admin/timetable',                  '07_admin_timetable.png'],
    ['/admin/timetable/approvals',        '08_admin_timetable_approvals.png'],
    ['/admin/leaves',                     '09_admin_leaves.png'],
    ['/admin/leave-entry',                '10_admin_leave_entry.png'],
    ['/admin/credits',                    '11_admin_credits.png'],
    ['/admin/subjects',                   '12_admin_subjects.png'],
    ['/admin/classes',                    '13_admin_classes.png'],
    ['/admin/class-directory',            '14_admin_class_directory.png'],
    ['/admin/class-timetable',            '15_admin_class_timetable.png'],
    ['/admin/departments',                '16_admin_departments.png'],
    ['/admin/rooms',                      '17_admin_rooms.png'],
    ['/admin/resource-availability',      '18_admin_resource_availability.png'],
    ['/admin/today-substitutions',        '19_admin_today_substitutions.png'],
    ['/admin/academic-calendar',          '20_admin_academic_calendar.png'],
    ['/admin/academic-calendar/reports',  '21_admin_academic_reports.png'],
    ['/admin/settings',                   '22_admin_settings.png'],
    ['/admin/backup',                     '23_admin_backup.png'],
    ['/admin/geofences',                  '24_admin_geofences.png'],
    ['/admin/biometrics',                 '25_admin_biometrics.png'],
    ['/admin/managers',                   '26_admin_managers.png'],
    ['/admin/system-metrics',             '27_admin_system_metrics.png'],
    ['/admin/data-retention',             '28_admin_data_retention.png'],
    ['/admin/setup',                      '29_admin_setup_guide.png'],
    // Governance (admin role has access)
    ['/governance',                       '34_governance_dashboard.png'],
    ['/governance/timetable',             '35_governance_timetable.png'],
  ];
  for (const [route, file] of adminRoutes) {
    await capture(adminPage, `${BASE_URL}${route}`, file, 4000);
  }
  await adminPage.close();

  // ─── PRINCIPAL ────────────────────────────────────────────────────────────
  if (principalData) {
    const principalPage = await browser.newPage();
    await injectAuth(principalPage, principalData.access_token, principalUser);
    const principalRoutes = [
      ['/principal/dashboard',          '30_principal_dashboard.png'],
      ['/principal/student-attendance', '31_principal_student_attendance.png'],
      ['/principal/attendance',         '32_principal_staff_attendance.png'],
      ['/principal/class-timetable',    '33_principal_class_timetable.png'],
    ];
    for (const [route, file] of principalRoutes) {
      await capture(principalPage, `${BASE_URL}${route}`, file, 4000);
    }
    await principalPage.close();
  }

  // ─── TEACHER ──────────────────────────────────────────────────────────────
  if (teacherData) {
    const teacherPage = await browser.newPage();
    await injectAuth(teacherPage, teacherData.access_token, teacherUser);
    const teacherRoutes = [
      ['/teacher/dashboard',          '36_teacher_dashboard.png'],
      ['/teacher/student-attendance', '37_teacher_student_attendance.png'],
      ['/teacher/timetable',          '38_teacher_timetable.png'],
      ['/teacher/class-timetable',    '39_teacher_class_timetable.png'],
      ['/teacher/leave/apply',        '40_teacher_apply_leave.png'],
      ['/teacher/leave/history',      '41_teacher_leave_history.png'],
      ['/teacher/substitution',       '42_teacher_substitution.png'],
      ['/teacher/today-coverage',     '43_teacher_today_coverage.png'],
      ['/teacher/credits',            '44_teacher_credits.png'],
      ['/teacher/preferences',        '45_teacher_preferences.png'],
    ];
    for (const [route, file] of teacherRoutes) {
      await capture(teacherPage, `${BASE_URL}${route}`, file, 4000);
    }
    await teacherPage.close();
  }

  // ─── MANAGER ──────────────────────────────────────────────────────────────
  if (managerData) {
    const managerPage = await browser.newPage();
    await injectAuth(managerPage, managerData.access_token, managerUser);
    const managerRoutes = [
      ['/manager/dashboard',          '46_manager_dashboard.png'],
      ['/manager/lab-staff',          '47_manager_lab_staff.png'],
      ['/manager/non-teaching-staff', '48_manager_non_teaching_staff.png'],
      ['/manager/leaves',             '49_manager_leaves.png'],
      ['/manager/directory',          '50_manager_directory.png'],
      // Staff routes
      ['/staff/dashboard',            '51_staff_dashboard.png'],
      ['/staff/leaves',               '52_staff_leaves.png'],
    ];
    for (const [route, file] of managerRoutes) {
      await capture(managerPage, `${BASE_URL}${route}`, file, 4000);
    }
    await managerPage.close();
  }

  await browser.close();
  console.log('\n🎉 Done! All web screenshots captured.');
})().catch(e => { console.error('Fatal error:', e.message); process.exit(1); });

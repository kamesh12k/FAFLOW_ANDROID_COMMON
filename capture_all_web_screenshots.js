import puppeteer from 'puppeteer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/kames/.gemini/antigravity-ide/brain/f21d8419-137f-439e-9255-b6c1feff5448/screenshots/web';
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8000';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function getAuthSession(identifier, password) {
  try {
    const res = await axios.post(`${API_URL}/auth/login`, { identifier, password });
    return {
      token: res.data.access_token,
      user: res.data.user
    };
  } catch (err) {
    console.error(`Login failed for ${identifier}:`, err.response?.data || err.message);
    return null;
  }
}

const PAGES_CONFIG = [
  // Public
  { group: 'public', name: '01_login', path: '/login', auth: null },
  { group: 'public', name: '02_register', path: '/register', auth: null },

  // System Admin
  { group: 'admin', name: '03_admin_dashboard', path: '/admin/dashboard', role: 'admin' },
  { group: 'admin', name: '04_admin_staff_attendance', path: '/admin/attendance', role: 'admin' },
  { group: 'admin', name: '05_admin_student_attendance', path: '/admin/student-attendance', role: 'admin' },
  { group: 'admin', name: '06_admin_teachers', path: '/admin/teachers', role: 'admin' },
  { group: 'admin', name: '07_admin_timetable', path: '/admin/timetable', role: 'admin' },
  { group: 'admin', name: '08_admin_timetable_approvals', path: '/admin/timetable/approvals', role: 'admin' },
  { group: 'admin', name: '09_admin_leaves', path: '/admin/leaves', role: 'admin' },
  { group: 'admin', name: '10_admin_leave_entry', path: '/admin/leave-entry', role: 'admin' },
  { group: 'admin', name: '11_admin_credits', path: '/admin/credits', role: 'admin' },
  { group: 'admin', name: '12_admin_subjects', path: '/admin/subjects', role: 'admin' },
  { group: 'admin', name: '13_admin_classes', path: '/admin/classes', role: 'admin' },
  { group: 'admin', name: '14_admin_class_directory', path: '/admin/class-directory', role: 'admin' },
  { group: 'admin', name: '15_admin_class_timetable', path: '/admin/class-timetable', role: 'admin' },
  { group: 'admin', name: '16_admin_departments', path: '/admin/departments', role: 'admin' },
  { group: 'admin', name: '17_admin_rooms', path: '/admin/rooms', role: 'admin' },
  { group: 'admin', name: '18_admin_resource_availability', path: '/admin/resource-availability', role: 'admin' },
  { group: 'admin', name: '19_admin_today_substitutions', path: '/admin/today-substitutions', role: 'admin' },
  { group: 'admin', name: '20_admin_academic_calendar', path: '/admin/academic-calendar', role: 'admin' },
  { group: 'admin', name: '21_admin_academic_reports', path: '/admin/academic-calendar/reports', role: 'admin' },
  { group: 'admin', name: '22_admin_settings', path: '/admin/settings', role: 'admin' },
  { group: 'admin', name: '23_admin_backup', path: '/admin/backup', role: 'admin' },
  { group: 'admin', name: '24_admin_geofences', path: '/admin/geofences', role: 'admin' },
  { group: 'admin', name: '25_admin_biometrics', path: '/admin/biometrics', role: 'admin' },
  { group: 'admin', name: '26_admin_managers', path: '/admin/managers', role: 'admin' },
  { group: 'admin', name: '27_admin_system_metrics', path: '/admin/system-metrics', role: 'admin' },
  { group: 'admin', name: '28_admin_data_retention', path: '/admin/data-retention', role: 'admin' },
  { group: 'admin', name: '29_admin_setup_guide', path: '/admin/setup', role: 'admin' },

  // Principal & Governance
  { group: 'principal', name: '30_principal_dashboard', path: '/principal/dashboard', role: 'principal' },
  { group: 'principal', name: '31_principal_student_attendance', path: '/principal/student-attendance', role: 'principal' },
  { group: 'principal', name: '32_principal_staff_attendance', path: '/principal/attendance', role: 'principal' },
  { group: 'principal', name: '33_principal_class_timetable', path: '/principal/class-timetable', role: 'principal' },
  { group: 'governance', name: '34_governance_dashboard', path: '/governance', role: 'principal' },
  { group: 'governance', name: '35_governance_timetable', path: '/governance/timetable', role: 'principal' },

  // Teacher
  { group: 'teacher', name: '36_teacher_dashboard', path: '/teacher/dashboard', role: 'teacher' },
  { group: 'teacher', name: '37_teacher_student_attendance', path: '/teacher/student-attendance', role: 'teacher' },
  { group: 'teacher', name: '38_teacher_timetable', path: '/teacher/timetable', role: 'teacher' },
  { group: 'teacher', name: '39_teacher_class_timetable', path: '/teacher/class-timetable', role: 'teacher' },
  { group: 'teacher', name: '40_teacher_apply_leave', path: '/teacher/leave/apply', role: 'teacher' },
  { group: 'teacher', name: '41_teacher_leave_history', path: '/teacher/leaves', role: 'teacher' },
  { group: 'teacher', name: '42_teacher_substitution', path: '/teacher/substitution', role: 'teacher' },
  { group: 'teacher', name: '43_teacher_today_coverage', path: '/teacher/today-coverage', role: 'teacher' },
  { group: 'teacher', name: '44_teacher_credits', path: '/teacher/credits', role: 'teacher' },
  { group: 'teacher', name: '45_teacher_preferences', path: '/teacher/preferences', role: 'teacher' },

  // Manager & Staff
  { group: 'manager', name: '46_manager_dashboard', path: '/manager/dashboard', role: 'manager' },
  { group: 'manager', name: '47_manager_lab_staff', path: '/manager/lab-staff', role: 'manager' },
  { group: 'manager', name: '48_manager_non_teaching_staff', path: '/manager/non-teaching-staff', role: 'manager' },
  { group: 'manager', name: '49_manager_leaves', path: '/manager/leaves', role: 'manager' },
  { group: 'manager', name: '50_manager_directory', path: '/manager/directory', role: 'manager' },
  { group: 'staff', name: '51_staff_dashboard', path: '/staff/dashboard', role: 'manager' },
  { group: 'staff', name: '52_staff_leaves', path: '/staff/leaves', role: 'manager' },
];

async function main() {
  console.log('Authenticating role sessions...');
  const sessions = {
    admin: await getAuthSession('admin', 'admin'),
    principal: await getAuthSession('principal', 'Password123'),
    teacher: await getAuthSession('teacher_cse_2@example.com', 'Password123'),
    manager: await getAuthSession('manager', 'Password123'),
  };

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  let currentRole = null;

  for (const cfg of PAGES_CONFIG) {
    const outFile = path.join(SCREENSHOT_DIR, `${cfg.name}.png`);
    console.log(`Capturing [${cfg.group}] ${cfg.name} -> ${cfg.path}...`);

    try {
      if (cfg.role && cfg.role !== currentRole) {
        const sess = sessions[cfg.role];
        if (sess) {
          await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
          await page.evaluate((t, u) => {
            localStorage.setItem('credits_token', t);
            localStorage.setItem('credits_user', JSON.stringify(u));
          }, sess.token, sess.user);
          currentRole = cfg.role;
        }
      } else if (!cfg.role && currentRole) {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
          localStorage.removeItem('credits_token');
          localStorage.removeItem('credits_user');
        });
        currentRole = null;
      }

      await page.goto(`${BASE_URL}${cfg.path}`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1200));

      await page.screenshot({ path: outFile, fullPage: false });
      console.log(`  ✓ Saved: ${outFile}`);
    } catch (err) {
      console.error(`  ✗ Error capturing ${cfg.name}:`, err.message);
    }
  }

  await browser.close();
  console.log('All Web screenshots captured successfully!');
}

main().catch(console.error);

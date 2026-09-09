import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DepartmentProvider } from './context/DepartmentContext'
import { ProtectedRoute, AdminRoute, SystemAdminRoute, PrincipalRoute, GovernanceRoute, ManagerRoute, StaffRoute, TeacherRoute, GuestRoute, FirstLoginSetupRoute, RequireCredentialsSet } from './routes/Guards'
import AppShell from './components/layout/AppShell'
import PageLoader from './components/common/PageLoader'
import ScrollToTop from './components/common/ScrollToTop'
import { ToastProvider } from './components/ui/Toast'
import { registerServiceWorker } from './utils/pushNotifications'

// Auth pages (lazy loaded)
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const FirstLoginSetup = lazy(() => import('./pages/auth/FirstLoginSetup'))

// Governance Command Center (lazy loaded)
const GovernanceDashboard = lazy(() => import('./pages/governance/Dashboard'))
const HodTimetable = lazy(() => import('./pages/governance/HodTimetable'))

// Admin pages (lazy loaded)
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const Teachers = lazy(() => import('./pages/admin/Teachers'))
const AdminManagers = lazy(() => import('./pages/admin/Managers'))
const AdminTimetable = lazy(() => import('./pages/admin/Timetable'))
const TimetableApprovals = lazy(() => import('./pages/admin/TimetableApprovals'))
const AdminLeaves = lazy(() => import('./pages/admin/Leaves'))
const AdminLeaveEntry = lazy(() => import('./pages/admin/AdminLeaveEntry'))
const AdminCredits = lazy(() => import('./pages/admin/credits/index'))
const AdminSubjects = lazy(() => import('./pages/admin/Subjects'))
const AdminClasses = lazy(() => import('./pages/admin/Classes'))
const AdminRooms = lazy(() => import('./pages/admin/Rooms'))
const AdminDepartments = lazy(() => import('./pages/admin/Departments'))
const ResourceAvailability = lazy(() => import('./pages/admin/ResourceAvailability'))
const AdminSettings = lazy(() => import('./pages/admin/Settings'))
const SetupGuide = lazy(() => import('./pages/admin/SetupGuide'))
const AcademicCalendar = lazy(() => import('./pages/admin/AcademicCalendar'))
const AcademicCalendarReports = lazy(() => import('./pages/admin/AcademicCalendarReports'))
const SystemMetrics = lazy(() => import('./pages/admin/SystemMetrics'))
const BackupRestore = lazy(() => import('./pages/admin/Backup'))
const DataRetention = lazy(() => import('./pages/admin/DataRetention'))
const AdminGeofences = lazy(() => import('./pages/admin/Geofences'))
const AdminBiometrics = lazy(() => import('./pages/admin/Biometrics'))
const AdminAttendance = lazy(() => import('./pages/admin/Attendance'))

// Principal pages (lazy loaded)
const PrincipalDashboard = lazy(() => import('./pages/admin/PrincipalDashboard'))

// Manager pages (lazy loaded)
const ManagerDashboard = lazy(() => import('./pages/manager/Dashboard'))
const ManagerLabStaff = lazy(() => import('./pages/manager/LabStaff'))
const ManagerNonTeachingStaff = lazy(() => import('./pages/manager/NonTeachingStaff'))
const ManagerStaffDirectory = lazy(() => import('./pages/manager/StaffDirectory'))
const ManagerStaffLeaves = lazy(() => import('./pages/manager/StaffLeaves'))

// Staff pages (lazy loaded)
const StaffDashboard = lazy(() => import('./pages/staff/Dashboard'))
const StaffMyLeaves = lazy(() => import('./pages/staff/Leaves'))

// Common pages (lazy loaded)
const TodaySubstitutions = lazy(() => import('./pages/common/TodaySubstitutions'))
const ClassFacultyDirectory = lazy(() => import('./pages/common/ClassFacultyDirectory'))
const ClasswiseTimetable = lazy(() => import('./pages/common/ClasswiseTimetable'))

// Teacher pages (lazy loaded)
const TeacherDashboard = lazy(() => import('./pages/teacher/Dashboard'))
const MyTimetable = lazy(() => import('./pages/teacher/Timetable'))
const ApplyLeave = lazy(() => import('./pages/teacher/ApplyLeave'))
const LeaveHistory = lazy(() => import('./pages/teacher/LeaveHistory'))
const MyCredits = lazy(() => import('./pages/teacher/Credits'))
const SubstitutionPreferences = lazy(() => import('./pages/teacher/Preferences'))
const TeacherSubstitution = lazy(() => import('./pages/teacher/Substitution'))

export default function App() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <AuthProvider>
    <DepartmentProvider>
    <ToastProvider>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public / guest routes */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* First-login credential setup — explicit gate before the normal dashboard routes */}
          <Route element={<FirstLoginSetupRoute />}>
            <Route path="/first-login-setup" element={<FirstLoginSetup />} />
          </Route>

          {/* Admin routes — RequireCredentialsSet bounces anyone still on
              default/reset credentials to /first-login-setup before they can
              reach any of these */}
          <Route element={<AdminRoute />}>
            <Route element={<RequireCredentialsSet />}>
              <Route element={<AppShell />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/attendance" element={<AdminAttendance />} />
                <Route path="/admin/setup" element={<SetupGuide />} />
                <Route path="/admin/academic-calendar" element={<AcademicCalendar />} />
                <Route path="/admin/academic-calendar/reports" element={<AcademicCalendarReports />} />
                <Route path="/admin/teachers" element={<Teachers />} />
                <Route path="/admin/timetable" element={<AdminTimetable />} />
                <Route path="/admin/timetable/approvals" element={<TimetableApprovals />} />
                <Route path="/admin/leaves" element={<AdminLeaves />} />
                <Route path="/admin/leave-entry" element={<AdminLeaveEntry />} />
                <Route path="/admin/credits" element={<AdminCredits />} />
                <Route path="/admin/subjects" element={<AdminSubjects />} />
                <Route path="/admin/classes" element={<AdminClasses />} />
                <Route path="/admin/class-directory" element={<ClassFacultyDirectory />} />
                <Route path="/admin/class-timetable" element={<ClasswiseTimetable />} />
                <Route path="/admin/departments" element={<AdminDepartments />} />
                <Route path="/admin/rooms" element={<AdminRooms />} />
                <Route path="/admin/resource-availability" element={<ResourceAvailability />} />
                <Route path="/admin/today-substitutions" element={<TodaySubstitutions />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/backup" element={<BackupRestore />} />

                {/* System Admin only routes — Geofencing, Biometrics, Managers, Metrics, Retention */}
                <Route element={<SystemAdminRoute />}>
                  <Route path="/admin/geofences" element={<AdminGeofences />} />
                  <Route path="/admin/biometrics" element={<AdminBiometrics />} />
                  <Route path="/admin/managers" element={<AdminManagers />} />
                  <Route path="/admin/system-metrics" element={<SystemMetrics />} />
                  <Route path="/admin/data-retention" element={<DataRetention />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* Governance routes — Command Center & Emergency Controls */}
          <Route element={<GovernanceRoute />}>
            <Route element={<RequireCredentialsSet />}>
              <Route element={<AppShell />}>
                <Route path="/governance" element={<GovernanceDashboard />} />
                <Route path="/governance/attendance" element={<AdminAttendance />} />
                <Route path="/governance/timetable" element={<HodTimetable />} />
              </Route>
            </Route>
          </Route>

          {/* Principal routes — read-only college-wide view */}
          <Route element={<PrincipalRoute />}>
            <Route element={<RequireCredentialsSet />}>
              <Route element={<AppShell />}>
                <Route path="/principal/dashboard" element={<PrincipalDashboard />} />
                <Route path="/principal/attendance" element={<AdminAttendance />} />
                <Route path="/principal/class-timetable" element={<ClasswiseTimetable />} />
              </Route>
            </Route>
          </Route>

          {/* Manager routes — Operational, Lab and Non-teaching staff */}
          <Route element={<ManagerRoute />}>
            <Route element={<RequireCredentialsSet />}>
              <Route element={<AppShell />}>
                <Route path="/manager/dashboard" element={<ManagerDashboard />} />
                <Route path="/manager/lab-staff" element={<ManagerLabStaff />} />
                <Route path="/manager/non-teaching-staff" element={<ManagerNonTeachingStaff />} />
                <Route path="/manager/leaves" element={<ManagerStaffLeaves />} />
                <Route path="/manager/directory" element={<ManagerStaffDirectory />} />
              </Route>
            </Route>
          </Route>

          {/* Staff routes — Laboratory & Non-Teaching Staff Portal */}
          <Route element={<StaffRoute />}>
            <Route element={<RequireCredentialsSet />}>
              <Route element={<AppShell />}>
                <Route path="/staff/dashboard" element={<StaffDashboard />} />
                <Route path="/staff/leaves" element={<StaffMyLeaves />} />
              </Route>
            </Route>
          </Route>

          {/* Teacher routes */}
          <Route element={<TeacherRoute />}>
            <Route element={<RequireCredentialsSet />}>
              <Route element={<AppShell />}>
                <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
                <Route path="/teacher/timetable" element={<MyTimetable />} />
                <Route path="/teacher/class-timetable" element={<ClasswiseTimetable />} />
                <Route path="/teacher/leave/apply" element={<ApplyLeave />} />
                <Route path="/teacher/leaves" element={<LeaveHistory />} />
                <Route path="/teacher/substitution" element={<TeacherSubstitution />} />
                <Route path="/teacher/today-coverage" element={<TodaySubstitutions />} />
                <Route path="/teacher/credits" element={<MyCredits />} />
                <Route path="/teacher/preferences" element={<SubstitutionPreferences />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </ToastProvider>
    </DepartmentProvider>
    </AuthProvider>
  )
}

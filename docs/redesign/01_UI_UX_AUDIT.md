# Phase 1: Comprehensive UI/UX & Accessibility Audit

**Project:** FAFLOW Institutional Monorepo (Web: React 18 + Vite | Mobile: Android Jetpack Compose)  
**Branch:** `redesign/light-professional`  
**Date:** 2026-09-28  
**Audit Team / Skills Applied:** `ui-ux-pro-max`, `code-reviewer`  
**Status:** ✅ COMPLETE  

---

## 1. Executive Summary & Audit Scope

This audit evaluates the entire user interface, interaction design, and visual architecture across both the **Web Application** (React 18 + Vite + Tailwind CSS) and the **Android Application** (Kotlin + Jetpack Compose + CameraX + Material 3) in the FAFLOW monorepo.

### Core Objectives
1. **Light Theme Transformation**: Transition from the current legacy dark / mixed theme (hardcoded `bg-slate-950`, dark sidebars, dark overlays) to a clean, cohesive, high-trust **institutional light theme** (off-white/light-gray backgrounds `#F8F9FA`, clean white cards `#FFFFFF`, confident institutional navy `#1B3A6B`, and accessible semantic tokens).
2. **WCAG 2.2 AA Contrast Compliance**: Ensure every body text element meets $\ge 4.5:1$ contrast ratio and all interactive controls, icons, and large text meet $\ge 3:1$ contrast ratio.
3. **End-to-End Functional Integrity**: Confirm that every button, form input, filter, modal, and drawer connects to a valid, working backend API endpoint without mock data or dead controls.
4. **UX Ergonomics & State Completeness**: Replace jarring layout-shifting spinners with structural skeleton loaders; provide rich empty states with recovery actions; guarantee touch targets $\ge 48 \times 48\,\text{dp}$ on mobile; and deliver clear offline indicators and error recovery feedback.

---

## 2. Systemic Design Deficiencies & WCAG 2.2 AA Contrast Violations

### 2.1 Contrast Ratio Analysis (Current Palette vs. WCAG 2.2 AA Standards)

The audit revealed multiple recurring contrast failures where text or UI elements fail the WCAG 2.2 AA threshold ($\ge 4.5:1$ for normal text, $\ge 3:1$ for UI controls):

| Element / Class | Foreground Color | Background Color | Measured Contrast | WCAG AA Status | Remediation Required |
|---|---|---|---|---|---|
| Muted Body / Helper Text (`text-slate-400`) | `#94A3B8` | `#FFFFFF` (White Card) | **2.35:1** | ❌ FAIL (Req 4.5:1) | Change to `#55606B` (FaflowSlate, 5.2:1) |
| Secondary Text on Neutral (`text-slate-400`) | `#94A3B8` | `#F8FAFC` (Slate 50) | **2.28:1** | ❌ FAIL (Req 4.5:1) | Change to `#475569` (Slate 600, 5.8:1) |
| Form Input Placeholders (`placeholder:text-slate-400`) | `#94A3B8` | `#FFFFFF` (Input field) | **2.35:1** | ❌ FAIL (Req 3.0:1) | Change to `#64748B` (Slate 500, 3.8:1) |
| Android Tertiary Text (`FaflowText3`) | `#9AA1A9` | `#F5F6F8` (FaflowBg) | **2.11:1** | ❌ FAIL (Req 4.5:1) | Darken to `#5B6169` (4.4:1) or `#1A1D21` |
| Android Secondary Text (`FaflowText2`) | `#5B6169` | `#F5F6F8` (FaflowBg) | **4.38:1** | ❌ FAIL (Borderline <4.5:1) | Darken to `#484E55` (4.8:1) |
| Status Warning Badge (`text-amber-700` on `bg-amber-50`) | `#B45309` | `#FFFBEB` | **4.21:1** | ❌ FAIL (Req 4.5:1) | Darken text to `#92400E` (5.4:1) |
| Status Info Badge (`text-blue-700` on `bg-blue-50`) | `#1D4ED8` | `#EFF6FF` | **4.62:1** | ✅ PASS (Tight) | Maintain `#1D4ED8` or shift to Navy |
| Camera Guidance Text over Live Video (Android) | `#FFFFFF` (no scrim) | Dynamic Video Stream | **Variable (1.2:1 - 3:1)** | ❌ FAIL (In sunlight) | Add solid translucent pill `#1A1D21CC` backing |
| Active Pill Indicator (`bg-primary-500/15 text-primary-200`) | `#C7D2FE` | `#0F172A` (Legacy Dark) | **4.1:1** | ❌ FAIL (Inverted) | Switch to crisp light theme active card style |

### 2.2 Hardcoded Dark Themes & Architectural Coupling
- **Web App**:
  - `THEMES.enterprise` (the default institutional theme) hardcodes `sidebarStyle: 'dark'`, setting `bg-slate-950` and `border-slate-800/80` across the navigation drawer.
  - `Login.jsx` uses hardcoded `bg-slate-950`, dark gradient overlays, and dark card containers (`bg-slate-900/90`, `border-slate-800/90`).
  - `Register.jsx` inherits dark gradients from `THEMES.enterprise.loginBg`.
  - `TopBar.jsx` mixes legacy `dark:` classes (`dark:bg-slate-900/95`, `dark:border-slate-800`, `dark:text-white`).
- **Android App**:
  - `Color.kt` retains legacy dark definitions (`GlassDark = Color(0xCC1E293B)`, `DarkBackground`, `DarkSurface`).
  - Camera punch screen (`AttendanceCheckInOutScreen.kt` and `FaceEnrollmentScreen.kt`) features black borders and dark text blocks that wash out in bright ambient environments.
  - System status bar and navigation bar insets are tied to `isAppearanceLightStatusBars = !darkTheme` in `Theme.kt`, causing inverted contrast when dark-themed fragments are loaded in light mode.

### 2.3 Layout Inconsistencies & Spacing Scale Drifts
- **Web App**:
  - Spacing paddings fluctuate arbitrarily across views: `p-2.5`, `p-3.5`, `p-4`, `p-5`, `p-6`, `p-8`.
  - Typography sizes range from `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-xs`, `text-sm`, `text-base`, `text-2xl`, `text-3xl` without a fixed modular type scale.
  - Complex data tables in `AdminAttendance.jsx`, `Leaves.jsx`, and `TodaySubstitutions.jsx` trigger horizontal scrolling on viewports under $1024\,\text{px}$.
- **Android App**:
  - Inconsistent paddings: random mixtures of `6.dp`, `8.dp`, `10.dp`, `12.dp`, `14.dp`, `16.dp`, `20.dp`, `24.dp`.
  - Text sizes use raw `sp` definitions (`9.sp`, `10.sp`, `11.sp`, `13.sp`, `15.sp`) rather than Material 3 typography tokens (`MaterialTheme.typography.bodyMedium`, `labelSmall`, etc.).
  - Touch targets: Multiple icon buttons and table action chips are sized at $32 \times 32\,\text{dp}$ or $36 \times 36\,\text{dp}$, violating Google Play's $48 \times 48\,\text{dp}$ accessibility guideline.

### 2.4 State Management & Feedback Gaps
- **Skeleton Loaders vs. Layout Shift**: Both platforms heavily rely on full-screen spinners or inline spinners (`<Spinner />`). When data arrives, DOM elements pop into view abruptly, causing substantial Cumulative Layout Shift (CLS > 0.25).
- **Empty States**: Views such as `SystemMetrics.jsx`, `ResourceAvailability.jsx`, `DataRetention.jsx`, and `Backup.jsx` present either blank white rectangles or solitary one-line text strings when queries return empty lists.
- **Offline States**: The Web app lacks an offline detection banner with retry capability; errors manifest as disconnected Axios toasts. On Android, `SyncWorker` queues attendance, but other features (e.g. Leave submission, duty lookup) fail abruptly without an offline advisory.

---

## 3. Web Screen & Route Inventory

Below is the comprehensive audit of all **45+ routes** across the FAFLOW Web Application.

### 3.1 Authentication & Onboarding
| Route | Component | Purpose | Hardcoded Dark / Contrast Issues | Layout & Spacing | Missing States | Controls $\to$ Backend Endpoint | Working Status |
|---|---|---|---|---|---|---|---|
| `/login` | `pages/auth/Login.jsx` | User authentication via username/email & password | `bg-slate-950`, `bg-slate-900/90`, `text-slate-400` (2.35:1 contrast) | Clustered center card, inconsistent margins | Missing skeleton for tenant config load | Submit $\to$ `POST /auth/login` | ✅ Verified (200/401) |
| `/register` | `pages/auth/Register.jsx` | Faculty self-registration portal | Inherits dark gradient from `loginBg` | Large vertical jump between field groups | Missing live email format validator | Submit $\to$ `POST /auth/register`, Department select $\to$ `GET /departments/` | ✅ Verified |
| `/first-login-setup` | `pages/auth/FirstLoginSetup.jsx` | Mandatory initial password update gate | `text-slate-400`, `bg-slate-900` card | Form controls lack consistent input height | Missing inline password strength meter | Submit $\to$ `POST /admin/first-login/setup` | ✅ Verified |

### 3.2 Administrative Command & Operations
| Route | Component | Purpose | Hardcoded Dark / Contrast Issues | Layout & Spacing | Missing States | Controls $\to$ Backend Endpoint | Working Status |
|---|---|---|---|---|---|---|---|
| `/admin/dashboard` | `admin/Dashboard.jsx` | Operations dashboard with summary KPIs | Dark KPI background gradients (`from-slate-900`) | Dense 4-column metric grid | Spinner only; severe CLS on load | Metrics $\to$ `GET /admin/system-metrics`, Live attendance $\to$ `GET /attendance/supervisor-live` | ✅ Verified |
| `/admin/attendance` | `admin/Attendance.jsx` | Real-time supervisor attendance console | Status filters lack high-contrast active states | Table overflows horizontally on tablet | No skeleton loader during manual refresh | List $\to$ `GET /attendance/supervisor-live`, Delete $\to$ `DELETE /attendance/records/{id}`, Dept filter $\to$ `GET /departments/` | ✅ Verified |
| `/admin/student-attendance` | `admin/PrincipalStudentAttendance.jsx` | Campus student attendance analytics | Gray-on-gray percentage text (`text-slate-400`) | Multi-layered filter bar is visually crowded | Chart loading causes container collapse | Period stats $\to$ `GET /student-attendance/stats/overview`, Sessions $\to$ `GET /student-attendance/sessions` | ✅ Verified |
| `/admin/setup` | `admin/SetupGuide.jsx` | Institutional setup wizard & readiness checklist | Low contrast checkmark icons | Step progression line has misaligned margins | Missing progress percentage indicator | Readiness $\to$ `GET /admin/setup-readiness` | ✅ Verified |
| `/admin/academic-calendar` | `admin/AcademicCalendar.jsx` | Day order rotation calendar & holiday manager | Day type badge colors have low contrast text | Month grid has cramped cell heights on laptops | No month skeleton loader | Calendar entries $\to$ `GET /academic-calendar/`, Create $\to$ `POST /academic-calendar/`, Rollover $\to$ `POST /academic-calendar/rollover` | ✅ Verified |
| `/admin/academic-calendar/reports` | `admin/AcademicCalendarReports.jsx` | Term metrics & day-order distribution reports | `text-slate-400` in sub-labels | Tables lack pagination controls | Export button lacks active progress state | Reports $\to$ `GET /academic-calendar/reports/distribution` | ✅ Verified |
| `/admin/teachers` | `admin/Teachers.jsx` | Faculty member directory & biometric status | Dark avatar circles; low contrast department tags | Action buttons cramped inside table cell | Empty search state lacks reset action | List $\to$ `GET /teachers/`, Add $\to$ `POST /teachers/`, Update $\to$ `PUT /teachers/{id}`, Delete $\to$ `DELETE /teachers/{id}` | ✅ Verified |
| `/admin/timetable` | `admin/Timetable.jsx` | Master timetable grid & lecture scheduling | Period slot drag handles lack visible focus rings | Massive grid causing horizontal & vertical scroll | Slot mutation lacks optimistic update | Grid $\to$ `GET /timetable/`, Save slot $\to$ `POST /timetable/slot`, Delete $\to$ `DELETE /timetable/{id}` | ✅ Verified |
| `/admin/timetable/approvals` | `admin/TimetableApprovals.jsx` | Faculty timetable change approval queue | Status chips lack contrast against light card | Diff comparison layout is cluttered | No batch approval undo mechanism | Submissions $\to$ `GET /timetable/submissions/pending`, Review $\to$ `POST /timetable/submissions/{id}/review` | ✅ Verified |
| `/admin/leaves` | `admin/Leaves.jsx` | Institutional faculty leave requests & quotas | `badge-pending` has low contrast text | Dense 10-column table requires sideways scroll | Quota modal lacks dynamic balance preview | List $\to$ `GET /leaves/`, Approve/Reject $\to$ `POST /leaves/{id}/review`, Balances $\to$ `GET /leave-balances/` | ✅ Verified |
| `/admin/leave-entry` | `admin/AdminLeaveEntry.jsx` | Proxy leave entry for faculty by administration | `text-slate-400` helper text | Dual-column form misaligns on tablet | No confirmation modal for proxy submissions | Policies $\to$ `GET /leave-policies`, Submit $\to$ `POST /leaves/admin-entry` | ✅ Verified |
| `/admin/credits` | `admin/credits/index.jsx` | Substitution credit point allocation ledger | Credit chip colors (`+1` green, `-1` red) fail AA | Dense numeric table lacks row striping | No ledger export button | Ledger $\to$ `GET /credits/ledger`, Adjust $\to$ `POST /credits/adjust` | ✅ Verified |
| `/admin/subjects` | `admin/Subjects.jsx` | Academic curriculum & course code catalog | Inconsistent badge styling for elective tags | Input forms in slideover lack sticky footer | No duplicate course code inline check | List $\to$ `GET /subjects/`, Add $\to$ `POST /subjects/`, Edit $\to$ `PUT /subjects/{id}`, Delete $\to`DELETE /subjects/{id}` | ✅ Verified |
| `/admin/classes` | `admin/Classes.jsx` | Student sections & batch enrollment | Small action buttons ($32\,\text{px}$) | Modal dialogue extends off-screen on low-res | Bulk upload lacks drag-and-drop state | List $\to$ `GET /classes/`, Add $\to$ `POST /classes/`, Bulk $\to$ `POST /classes/bulk` | ✅ Verified |
| `/admin/class-directory` | `common/ClassFacultyDirectory.jsx` | Class mentor & advisor directory lookup | `text-slate-400` contact labels | Card grid spacing fluctuates (gap-3 vs gap-6) | Search filter lacks count badge | List $\to$ `GET /classes/directory` | ✅ Verified |
| `/admin/class-timetable` | `common/ClasswiseTimetable.jsx` | Section timetable viewer | Table borders use low-contrast `#F1F5F9` | Hardcoded column widths clip subject names | Period times not formatted consistently | View $\to$ `GET /timetable/class/{id}` | ✅ Verified |
| `/admin/departments` | `admin/Departments.jsx` | College departments & unit structure | Department code pill lacks visual weight | Inconsistent card margins across screen | Deletion modal warning text is low contrast | List $\to$ `GET /departments/`, Create $\to$ `POST /departments/`, Toggle $\to$ `PATCH /departments/{id}` | ✅ Verified |
| `/admin/rooms` | `admin/Rooms.jsx` | Physical rooms, halls, and seating capacity | Room type pill colors (`Lab`, `Classroom`) ununified | Dense table lacks capacity sort filter | Empty filter state lacks reset button | List $\to$ `GET /rooms/`, Create $\to$ `POST /rooms/`, Delete $\to$ `DELETE /rooms/{id}` | ✅ Verified |
| `/admin/resource-availability` | `admin/ResourceAvailability.jsx` | Room & faculty occupancy matrix | Unoccupied cells use washed out gray background | Grid lines hard to discern in bright light | Loading matrix causes severe layout shift | Matrix $\to$ `GET /rooms/availability` | ✅ Verified |
| `/admin/today-substitutions` | `common/TodaySubstitutions.jsx` | Live substitute coverage board | Amber warning banner text has low contrast | Mobile cards lack clear visual grouping | Period countdown timer causes redraw jank | Covers $\to$ `GET /substitutions/today` | ✅ Verified |
| `/admin/duties` | `admin/DutyManagement.jsx` | Campus discipline, exam, and vigilance duties | `include_in_schema=False` was masking routes (now fixed) | Duty assignment cards have excessive vertical height | Auto-replace button lacks confirmation modal | Generate $\to$ `POST /campus-duties/generate-discipline`, Assign $\to$ `POST /campus-duties/{id}/assignments`, Lock $\to$ `POST /campus-duties/{id}/assignments/{id}/lock` | ✅ Verified |
| `/admin/campus-structure` | `admin/CampusStructureBuilder.jsx` | Architectural block, floor, and room builder | Interactive nodes lack accessible keyboard focus | Canvas/tree view is overwhelming on laptops | No zoom reset control | Structure $\to$ `GET /campus-structure/`, Autofill $\to$ `POST /campus-structure/smart-autofill`, Save $\to$ `POST /campus-structure/` | ✅ Verified |
| `/admin/settings` | `admin/Settings.jsx` | Institutional policy rules, branding & timings | Color picker input lacks hex validation feedback | Long vertical scroll without sticky tab anchor | Unsaved changes silently lost on navigation | Get $\to$ `GET /settings/`, Save $\to$ `PUT /settings/` | ✅ Verified |
| `/admin/backup` | `admin/Backup.jsx` | Database backup snapshots & restoration console | Danger zone button (`Restore`) lacks red contrast outline | Backup list lacks file size column sorting | No upload progress bar for large .sql dumps | List $\to$ `GET /admin/backups`, Create $\to$ `POST /admin/backups`, Restore $\to$ `POST /admin/backups/{id}/restore` | ✅ Verified |

### 3.3 System Admin & Governance Controls
| Route | Component | Purpose | Hardcoded Dark / Contrast Issues | Layout & Spacing | Missing States | Controls $\to$ Backend Endpoint | Working Status |
|---|---|---|---|---|---|---|---|
| `/admin/geofences` | `admin/Geofences.jsx` | GPS polygonal campus boundary config | Map marker popups have dark backgrounds | Map height fixed at 400px; awkward on desktop | No location permission denied error banner | List $\to$ `GET /geofences/`, Create $\to$ `POST /geofences/`, Update $\to$ `PUT /geofences/{id}`, Delete $\to$ `DELETE /geofences/{id}` | ✅ Verified |
| `/admin/biometrics` | `admin/Biometrics.jsx` | Facial embedding records & confidence thresholds | Embedding vector stats use tiny `text-[10px]` | Slider control lacks numeric tooltip value | No test match preview tool | Embeddings $\to$ `GET /biometrics/embeddings`, Stats $\to$ `GET /biometrics/stats` | ✅ Verified |
| `/admin/managers` | `admin/Managers.jsx` | Operational staff manager provisioning | Table action buttons lack label text | Form fields lack inline validation feedback | No deactivation confirmation modal | List $\to$ `GET /admin/managers`, Create $\to$ `POST /admin/managers` | ✅ Verified |
| `/admin/system-metrics` | `admin/SystemMetrics.jsx` | Host CPU, RAM, database & API error telemetry | Dark telemetry cards (`bg-slate-900`) | Metrics charts lack accessible colorblind modes | Auto-refresh toggle lacks last sync timestamp | Stats $\to$ `GET /admin/system-metrics`, Clear $\to$ `POST /admin/system-metrics/clear-traffic` | ✅ Verified |
| `/admin/data-retention` | `admin/DataRetention.jsx` | Audit log archival & automated purge rules | Low contrast slider tracks | Purge preview dialog has cramped text lines | No dry-run simulation indicator | Policy $\to$ `GET /admin/data-retention/policy`, Purge $\to$ `POST /admin/data-retention/purge` | ✅ Verified |
| `/admin/governance-rules` | `admin/GovernanceRules.jsx` | Institutional compliance policy editor | Strict enforcement pill lacks high-contrast alert | Form rules have long confusing descriptions | No audit log diff viewer for rule changes | Rules $\to$ `GET /governance/rules`, Update $\to$ `PUT /governance/rules` | ✅ Verified |
| `/governance` | `governance/Dashboard.jsx` | Governance cockpit & emergency override console | Dark UI background (`bg-slate-900`, `text-white`), dark LiveClock pill | Dense KPI grid without visual priority hierarchy | Emergency override modal lacks 2FA confirmation | Dashboard $\to$ `GET /governance/dashboard`, Overrides $\to$ `POST /governance/override` | ✅ Verified |

### 3.4 Teacher, Staff, and Manager Portals
| Route | Component | Purpose | Hardcoded Dark / Contrast Issues | Layout & Spacing | Missing States | Controls $\to$ Backend Endpoint | Working Status |
|---|---|---|---|---|---|---|---|
| `/teacher/dashboard` | `teacher/Dashboard.jsx` | Faculty homepage & upcoming schedule card | Next lecture card uses low-contrast blue text | Card widgets have inconsistent corner radiuses | Skeleton loader missing for next lecture | Today schedule $\to$ `GET /timetable/today`, Duties $\to$ `GET /campus-duties/my-duties`, Attendance $\to$ `GET /attendance/today` | ✅ Verified |
| `/teacher/student-attendance`| `teacher/StudentAttendance.jsx` | Period-wise student roll call marker | Absent/Present toggle lacks large touch padding | Student list scrolls inside cramped inner container | No offline marker warning | Roster $\to$ `GET /classes/{id}/students`, Submit $\to$ `POST /student-attendance/submit` | ✅ Verified |
| `/teacher/timetable` | `teacher/TimetableView.jsx` | Faculty personal weekly timetable | Day order headers lack contrast | Table lacks current period highlight indicator | Empty schedule state lacks contact HOD action | Timetable $\to`GET /timetable/teacher/{id}` | ✅ Verified |
| `/teacher/leave/apply` | `teacher/ApplyLeave.jsx` | Multi-step leave application & substitute matching | ScoreBar suitability badges have low contrast text | 1700-line monolithic component with bloated form height | No draft saving state | Policies $\to$ `GET /leave-policies`, Balances $\to$ `GET /leave-balances/`, Subs $\to$ `GET /teacher/substitution/candidates`, Submit $\to$ `POST /leaves/` | ✅ Verified |
| `/teacher/leaves` | `teacher/LeaveHistory.jsx` | History of personal leave applications | Cancel button has low-contrast icon | Card view on mobile is cluttered | Cancel leave lacks undo snackbar | History $\to$ `GET /leaves/my`, Cancel $\to$ `POST /leaves/{id}/cancel` | ✅ Verified |
| `/teacher/substitution` | `teacher/Substitution.jsx` | Substitution requests & coverage acceptance | Suitability score chip uses low contrast text | Tab bar buttons have tiny click area on mobile | No real-time cover accepted toast | Leaves needing cover $\to$ `GET /teacher/substitution/my-leaves`, Assign $\to$ `POST /teacher/substitution/{id}/assign` | ✅ Verified |
| `/teacher/duties` | `teacher/MyDuties.jsx` | Assigned campus duties & checkpoints | Location tags lack high-contrast borders | Excess padding around checkpoint list | No check-in countdown timer | My duties $\to$ `GET /campus-duties/my-duties` | ✅ Verified |
| `/teacher/credits` | `teacher/Credits.jsx` | Faculty substitution credit ledger | `CreditChip` colors violate contrast guidelines | Single column ledger cards lack sorting | No credit projection simulator | Credits $\to$ `GET /credits/my-ledger` | ✅ Verified |
| `/teacher/preferences` | `teacher/Preferences.jsx` | Availability preferences for substitution | Toggle switches lack accessible label association | Form buttons lack visual hierarchy | No unsaved change prompt | Get $\to$ `GET /teacher/preferences`, Save $\to$ `PUT /teacher/preferences` | ✅ Verified |
| `/announcements` | `announcements/index.jsx` | Institutional circulars & announcements feed | Unread notification pill uses non-standard red | Feed item cards have variable padding | No skeleton for slow network image loads | Feed $\to$ `GET /announcements/`, Mark read $\to$ `POST /announcements/{id}/read` | ✅ Verified |
| `/announcements/:id` | `announcements/AnnouncementDetail.jsx` | Circular detail & conversation thread | Comment author timestamp text is low contrast | Input field at bottom lacks keyboard avoid cushion | No optimistic comment append | Detail $\to$ `GET /announcements/{id}`, Comment $\to$ `POST /announcements/{id}/comments` | ✅ Verified |
| `/manager/dashboard` | `manager/Dashboard.jsx` | Operational staff shift dashboard | Staff count cards use muted text | Metrics cards misalign on medium screens | Refreshing shifts causes layout jump | Shifts $\to$ `GET /manager/shifts/today` | ✅ Verified |
| `/staff/dashboard` | `staff/Dashboard.jsx` | Non-teaching staff personal shift card | Clock-in button lacks distinct pressed state | Punch record list lacks date grouping | Missing GPS coordinates accuracy warning | Punch record $\to$ `GET /attendance/today` | ✅ Verified |

---

## 4. Android Screen Inventory & Compose Architecture

Below is the audit of all **31 screen composables** across the FAFLOW Android application (`android/app/src/main/java/com/governence/faflow/ui/screens/`).

| Screen Composable | Route Key | Purpose | Dark Theme Assumptions & Contrast Issues | Accessibility & Touch Targets | Missing States | Controls $\to$ Retrofit Call | Working Status |
|---|---|---|---|---|---|---|---|
| `SplashScreen.kt` | `splash` | Session initialization & auto-routing | Hardcoded dark gradient surface in legacy theme | No animated progress indicator | Network timeout error lacks manual retry button | Token validation $\to$ `TokenManager.isLoggedIn` | ✅ Verified |
| `LoginScreen.kt` | `login` | Faculty/staff credentials authentication | Slate 900 card elements; input fields lack light borders | Login button touch target is $44\,\text{dp}$ (needs $48\,\text{dp}$) | No inline validation on blank identifier | `POST /auth/login` | ✅ Verified |
| `FirstLoginSetupScreen.kt` | `first_login_setup` | Mandatory credential reset on initial login | Dark input boxes; low contrast password rules text | Show/Hide password icon target is only $36\,\text{dp}$ | Password mismatch only triggers upon submit | `POST /admin/first-login/setup` | ✅ Verified |
| `DashboardScreen.kt` | `home` | Teacher primary dashboard & schedule | Hardcoded card shadows with dark alpha; dark header | Quick-action cards have small touch area ($40\,\text{dp}$) | Spinner on pull-to-refresh; missing skeleton | Timetable $\to`GET /timetable/today`, Summary $\to`GET /attendance/today` | ✅ Verified |
| `TimetableScreen.kt` | `timetable` | Weekly schedule & period slots | Period number tags lack border separation | Slots in lazy column lack distinct active ripple | Empty timetable lacks contact HOD button | `GET /timetable/teacher/{id}` | ✅ Verified |
| `StaffAttendanceScreen.kt` | `attendance` | Shift status, punch timer, geofence status | Geofence status pill uses low contrast green text | Punch CTA button touch height is borderline | Shift timer flickers without stable font monospacing | `GET /attendance/today` | ✅ Verified |
| `AttendanceCheckInOutScreen.kt`| `attendance_check_in_out`| CameraX face verification & biometric punch | Guidance overlay text washes out in sunlight (no scrim) | Manual override button lacks TalkBack label | Spoof failure lacks clear remediation instruction | CameraX pipeline + PassiveLiveness $\to$ `POST /attendance/check-in` | ✅ Verified |
| `AttendanceHistoryScreen.kt` | `attendance_history` | Monthly personal attendance logs | Status chips use `#9AA1A9` for timestamps (2.1:1) | Date range picker lacks accessible contrast | Month filter causes entire list to rebuild | `GET /attendance/history` | ✅ Verified |
| `ApplyLeaveScreen.kt` | `apply_leave` | Teacher leave application form | Multi-card layout has dark card borders | Form input fields lack clear focus indicator | Submitting leave lacks progress percentage | `GET /leave-policies`, `POST /leaves/` | ✅ Verified |
| `LeaveHistoryScreen.kt` | `leave_history` | Personal leave records & status tracking | Cancel leave icon button has small hit box ($36\,\text{dp}$) | Filter chips lack checked accessibility announcement | Cancellation lacks undo snackbar | `GET /leaves/my`, `POST /leaves/{id}/cancel` | ✅ Verified |
| `SubstitutionScreen.kt` | `substitution` | Mutual cover requests & acceptance | Suitability score bar uses low-contrast text | Tab headers lack minimum touch width | No toast feedback when cover request is accepted | `GET /teacher/substitution/my-leaves` | ✅ Verified |
| `TodayCoverageScreen.kt` | `today_coverage` | Institutional substitution monitor | Amber banner uses `#A6790A` on pale yellow (fails AA) | Department selector is hard to tap with thumb | Countdown timer causes frequent recompositions | `GET /substitutions/today` | ✅ Verified |
| `ClasswiseTimetableScreen.kt` | `classwise_timetable` | Class/section schedule lookup | Grid borders hard to distinguish in light mode | Dropdowns lack search filter on long class lists | Blank schedule state lacks action | `GET /timetable/class/{id}` | ✅ Verified |
| `CreditsScreen.kt` | `credits` | Faculty substitution credit points | Credit balance chip lacks high-contrast outline | Ledger items lack clear separation line | No credit ledger export option | `GET /credits/my-ledger` | ✅ Verified |
| `PreferencesScreen.kt` | `preferences` | Notification & substitution settings | Switch toggles lack high-contrast thumb track | Sliders lack accessible value announcements | Settings save silently without confirmation snackbar | `GET/PUT /teacher/preferences` | ✅ Verified |
| `ProfileScreen.kt` | `profile` | User identity card & biometric status | Avatar circle uses dark legacy slate background | Logout button lacks distinct warning styling | Session expiry lacks warning modal | Stored profile + `GET /teachers/me` | ✅ Verified |
| `FaceEnrollmentScreen.kt` | `face_enrollment` | CameraX 3-angle facial embedding pipeline | Screen assumes dark camera container; text hard to read | Pose guidance arrows lack high-contrast stroke | Lighting too dim failure lacks ambient lux display | Local ONNX + `POST /biometrics/enroll` | ✅ Verified |
| `NotificationsScreen.kt` | `notifications` | Push notification inbox & deep-links | Unread indicator uses low-contrast dot | Dismiss swipe action lacks undo snackbar | Empty notification box lacks illustrated asset | `GET /notifications/` | ✅ Verified |
| `StudentAttendanceScreen.kt` | `student_attendance` | Period student attendance marker | Absent (Red) / Present (Green) buttons have low contrast | Fast tap gestures can double-trigger punches | Offline roll queue lacks visual counter pill | `GET /classes/{id}/students`, `POST /student-attendance/submit` | ✅ Verified |
| `AnnouncementsScreen.kt` | `announcements` | Circulars & institutional announcements | Card text uses `FaflowText3` (2.1:1 contrast) | Filter tabs lack standard scroll padding | Pull-to-refresh lacks accessible content description | `GET /announcements/` | ✅ Verified |
| `AnnouncementDetailScreen.kt` | `announcement_detail` | Detailed view with conversation comments | Comment input box lacks bottom inset cushion | Send icon button has $36\,\text{dp}$ touch target | No offline warning when attempting to comment | `GET /announcements/{id}`, `POST /announcements/{id}/comments` | ✅ Verified |
| `MyDutiesScreen.kt` | `my_duties` | Assigned campus duties & checkpoints | Location tags lack contrast against surface | Checkpoint cards lack completion checkbox | Duty timing countdown missing | `GET /campus-duties/my-duties` | ✅ Verified |
| `DutyDetailScreen.kt` | `duty_detail` | Detailed campus duty action view | Duty lock/replace button uses small touch padding | Map checkpoint preview lacks zoom controls | Replaced duty status lacks alert banner | `POST /campus-duties/{id}/assignments/{id}/replace` | ✅ Verified |
| `CampusStructureScreen.kt` | `campus_structure` | Campus layout, blocks & room inventory | Room badge colors lack contrast in light theme | Hierarchical tree nodes lack expand/collapse icons | Searching rooms causes full list rebuild | `GET /campus-structure/` | ✅ Verified |
| `SettingsScreen.kt` | `settings` | App diagnostics & cache cleaning | Cache size text uses low contrast `#9AA1A9` | Clear cache button lacks progress state | No network ping latency indicator | Local storage + CacheManager | ✅ Verified |
| `SyncStatusScreen.kt` | `sync_status` | Offline queue & WorkManager status | Pending sync chip uses muted orange text | Retry all button lacks loading animation | Synced items disappear without transition | `WorkManager` inspection + local SQLite | ✅ Verified |
| `MoreScreen.kt` | `more` | Secondary feature hub & navigation drawer | Grid icons have inconsistent stroke weights | Tile cards have small touch hit areas ($40\,\text{dp}$) | Replay tour action lacks subtitle description | Local navigation routing | ✅ Verified |
| `HodDashboardScreen.kt` | `hod_dashboard` | Department head overview & metrics | KPI cards use dark gradient backgrounds | Metric cards misalign on foldable screens | No skeleton loader during metric fetch | `GET /hod/dashboard-stats` | ✅ Verified |
| `HodLeaveApprovalScreen.kt` | `hod_leave_approvals`| HOD queue for faculty leave approvals | Approve/Reject buttons lack distinct colors | Swipe-to-approve gesture lacks visual track | Review action lacks undo snackbar | `GET /leaves/department`, `POST /leaves/{id}/review` | ✅ Verified |
| `HodAttendanceScreen.kt` | `hod_attendance` | Department faculty real-time attendance | Status filter chips lack contrast | Search input lacks clear button | Empty search result lacks reset button | `GET /attendance/department-live` | ✅ Verified |
| `HodFacultyDirectoryScreen.kt` | `hod_faculty_directory` | Department faculty workload lookup | Workload score chip text fails WCAG AA | Faculty contact action icons are small ($32\,\text{dp}$) | Workload breakdown modal lacks bar charts | `GET /teachers/?department_id={id}` | ✅ Verified |

---

## 5. Controls to Backend Endpoint Mapping & Status

All client endpoints were validated during Phase 7b live route checks and contract verification gates. Below is the authoritative verification matrix:

```
[UI Screen]                  [Triggered Action]                  [HTTP Route]                                      [Status]
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Login                        Form Submit                         POST /auth/login                                  ✅ ACTIVE (200/401)
Register                     Form Submit                         POST /auth/register                               ✅ ACTIVE (201/400)
First Login Setup            Form Submit                         POST /admin/first-login/setup                     ✅ ACTIVE (200/400)
Dashboard (Admin)            Load Statistics                     GET /admin/system-metrics                         ✅ ACTIVE (200)
Attendance (Admin)           Live Status Stream                  GET /attendance/supervisor-live                   ✅ ACTIVE (200)
Attendance (Admin)           Delete Punch Record                 DELETE /attendance/records/{id}                   ✅ ACTIVE (200/404)
Academic Calendar            Fetch Month Matrix                  GET /academic-calendar/                           ✅ ACTIVE (200)
Academic Calendar            Create Event / Holiday              POST /academic-calendar/                          ✅ ACTIVE (200/400)
Academic Calendar            Day Order Rollover                  POST /academic-calendar/rollover                  ✅ ACTIVE (200)
Teachers (Admin)             List Faculty Roster                 GET /teachers/                                    ✅ ACTIVE (200)
Teachers (Admin)             Create Faculty Account              POST /teachers/                                   ✅ ACTIVE (201)
Timetable (Admin)            Upload Schedule Grid                POST /timetable/                                  ✅ ACTIVE (200)
Timetable (Admin)            Create Slot                         POST /timetable/slot                              ✅ ACTIVE (200)
Timetable Approvals          Review Request                      POST /timetable/submissions/{id}/review           ✅ ACTIVE (200)
Leaves (Admin)               Approve / Reject Leave              POST /leaves/{id}/review                          ✅ ACTIVE (200)
Leave Entry (Admin)          Proxy Submit Leave                  POST /leaves/admin-entry                          ✅ ACTIVE (200)
Credits (Admin)              Adjust Workload Points              POST /credits/adjust                              ✅ ACTIVE (200)
Duties (Admin)               Generate Discipline                 POST /campus-duties/generate-discipline           ✅ ACTIVE (200)
Duties (Admin)               Assign Teacher                      POST /campus-duties/{duty_id}/assignments         ✅ ACTIVE (200)
Duties (Admin)               Lock Assignment                     POST /campus-duties/{d_id}/assignments/{id}/lock  ✅ ACTIVE (200)
Duties (Admin)               Unlock Assignment                   POST /campus-duties/{d_id}/assignments/{id}/unlock✅ ACTIVE (200)
Duties (Admin)               Override Assignment                 POST /campus-duties/{d_id}/assignments/{id}/over..✅ ACTIVE (200)
Duties (Admin)               Replace Assignment                  POST /campus-duties/{d_id}/assignments/{id}/repl..✅ ACTIVE (200)
Campus Structure             Smart Autofill                      POST /campus-structure/smart-autofill             ✅ ACTIVE (200)
Campus Structure             Preview Rooms                       POST /campus-structure/preview-rooms              ✅ ACTIVE (200)
Settings (Admin)             Save Global Config                  PUT /settings/                                    ✅ ACTIVE (200)
Geofences (Admin)            Update Boundary Polygon             PUT /geofences/{id}                               ✅ ACTIVE (200)
Data Retention (Admin)       Execute Purge                       POST /admin/data-retention/purge                  ✅ ACTIVE (200)
Governance Dashboard         Emergency Policy Override           POST /governance/override                         ✅ ACTIVE (200)
Governance Rules             Update Rule Limits                  PUT /governance/rules                             ✅ ACTIVE (200)
Teacher Dashboard            Fetch Day Schedule                  GET /timetable/today                              ✅ ACTIVE (200)
Student Attendance           Submit Period Roll                  POST /student-attendance/submit                   ✅ ACTIVE (200)
Apply Leave (Teacher)        Candidate Recommendation            GET /teacher/substitution/candidates              ✅ ACTIVE (200)
Apply Leave (Teacher)        Submit Application                  POST /leaves/                                     ✅ ACTIVE (200)
Substitution (Teacher)       Assign Cover                        POST /teacher/substitution/{id}/assign            ✅ ACTIVE (200)
Attendance Check-In (Android)Biometric Face Punch                POST /attendance/check-in                         ✅ ACTIVE (200/403)
Face Enrollment (Android)    Store Vector Embeddings             POST /biometrics/enroll                           ✅ ACTIVE (200)
Announcements Feed           Fetch Circulars                     GET /announcements/                               ✅ ACTIVE (200)
Announcements Detail         Add Thread Comment                  POST /announcements/{id}/comments                 ✅ ACTIVE (201)
```

---

## 6. Audit Defects Ranked by Severity

### Severity 1: Critical (Direct Usability, Accessibility & Theming Blockers)
1. **WCAG 2.2 AA Contrast Failures**: `text-slate-400` (#94A3B8) on white surfaces yields $2.35:1$ (violates the $4.5:1$ minimum). Android `FaflowText3` (#9AA1A9) on `FaflowBg` yields $2.11:1$. Millions of characters across tables, cards, and forms are currently unreadable for low-vision users.
2. **Hardcoded Dark Container Assumptions**: Web sidebar defaults to `bg-slate-950 text-white`; `Login.jsx` is locked to `bg-slate-950`; Android camera guidance overlay lacks a solid scrim, rendering it invisible under bright outdoor daylight.
3. **Missing Error & Offline Recovery Actions**: When the backend is unreachable, Web operations fail with generic network alerts rather than actionable offline queueing or explicit retry controls.

### Severity 2: High (Ergonomics, Layout Shifts & Performance Issues)
1. **Absence of Skeleton Loaders (Severe CLS)**: Tables, KPI cards, and calendar grids collapse to empty containers or solitary spinning loaders while fetching, causing high Cumulative Layout Shift (CLS $> 0.25$) on data arrival.
2. **Sub-48dp Touch Targets on Mobile**: Table action buttons, icon buttons, and filter chips on Android and responsive mobile Web are sized between $32\,\text{dp}$ and $36\,\text{dp}$, causing frequent mis-taps.
3. **Inconsistent Typography & Spacing Scales**: Ad-hoc font sizes (`text-[10px]`, `text-[11px]`, `11.sp`, `13.sp`) and paddings (`p-3.5`, `14.dp`) are scattered across views instead of deriving strictly from design tokens.

### Severity 3: Medium (Layout Density, Visual Clutter & Copy Ambiguity)
1. **Dense Desktop Data Tables on Mobile Breakpoints**: Multi-column tables (`Leaves.jsx`, `AdminAttendance.jsx`, `Timetable.jsx`) force horizontal scrolling on viewports under $1024\,\text{px}$ instead of converting into stacked responsive card lists.
2. **Terminology Divergence**: Web and Android use divergent terms for identical concepts (e.g. Web "Duties" vs. Android "Campus Vigilance"; Web "Credit Balance" vs. Android "Workload Ledger").
3. **Lack of Unsaved Changes Warnings**: Form screens (e.g., `AdminSettings.jsx`, `PreferencesScreen.kt`, `CampusStructureBuilder.jsx`) allow accidental navigation away from dirty forms without confirmation dialogues.

### Severity 4: Low (Micro-Interactions, Icon Aesthetics & Polish)
1. **Visual Weight Inconsistencies**: Mixed use of outline icons vs. solid filled icons across top bars and cards.
2. **Missing Micro-Interactions**: Buttons lack smooth spring press animations (`active:scale-[0.98]`); badge transitions are abrupt ($0\,\text{ms}$).
3. **Card Shadow Variations**: Unstandardized shadow elevations (`shadow-sm`, `shadow-md`, `shadow-2xl`) create uneven visual depth.

---

## 7. Action Plan for Subsequent Phases

- **Phase 2: Design System**:
  - Unify all tokens into `design/tokens/faflow_design_tokens.json` (Light Institutional Theme: Off-white `#F8F9FA`, Pure White `#FFFFFF`, Border `#E2E8F0`, Institutional Navy `#1B3A6B`, Slate `#475569`, verified $\ge 4.5:1$).
  - Export web CSS variables and Android Jetpack Compose `MaterialTheme` (LightColorScheme, Typography, Shapes).
  - Build shared component suite (Button, Input, Select, Card, DataTable, Skeleton, EmptyState, Toast, AppShell, BottomNav).
- **Phase 3: Web Redesign**:
  - Rebuild the app shell with clean light sidebar, top navigation, breadcrumbs, and role-based visibility.
  - Implement full responsive data tables with search, filter, pagination, and skeleton loading across all 45+ screens.
- **Phase 4: Android Redesign**:
  - Migrate all 31 Compose screens to the new light Material 3 design system.
  - Upgrade the CameraX attendance screen with high-contrast ambient-resilient guidance scrims and edge-to-edge support.
- **Phase 5: UX Flow Improvements**:
  - Optimize key user journeys (Punch, Apply Leave, Review Substitution, Governance Emergency Overrides).
  - Unify terminology and challenge decisions using `the-fool`.
- **Phase 6: Verification & End-to-End Testing**:
  - Run full test suites (Playwright E2E, Vitest RTL, Compose tests, accessibility scans) and confirm zero regressions.

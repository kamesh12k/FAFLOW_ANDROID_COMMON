# FAFLOW: Comprehensive Human Manual User Verification Checklist
**Project:** FAFLOW (Faculty Flow & Governance System)  
**Organization:** GOVERNENCE  
**Document Version:** 1.0.0-PROD-RELEASE-CANDIDATE  
**Date Generated:** September 2026  
**Document Classification:** Official QA Manual Execution Checklist (Strictly Human Verified)

---

## Important Manual QA Execution Principles

> [!IMPORTANT]
> 1. **Zero Automation Assumption**: This checklist is specifically designed for a **human tester** to execute on physical devices and real browsers. No item is marked as PASS based on source code presence or backend endpoint status.
> 2. **Execution Integrity**: Every test item must be performed manually. Check `[ ] PASS` only after physical observation of the expected UI state, network feedback, and business rule enforcement. If an issue is observed, mark `[ ] FAIL` and record the Bug ID. If a prerequisite defect prevents execution, mark `[ ] BLOCKED`.
> 3. **Source of Truth Rule**:
>    - If documentation specifies a feature but the source code does not contain it, it is classified and flagged as **`DOCUMENTED_BUT_NOT_FOUND`**.
>    - If the codebase contains functional features not originally mentioned in high-level briefs (such as Campus Structure Builder, Campus Duty Assignment, Manager/Staff Portal, and First-Login Credential Gate), they are fully incorporated into this checklist.

---

## Table of Contents
1. [1. Test Environment](#1-test-environment)
2. [2. Test Accounts](#2-test-accounts)
3. [3. Android Installation](#3-android-installation)
4. [4. Android Authentication](#4-android-authentication)
5. [5. Android Dashboard](#5-android-dashboard)
6. [6. Android Timetable](#6-android-timetable)
7. [7. Android Leave](#7-android-leave)
8. [8. Android Credits](#8-android-credits)
9. [9. Android Substitution](#9-android-substitution)
10. [10. Android Notifications](#10-android-notifications)
11. [11. Android Announcements](#11-android-announcements)
12. [12. Android Attendance](#12-android-attendance)
13. [13. Android Biometrics](#13-android-biometrics)
14. [14. Android Geofencing](#14-android-geofencing)
15. [15. Android Offline Mode](#15-android-offline-mode)
16. [16. Android UI Audit](#16-android-ui-audit)
17. [17. Web Authentication](#17-web-authentication)
18. [18. Web Dashboards](#18-web-dashboards)
19. [19. Web Master Data](#19-web-master-data)
20. [20. Web Academic Calendar](#20-web-academic-calendar)
21. [21. Web Timetable](#21-web-timetable)
22. [22. Web Leave](#22-web-leave)
23. [23. Web Substitution](#23-web-substitution)
24. [24. Web Attendance](#24-web-attendance)
25. [25. Web Biometrics](#25-web-biometrics)
26. [26. Web Announcements](#26-web-announcements)
27. [27. Web Notifications](#27-web-notifications)
28. [28. Web Backup](#28-web-backup)
29. [29. Web Data Retention](#29-web-data-retention)
30. [30. Web Reports](#30-web-reports)
31. [31. Role-Based Access Testing](#31-role-based-access-testing)
32. [32. Cross-Platform E2E](#32-cross-platform-e2e)
33. [33. UI/UX Audit](#33-uiux-audit)
34. [34. Negative Testing](#34-negative-testing)
35. [35. Low Network Testing](#35-low-network-testing)
36. [36. Regression Testing](#36-regression-testing)
37. [37. Final Release Verification](#37-final-release-verification)

---

## Discrepancy & Gap Analysis (Source-of-Truth Reconciled)

| Feature / Concept | Documented Expectation | Source Code Reality | QA Action / Checklist Handling |
| :--- | :--- | :--- | :--- |
| **Dean Role** | High-level docs mention a "Dean" role. | The database enum `Role` in `app/models/user.py` contains: `system_admin`, `admin`, `teacher`, `principal`, `manager`, `lab_staff`, `non_teaching_staff`, `governance`. **There is no distinct `dean` enum value in the DB.** | Classified as **`DOCUMENTED_BUT_NOT_FOUND`**. Checklist verifies oversight capabilities via `Role.governance` and `Role.principal`, and tests that attempting to create a user with role `dean` fails gracefully. |
| **Campus Structure & Campus Duty Management** | Not detailed in initial brief. | Codebase contains full `CampusStructureBuilder` (`/admin/campus-structure`), `DutyManagement` (`/admin/duties`), Android `MyDutiesScreen`, and `DutyDetailScreen` for exam, discipline, and campus operations duties. | **Included as functional module** across Web Master Data, Android Duties, and Cross-Platform testing. |
| **Manager & Operational Staff Portal** | Not in standard 3-tier school list. | Codebase implements dedicated `Role.manager`, `Role.lab_staff`, `Role.non_teaching_staff` with routes `/manager/*` and `/staff/*`. | **Included in RBAC and Dashboard testing** to ensure complete coverage. |
| **First Login Setup Gate** | Standard password change. | Strict security gate: `must_change_credentials=True` intercepts any user on default/bootstrap passwords and redirects them to `/first-login-setup` before any dashboard or API access is allowed. | **Included as dedicated gating test** in Authentication sections. |

---

## 1. Test Environment

### 1.1 Infrastructure & Services Verification
Before executing manual tests, verify that the following infrastructure components are active:

| Component | Target Parameter | Expected State / Value | Tester Verification |
| :--- | :--- | :--- | :--- |
| **Backend Server** | Host URL | `http://localhost:8000` or staging IP | [ ] API root responds `200 OK` or Swagger docs at `/docs` accessible |
| **Database** | PostgreSQL 16+ | Connection healthy, tables migrated | [ ] Session connects, ENUMs synced without fatal errors |
| **Web Frontend** | Vite / React Dev Server | `http://localhost:5173` or staging URL | [ ] Login page renders with GOVERNENCE branding |
| **Android APK** | Debug / Release Build | Target SDK 34/35, Min SDK 26 | [ ] APK successfully installed on physical Android device |
| **Campus Geofence** | Lat/Long & Radius | Center: `11.0168, 76.9558`, Radius: `200m` | [ ] Configured in Admin > Geofences |
| **Mock GPS Tool** | Fake GPS App / Developer Options | Installed on test Android device | [ ] Enabled under Developer Options for anti-spoofing tests |
| **Network Throttler** | Charles Proxy / Chrome DevTools | Throttling Profiles: Fast 3G, Slow 3G, Offline | [ ] Verified capable of simulating packet drops and delays |

---

## 2. Test Accounts

Ensure the following authoritative test accounts are provisioned in the database before starting testing:

| Role | Username / Identifier | Password | Department / Scope | Initial State / Attributes |
| :--- | :--- | :--- | :--- | :--- |
| **System Admin (Default)** | `admin` | `admin` | Global / System-wide | `must_change_credentials=True` (Triggers setup flow) |
| **System Admin (Active)** | `sysadmin` | `Admin@123456` | Global / System-wide | Active, credentials already updated |
| **Governance User** | `governence@26022006` | `Governence@26022006` | Global Command Center | Active, `Role.governance`, full institutional emergency powers |
| **Principal** | `principal@college.edu` | `Principal@123` | Institutional Oversight | Active, `Role.principal`, read-only campus-wide view |
| **HOD (CSE Dept)** | `hod_cse` or `hod_cse@college.edu` | `Hod@123456` | Computer Science & Engg | Active, `Role.admin`, department_id = CSE |
| **Teacher 1 (Primary)** | `kamesh1272006s@gmail.com` | `Kamesh1272006@k` | CSE Department | Active, `has_face_enrolled=True`, Credits = 10.0 |
| **Teacher 2 (Substitute)** | `teacher_cse_2@example.com` | `Password123` | CSE Department | Active, `has_face_enrolled=False`, Credits = 0.0 |
| **Manager** | `manager@college.edu` | `Manager@123` | Operational / Lab Dept | Active, `Role.manager` |
| **Lab Staff** | `lab_staff1@college.edu` | `Staff@123` | CSE Laboratories | Active, `Role.lab_staff` |

---

## 3. Android Installation
### Test Case: AND-INS-001 — Fresh APK Installation

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-INS-001` |
| **Platform** | **Android** |
| **Module** | **App Installation** |
| **Feature** | **Fresh APK Installation** |
| **Target Role** | **Any** |

#### Preconditions
- Android device running Android 10 (API 29) or higher
- USB Debugging or APK transfer enabled
- No prior installation of FAFLOW exists on device

#### Test Data
- **APK File**: FAFLOW-release.apk (or debug variant)
- **Target Device**: Physical Android Smartphone

#### Exact Manual Steps
1. Transfer or download the FAFLOW APK onto the physical Android test device.
2. Tap on the APK in the file manager to trigger the Android Package Installer.
3. If prompted with 'Install unknown apps', toggle permission for the file manager.
4. Tap 'Install' and observe the installation progress bar.
5. Verify installation completion without parse errors or signature mismatch crashes.
6. Tap 'Done' and confirm the FAFLOW app launcher icon appears on the device home screen/app drawer.

#### Expected Result
- The app installs successfully with zero parse errors.
- The correct app name ('FAFLOW') and official GOVERNENCE app icon appear in the launcher.
- No security warning about corrupted installation package is displayed.

#### What Tester Must Verify
- [ ] Confirm app launcher icon is crisp, unpixelated, and uses official branding.
- [ ] Confirm app package name matches com.governence.faflow.
- [ ] Confirm app size on disk is reasonable (< 80 MB).

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-INS-002 — Splash Screen & Brand Identity

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-INS-002` |
| **Platform** | **Android** |
| **Module** | **First Launch** |
| **Feature** | **Splash Screen & Brand Identity** |
| **Target Role** | **Any** |

#### Preconditions
- AND-INS-001 completed
- Application has never been opened on this device

#### Test Data
- **Device State**: Fresh Install

#### Exact Manual Steps
1. Tap the FAFLOW icon on the home screen to launch the application.
2. Observe the initial splash screen animation.
3. Check that the splash screen displays the GOVERNENCE emblem/logo, the text 'FAFLOW', and the subtitle.
4. Observe the smooth transition from the splash screen to the Login screen.
5. Verify that the screen does not flicker, hang on a blank white screen, or crash.

#### Expected Result
- The splash screen renders smoothly for approximately 1.5–2 seconds.
- The app transitions cleanly into the Login Screen.
- No ANR (Application Not Responding) dialog or crash occurs.

#### What Tester Must Verify
- [ ] Verify official GOVERNENCE branding is visible.
- [ ] Verify no uncaught exception or crash appears in Logcat.
- [ ] Verify landing screen is Login with username/email and password fields.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-INS-003 — Runtime Permission Flow (Camera & Location)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-INS-003` |
| **Platform** | **Android** |
| **Module** | **Permissions** |
| **Feature** | **Runtime Permission Flow (Camera & Location)** |
| **Target Role** | **Teacher** |

#### Preconditions
- App installed and launched
- Permissions not yet granted

#### Test Data
- **Permissions**: android.permission.CAMERA, android.permission.ACCESS_FINE_LOCATION, android.permission.POST_NOTIFICATIONS

#### Exact Manual Steps
1. From the app, navigate to a feature requiring Camera (e.g. Face Enrollment or Attendance Check-In).
2. Observe the system permission dialog prompt for Camera access.
3. Tap 'While using the app'.
4. Navigate to Attendance Check-In requiring Location.
5. Observe the system permission dialog prompt for Precise Location access.
6. Select 'Precise' and tap 'While using the app'.
7. On Android 13+, observe if Notification permission prompt appears and tap 'Allow'.

#### Expected Result
- System permission dialogs appear at the exact context-appropriate moment, not prematurely on app launch.
- Granting permissions immediately unlocks camera preview and GPS acquisition without requiring an app restart.

#### What Tester Must Verify
- [ ] Confirm camera preview initializes immediately upon granting permission.
- [ ] Confirm GPS coordinates begin resolving immediately upon granting location permission.
- [ ] Confirm denying permission displays an informative user-facing explanation rather than crashing.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 4. Android Authentication
### Test Case: AND-AUTH-001 — Teacher Login with Valid Credentials

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-AUTH-001` |
| **Platform** | **Android** |
| **Module** | **Authentication** |
| **Feature** | **Teacher Login with Valid Credentials** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher account exists in database (kamesh1272006s@gmail.com)
- Device is connected to the internet

#### Test Data
- **Email**: kamesh1272006s@gmail.com
- **Password**: Kamesh1272006@k

#### Exact Manual Steps
1. Launch the FAFLOW Android application.
2. In the identifier input field, enter 'kamesh1272006s@gmail.com'.
3. In the password input field, enter 'Kamesh1272006@k'.
4. Tap the 'Sign In' button.
5. Observe the loading indicator on the button.
6. Wait for the authentication response.

#### Expected Result
- A loading spinner appears on the Sign In button while the request executes.
- Authentication succeeds and the user is redirected to the Teacher Dashboard (Home).
- The bottom navigation bar displays: Home, Timetable, Attendance, More.

#### What Tester Must Verify
- [ ] Verify the teacher's name ('Prof. Kamesh Govindhan') appears in the dashboard greeting.
- [ ] Verify that no credential error toast is displayed.
- [ ] Verify the auth token is securely saved in EncryptedSharedPreferences.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-AUTH-002 — Login with Invalid Password

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-AUTH-002` |
| **Platform** | **Android** |
| **Module** | **Authentication** |
| **Feature** | **Login with Invalid Password** |
| **Target Role** | **Teacher** |

#### Preconditions
- Valid teacher account exists

#### Test Data
- **Email**: kamesh1272006s@gmail.com
- **Password**: WrongPassword999!

#### Exact Manual Steps
1. Open the Login screen.
2. Enter 'kamesh1272006s@gmail.com' into the identifier field.
3. Enter 'WrongPassword999!' into the password field.
4. Tap 'Sign In'.
5. Observe the error feedback.

#### Expected Result
- The app does not log in.
- A clear error message (e.g. 'Invalid username or password' or 'Authentication failed') appears.
- The password field remains editable.

#### What Tester Must Verify
- [ ] Verify no dashboard screens are opened.
- [ ] Verify no unhandled HTTP 401 crash occurs.
- [ ] Verify password field can be cleared and re-entered.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-AUTH-003 — Empty Credential Field Validation

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-AUTH-003` |
| **Platform** | **Android** |
| **Module** | **Authentication** |
| **Feature** | **Empty Credential Field Validation** |
| **Target Role** | **Any** |

#### Preconditions
- On Login screen

#### Test Data
- **Email**: 
- **Password**: 

#### Exact Manual Steps
1. Leave both the identifier and password fields completely empty.
2. Tap 'Sign In'.
3. Observe client-side validation behavior.
4. Enter only the identifier and leave password empty, then tap 'Sign In'.
5. Enter only the password and leave identifier empty, then tap 'Sign In'.

#### Expected Result
- The app prevents network request submission.
- Inline error messages appear beneath empty fields (e.g. 'Email or username is required', 'Password is required').

#### What Tester Must Verify
- [ ] Verify no loading spinner hangs indefinitely.
- [ ] Verify network call is aborted before reaching server.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-AUTH-004 — Session Persistence Across App Kill & Restart

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-AUTH-004` |
| **Platform** | **Android** |
| **Module** | **Authentication** |
| **Feature** | **Session Persistence Across App Kill & Restart** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher is currently logged in on the app

#### Test Data
- **Session State**: Active Token

#### Exact Manual Steps
1. Ensure teacher is logged in and viewing the Dashboard.
2. Press the device Home button or open the Android Recent Apps / Overview screen.
3. Swipe away the FAFLOW app to kill the process completely.
4. Re-launch FAFLOW from the app launcher.
5. Observe the splash screen and transition.

#### Expected Result
- The app bypasses the Login screen automatically.
- The user is restored directly to the Teacher Dashboard with their existing session.
- The user's profile and timetable load without requiring re-authentication.

#### What Tester Must Verify
- [ ] Verify that the user does NOT have to re-enter email and password.
- [ ] Verify that the stored auth token remains valid.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-AUTH-005 — Manual User Logout

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-AUTH-005` |
| **Platform** | **Android** |
| **Module** | **Authentication** |
| **Feature** | **Manual User Logout** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher is logged in

#### Test Data
- **Action**: Logout

#### Exact Manual Steps
1. Open the FAFLOW app and navigate to the 'More' tab in the bottom navigation.
2. Scroll down to find the 'Logout' or 'Sign Out' option.
3. Tap 'Logout'.
4. If a confirmation dialog appears, tap 'Confirm'.
5. Observe the screen transition.

#### Expected Result
- The user is immediately returned to the Login screen.
- Stored authentication tokens and cached credentials are wiped from device secure storage.
- Pressing the Android system Back button does not return the user to the Dashboard.

#### What Tester Must Verify
- [ ] Verify login form fields are reset to blank.
- [ ] Verify pressing Back exits the app or stays on Login screen.
- [ ] Verify subsequent API requests cannot be made without re-logging in.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 5. Android Dashboard
### Test Case: AND-DASH-001 — Dashboard Header & Academic Day Order Verification

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-DASH-001` |
| **Platform** | **Android** |
| **Module** | **Dashboard** |
| **Feature** | **Dashboard Header & Academic Day Order Verification** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher logged in
- Active academic calendar with Day Order configured on backend

#### Test Data
- **Expected Day Order**: Day Order 1 to 6 (as configured in backend)

#### Exact Manual Steps
1. Open FAFLOW and view the top section of the Teacher Dashboard.
2. Inspect the teacher greeting text and user name.
3. Inspect the Department and Role badge.
4. Inspect the calendar widget showing Today's Date.
5. Inspect the 'Day Order' indicator badge (e.g. 'Day Order 2' or 'Holiday').

#### Expected Result
- Teacher's full name is rendered correctly without clipping or encoding anomalies.
- Role badge displays 'Teacher' and department displays 'Computer Science & Engineering'.
- Today's date matches device calendar.
- Day Order badge matches the exact Day Order configured on the backend calendar for today.

#### What Tester Must Verify
- [ ] Verify Day Order updates correctly if backend calendar changes Day Order.
- [ ] Verify UI clearly distinguishes between working days (Day Order 1–6) and holidays.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-DASH-002 — Today's Timetable Carousel & Current Period

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-DASH-002` |
| **Platform** | **Android** |
| **Module** | **Dashboard** |
| **Feature** | **Today's Timetable Carousel & Current Period** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher has timetable slots scheduled for today's Day Order

#### Test Data
- **Day Order Slots**: Periods 1 through 5

#### Exact Manual Steps
1. On the Dashboard, scroll to the 'Today's Schedule' or 'Timetable' section.
2. Verify that the timetable slot cards for today's Day Order are listed chronologically.
3. Check the 'Current Period' card (if currently within period time bounds) to verify visual highlight / active glow.
4. Inspect each slot card for: Period number, Subject name, Subject code, Class/Section, Room/Lab number, and Time interval.
5. Check 'Upcoming Period' cards to verify they display correct start times.

#### Expected Result
- The schedule carousel displays all assigned periods for today's active Day Order.
- The currently active period has an accent border/badge indicating 'CURRENT'.
- Free/unassigned periods are either omitted or shown with 'Free Period' label.

#### What Tester Must Verify
- [ ] Confirm class name and section match backend database exactly.
- [ ] Confirm room number matches backend database exactly.
- [ ] Confirm tapping a slot opens detailed slot info if interactive.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-DASH-003 — Credits & Substitution Alert Widgets

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-DASH-003` |
| **Platform** | **Android** |
| **Module** | **Dashboard** |
| **Feature** | **Credits & Substitution Alert Widgets** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher has credit balance > 0
- Teacher has pending or assigned substitution

#### Test Data
- **Expected Balance**: e.g. 10.0 Credits

#### Exact Manual Steps
1. Look at the 'Faculty Credits' card on the Dashboard.
2. Verify the numerical credit balance displayed.
3. Tap on the Credits card.
4. Look for any 'Active Substitution' alert banners on the dashboard.
5. Tap on the substitution alert banner if present.

#### Expected Result
- Credits card accurately displays the teacher's current net credit balance.
- Tapping the Credits card navigates directly to the Credits ledger screen.
- Tapping the Substitution alert banner navigates directly to the Substitution detail/acceptance screen.

#### What Tester Must Verify
- [ ] Verify credit balance matches backend database record.
- [ ] Verify back navigation returns to the Dashboard seamlessly.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-DASH-004 — Dashboard Pull-to-Refresh & Slow Network Loading

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-DASH-004` |
| **Platform** | **Android** |
| **Module** | **Dashboard** |
| **Feature** | **Dashboard Pull-to-Refresh & Slow Network Loading** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher on Dashboard
- Network throttled or normal

#### Test Data
- **Action**: Swipe Down Gesture

#### Exact Manual Steps
1. Perform a downward swipe gesture from the top of the Dashboard.
2. Observe the pull-to-refresh spinner indicator.
3. Verify all dashboard data widgets (Day Order, Schedule, Credits, Notifications) refresh.
4. Verify the spinner dismisses cleanly once data fetching completes.

#### Expected Result
- Pull-to-refresh spinner appears at the top.
- Dashboard re-queries backend APIs and updates any modified slots or balances.
- Spinner smoothly hides without UI freezing or jumping.

#### What Tester Must Verify
- [ ] Verify no UI crash or duplicate cards are generated on refresh.
- [ ] Verify error toast appears gracefully if network fails during refresh.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 6. Android Timetable
### Test Case: AND-TIME-001 — Day Order Switching (Day 1 through Day 6)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-TIME-001` |
| **Platform** | **Android** |
| **Module** | **Timetable** |
| **Feature** | **Day Order Switching (Day 1 through Day 6)** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher has slots across different Day Orders

#### Test Data
- **Day Orders**: 1, 2, 3, 4, 5, 6

#### Exact Manual Steps
1. Tap the 'Timetable' tab in the bottom navigation bar.
2. Observe the Day Order selector tabs at the top (Day 1, Day 2, Day 3, Day 4, Day 5, Day 6).
3. Tap 'Day 1' and inspect the list of period slots displayed.
4. Tap 'Day 2' and verify the schedule changes to reflect Day 2 slots.
5. Sequentially tap through Day 3, Day 4, Day 5, and Day 6.
6. Observe smooth tab transitions.

#### Expected Result
- Each Day Order tab correctly switches the schedule view.
- Period cards display the accurate Subject, Room, Class, and Timing corresponding to each Day Order.
- Days with no assigned slots display an informative 'No classes scheduled for this day' state.

#### What Tester Must Verify
- [ ] Verify no slots from Day 1 bleed into Day 2.
- [ ] Verify the selected tab indicator clearly highlights the active day.
- [ ] Verify period numbers are sorted in ascending order (Period 1 to Period 7/8).

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-TIME-002 — Classwise Timetable Secondary Screen

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-TIME-002` |
| **Platform** | **Android** |
| **Module** | **Timetable** |
| **Feature** | **Classwise Timetable Secondary Screen** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher on Timetable or More screen

#### Test Data
- **Target Feature**: Classwise Timetable

#### Exact Manual Steps
1. Navigate to 'Classwise Timetable' (via More menu or shortcut).
2. Tap the Class selector dropdown/picker.
3. Select a department and class (e.g. 'CSE Year 1 - Sec A').
4. Select a Day Order (e.g. Day 1).
5. Review the class schedule grid/list.

#### Expected Result
- The class timetable loads showing all periods, subject names, room assignments, and assigned faculty names for that specific class.
- Teacher can inspect other periods for the class even if taught by a colleague.

#### What Tester Must Verify
- [ ] Verify all periods of the chosen class render accurately.
- [ ] Verify faculty names match the master timetable entries on the web.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 7. Android Leave
### Test Case: AND-LEV-001 — Submit Single-Day Casual Leave

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-LEV-001` |
| **Platform** | **Android** |
| **Module** | **Apply Leave** |
| **Feature** | **Submit Single-Day Casual Leave** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher logged in
- Teacher has sufficient leave balance

#### Test Data
- **Leave Type**: Casual Leave (CL)
- **Start Date**: Tomorrow (Working Day)
- **End Date**: Tomorrow
- **Reason**: Personal family commitment

#### Exact Manual Steps
1. From Dashboard quick shortcuts or More menu, tap 'Apply Leave'.
2. In the Leave Type dropdown, select 'Casual Leave'.
3. Tap the 'Start Date' picker and select tomorrow's date.
4. Tap the 'End Date' picker and select tomorrow's date.
5. Enter 'Personal family commitment' in the Reason text box.
6. Tap the 'Submit Leave Request' button.
7. Observe the confirmation dialog or submission banner.

#### Expected Result
- The form validates the dates and reason successfully.
- A loading indicator appears during submission.
- A success message (e.g. 'Leave request submitted successfully') is displayed.
- The user is automatically redirected to the Leave History screen.

#### What Tester Must Verify
- [ ] Verify the new leave appears at the top of Leave History.
- [ ] Verify the status badge is displayed as 'PENDING'.
- [ ] Verify leave dates, leave type, and reason match the entered values.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-LEV-002 — Submit Multi-Day On-Duty Leave with Date Validation

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-LEV-002` |
| **Platform** | **Android** |
| **Module** | **Apply Leave** |
| **Feature** | **Submit Multi-Day On-Duty Leave with Date Validation** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher logged in

#### Test Data
- **Leave Type**: On Duty (OD)
- **Start Date**: Next Monday
- **End Date**: Next Wednesday
- **Reason**: Attending IEEE National Conference

#### Exact Manual Steps
1. Open 'Apply Leave' screen.
2. Select 'On Duty' from the Leave Type dropdown.
3. Select Start Date as Next Monday.
4. Select End Date as Next Wednesday (3-day duration).
5. Enter 'Attending IEEE National Conference' in Reason.
6. Submit the form.

#### Expected Result
- Multi-day range is accepted.
- Calculated total days indicator shows '3 Days'.
- Submission succeeds and appears as 'PENDING' in Leave History.

#### What Tester Must Verify
- [ ] Verify total day calculation accounts for working days only.
- [ ] Verify leave status reflects pending HOD approval.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-LEV-003 — Validation: End Date Before Start Date

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-LEV-003` |
| **Platform** | **Android** |
| **Module** | **Apply Leave** |
| **Feature** | **Validation: End Date Before Start Date** |
| **Target Role** | **Teacher** |

#### Preconditions
- On Apply Leave screen

#### Test Data
- **Start Date**: 2026-10-15
- **End Date**: 2026-10-10

#### Exact Manual Steps
1. Open 'Apply Leave'.
2. Select Start Date as October 15, 2026.
3. Attempt to set End Date as October 10, 2026 (prior to Start Date).
4. Attempt to tap 'Submit Leave Request'.

#### Expected Result
- The date picker prevents selecting an end date prior to start date, OR
- An inline validation error appears: 'End date cannot be earlier than start date'.
- Form submission is strictly blocked.

#### What Tester Must Verify
- [ ] Verify no network request is sent to backend.
- [ ] Verify error text is highlighted in error color.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-LEV-004 — Validation: Missing Mandatory Reason

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-LEV-004` |
| **Platform** | **Android** |
| **Module** | **Apply Leave** |
| **Feature** | **Validation: Missing Mandatory Reason** |
| **Target Role** | **Teacher** |

#### Preconditions
- On Apply Leave screen

#### Test Data
- **Leave Type**: Medical Leave
- **Start Date**: Tomorrow
- **End Date**: Tomorrow
- **Reason**: 

#### Exact Manual Steps
1. Select Leave Type and valid dates.
2. Leave the Reason input field completely blank.
3. Tap 'Submit Leave Request'.

#### Expected Result
- The app blocks submission.
- Inline error message appears: 'Reason is required' or 'Please provide a valid reason'.

#### What Tester Must Verify
- [ ] Verify field focuses or displays red border.
- [ ] Verify submit button does not trigger API call.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-LEV-005 — Cancel a Pending Leave Request

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-LEV-005` |
| **Platform** | **Android** |
| **Module** | **Leave History** |
| **Feature** | **Cancel a Pending Leave Request** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher has at least one leave request in 'PENDING' state

#### Test Data
- **Target Leave ID**: Recent pending leave

#### Exact Manual Steps
1. Navigate to 'Leave History' screen.
2. Locate the leave card with status 'PENDING'.
3. Tap the 'Cancel Request' button on the card.
4. Confirm the cancellation prompt ('Are you sure you want to cancel this leave request?').
5. Observe the status change.

#### Expected Result
- The cancellation request executes successfully.
- The leave card status badge updates from 'PENDING' to 'CANCELLED'.
- The 'Cancel Request' button disappears or becomes disabled.

#### What Tester Must Verify
- [ ] Verify leave cannot be cancelled twice.
- [ ] Verify approved or rejected leaves do NOT display a cancel button.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 8. Android Credits
### Test Case: AND-CRE-001 — Credit Balance Card & Transaction Ledger

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-CRE-001` |
| **Platform** | **Android** |
| **Module** | **Credits** |
| **Feature** | **Credit Balance Card & Transaction Ledger** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher has recorded credit history in database

#### Test Data
- **Target Screen**: Credits Screen

#### Exact Manual Steps
1. Navigate to the 'Credits' screen (via Dashboard chip or More menu).
2. Inspect the top summary card displaying 'Current Balance'.
3. Inspect the secondary metrics: 'Total Earned' and 'Total Deducted'.
4. Scroll down to the 'Transaction History' ledger.
5. Inspect an individual credit transaction entry: Date, Type (Substitution / Duty / Adjustment), Period/Class details, Credits delta (+1.0 or -1.0), and Running Balance.

#### Expected Result
- Current balance is displayed prominently with correct formatting (e.g. '12.0 Credits').
- Transaction ledger lists past adjustments in reverse chronological order.
- Positive credits (+1.0) are styled in green; deductions (-1.0) are styled in red/amber.

#### What Tester Must Verify
- [ ] Verify arithmetic: running balance accurately reflects transaction delta additions/subtractions.
- [ ] Verify transaction details describe the exact class and period covered.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-CRE-002 — Filter Transaction History

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-CRE-002` |
| **Platform** | **Android** |
| **Module** | **Credits** |
| **Feature** | **Filter Transaction History** |
| **Target Role** | **Teacher** |

#### Preconditions
- Credits screen open with multiple transaction types

#### Test Data
- **Filter Types**: All, Earned, Deducted

#### Exact Manual Steps
1. On the Credits screen, tap the transaction filter chips/tabs ('Earned', 'Deducted', 'All').
2. Tap 'Earned' and verify only positive credit transactions appear.
3. Tap 'Deducted' and verify only deductions appear.
4. Tap 'All' and verify the entire chronological ledger is restored.

#### Expected Result
- Ledger filters dynamically without lag.
- Filter state is clearly highlighted on the selected chip.

#### What Tester Must Verify
- [ ] Verify empty state message ('No transactions found for this filter') if a category has zero items.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 9. Android Substitution
### Test Case: AND-SUB-001 — View Assigned Substitution Workload

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-SUB-001` |
| **Platform** | **Android** |
| **Module** | **Substitution** |
| **Feature** | **View Assigned Substitution Workload** |
| **Target Role** | **Teacher** |

#### Preconditions
- A substitution has been assigned to this teacher by the HOD for today or upcoming date

#### Test Data
- **Target Screen**: Substitution Screen

#### Exact Manual Steps
1. Navigate to 'Substitution' from the bottom navigation or More menu.
2. Inspect the 'My Assigned Substitutions' tab.
3. Locate the assigned substitution card.
4. Inspect all details on the card: Date, Day Order, Period number, Class/Section, Subject, Room number, Original Teacher on leave, and Status.

#### Expected Result
- The substitution card is visible and clearly displays all required period parameters.
- Status displays 'ASSIGNED' or 'PENDING_ACKNOWLEDGEMENT'.

#### What Tester Must Verify
- [ ] Verify the assigned period does not conflict with the teacher's regular timetable.
- [ ] Verify original teacher's name is rendered correctly.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-SUB-002 — Acknowledge / Accept Assigned Substitution

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-SUB-002` |
| **Platform** | **Android** |
| **Module** | **Substitution** |
| **Feature** | **Acknowledge / Accept Assigned Substitution** |
| **Target Role** | **Teacher** |

#### Preconditions
- An assigned substitution is awaiting teacher acknowledgement

#### Test Data
- **Action**: Tap Accept / Acknowledge

#### Exact Manual Steps
1. Open the assigned substitution card details.
2. Tap the 'Accept Substitution' or 'Acknowledge' button.
3. Observe the confirmation feedback.
4. Verify the card status badge updates to 'ACCEPTED' or 'CONFIRMED'.

#### Expected Result
- The button triggers API call and disables double-clicking.
- Status chip updates to 'ACCEPTED' with a green checkmark icon.
- A notification/toast confirms the acceptance.

#### What Tester Must Verify
- [ ] Verify the accepted slot now appears in the teacher's schedule on the Dashboard.
- [ ] Verify credit expectation note indicates '+1.0 Credit upon attendance/completion'.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 10. Android Notifications
### Test Case: AND-NOT-001 — Unread Counter Badge & Notification Feed

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-NOT-001` |
| **Platform** | **Android** |
| **Module** | **Notifications** |
| **Feature** | **Unread Counter Badge & Notification Feed** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher has unread notifications (e.g. Leave approved, Substitution assigned)

#### Test Data
- **Target Screen**: Notifications Screen

#### Exact Manual Steps
1. Inspect the Notification Bell icon on the top app bar of the Dashboard.
2. Verify the red numerical badge shows the exact number of unread notifications.
3. Tap the Notification Bell icon.
4. Inspect the notification feed list: Notification title, body message, category icon, and timestamp (e.g. '10 mins ago').
5. Observe unread notifications having a distinct highlighted background or unread dot.

#### Expected Result
- Notification badge displays accurate count.
- Notifications feed opens smoothly with all incoming alerts listed in reverse chronological order.

#### What Tester Must Verify
- [ ] Verify timestamps are formatted cleanly using relative or absolute time.
- [ ] Verify icons distinguish between Leave, Substitution, Announcement, and System alerts.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-NOT-002 — Tap Notification to Deep-Link to Work Item

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-NOT-002` |
| **Platform** | **Android** |
| **Module** | **Notifications** |
| **Feature** | **Tap Notification to Deep-Link to Work Item** |
| **Target Role** | **Teacher** |

#### Preconditions
- Unread leave approval notification and substitution notification present

#### Test Data
- **Action**: Tap individual notification

#### Exact Manual Steps
1. On the Notifications screen, tap a 'Leave Request Approved' notification.
2. Observe destination screen.
3. Press Back to return to Notifications.
4. Tap an 'Emergency Substitution Assigned' notification.
5. Observe destination screen.

#### Expected Result
- Tapping the leave notification navigates directly to the Leave History screen with the approved leave in view.
- Tapping the substitution notification navigates directly to the Substitution screen with the target assignment.
- The tapped notification's status automatically transitions from unread to read.

#### What Tester Must Verify
- [ ] Verify the notification badge on the top bar decrements accordingly.
- [ ] Verify unread visual styling clears on the tapped notification.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-NOT-003 — Mark All as Read Action

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-NOT-003` |
| **Platform** | **Android** |
| **Module** | **Notifications** |
| **Feature** | **Mark All as Read Action** |
| **Target Role** | **Teacher** |

#### Preconditions
- Multiple unread notifications exist

#### Test Data
- **Action**: Tap Mark All as Read

#### Exact Manual Steps
1. On the Notifications screen, tap the 'Mark All as Read' button in the top bar or menu.
2. Observe the feed items and the unread badge.

#### Expected Result
- All notifications immediately clear their unread highlight.
- The unread count badge disappears or displays '0'.

#### What Tester Must Verify
- [ ] Verify returning to the Dashboard shows zero unread notifications on the bell icon.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 11. Android Announcements
### Test Case: AND-ANN-001 — View Announcement Feed & Pinned Circulars

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-ANN-001` |
| **Platform** | **Android** |
| **Module** | **Announcements** |
| **Feature** | **View Announcement Feed & Pinned Circulars** |
| **Target Role** | **Teacher** |

#### Preconditions
- At least one published institutional announcement exists

#### Test Data
- **Target Screen**: Announcements Screen

#### Exact Manual Steps
1. Navigate to 'Announcements' from the More menu or Dashboard shortcut.
2. Inspect the announcement feed cards.
3. Check for any 'PINNED' or 'URGENT' priority tags on important circulars.
4. Verify each card displays: Title, Publisher/Author name, Publisher Role, Publication Date/Time, Short preview text, and Attachment indicator icon.

#### Expected Result
- Announcements list renders cleanly.
- Pinned announcements appear at the top of the feed regardless of publication timestamp.
- Cards have clear visual hierarchy.

#### What Tester Must Verify
- [ ] Verify publisher name matches administrator who created it.
- [ ] Verify urgent banners use appropriate amber/red alert styling.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-ANN-002 — Open Announcement Details & Download Attachment

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-ANN-002` |
| **Platform** | **Android** |
| **Module** | **Announcements** |
| **Feature** | **Open Announcement Details & Download Attachment** |
| **Target Role** | **Teacher** |

#### Preconditions
- Announcement with PDF or image attachment exists

#### Test Data
- **Attachment Type**: PDF Circular

#### Exact Manual Steps
1. Tap on an announcement card to open 'Announcement Detail' screen.
2. Read the full rich text/markdown body.
3. Locate the attachment card (e.g. 'Circular_Sept2026.pdf').
4. Tap on the attachment card or 'Download' button.
5. Observe download progress and open intent.

#### Expected Result
- Announcement details screen displays full formatted text without truncation.
- Tapping the attachment downloads the file and launches the default Android PDF viewer / image viewer.
- File opens cleanly without corruption.

#### What Tester Must Verify
- [ ] Verify downloaded file matches the document uploaded on the web portal.
- [ ] Verify back button returns cleanly to the announcement feed.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 12. Android Attendance
### Test Case: AND-ATT-001 — Daily Attendance Status Card (Not Reported State)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-ATT-001` |
| **Platform** | **Android** |
| **Module** | **Attendance** |
| **Feature** | **Daily Attendance Status Card (Not Reported State)** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher has not yet checked in today

#### Test Data
- **Initial State**: NOT_REPORTED

#### Exact Manual Steps
1. Tap the 'Attendance' tab in the bottom navigation bar.
2. Inspect the top status card.
3. Observe the current attendance badge ('Not Reported' or 'Pending Check-In').
4. Verify the 'Check-In' button is active and enabled.
5. Verify the 'Check-Out' button is disabled or hidden prior to check-in.

#### Expected Result
- Attendance screen clearly indicates that the teacher has not checked in for today.
- Current system date and time are displayed accurately.
- Primary call-to-action button is 'Start Check-In'.

#### What Tester Must Verify
- [ ] Verify no dummy check-in time is populated.
- [ ] Verify button state adheres to state machine rules.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-ATT-002 — Successful Face Verification & Check-In Inside Campus

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-ATT-002` |
| **Platform** | **Android** |
| **Module** | **Attendance** |
| **Feature** | **Successful Face Verification & Check-In Inside Campus** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher's face is enrolled
- Teacher is inside campus geofence
- Camera and Location permissions granted

#### Test Data
- **Target Location**: Inside Campus Boundary

#### Exact Manual Steps
1. On the Attendance screen, tap 'Start Check-In'.
2. Observe the camera viewfinder preview.
3. Verify the geofence indicator badge at the top shows 'Campus Perimeter Verified' (Green).
4. Position face inside the camera alignment frame.
5. Observe face detection bounding box or oval indicator.
6. Follow the active liveness instruction displayed on screen (e.g. 'Turn your head slightly to the left' or 'Blink your eyes once').
7. Hold face steady while verification matches face embeddings.
8. Observe the check-in completion dialog.

#### Expected Result
- The camera preview is smooth (30+ FPS) without freezing.
- Geofence verifies successfully with green status.
- Face detection recognizes the user's face.
- Active liveness challenge validates successfully.
- Check-In success dialog appears displaying the exact Check-In timestamp.
- The status card updates to 'Checked In'.

#### What Tester Must Verify
- [ ] Verify the displayed teacher name matches the logged-in user.
- [ ] Verify the check-in time reflects current device time.
- [ ] Verify 'Check-In' button is now disabled, and 'Check-Out' button is enabled.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-ATT-003 — Duplicate Check-In Rejection

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-ATT-003` |
| **Platform** | **Android** |
| **Module** | **Attendance** |
| **Feature** | **Duplicate Check-In Rejection** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher has already successfully checked in for today

#### Test Data
- **State**: CHECKED_IN

#### Exact Manual Steps
1. Remain on the Attendance screen after successful check-in.
2. Inspect the 'Check-In' button state.
3. Attempt to tap 'Check-In' if clickable, or inspect if disabled with message 'Already Checked In'.

#### Expected Result
- The app strictly prevents duplicate check-in.
- The button is visibly disabled or displays 'Checked In at [Time]'.
- No duplicate attendance record can be initiated.

#### What Tester Must Verify
- [ ] Verify that spamming the button area does not launch camera verification.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-ATT-004 — Successful Check-Out Flow

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-ATT-004` |
| **Platform** | **Android** |
| **Module** | **Attendance** |
| **Feature** | **Successful Check-Out Flow** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher is currently in 'Checked In' state
- Teacher is inside campus geofence

#### Test Data
- **State**: CHECKED_IN -> CHECKED_OUT

#### Exact Manual Steps
1. On the Attendance screen, tap 'Start Check-Out'.
2. Complete the camera alignment and verification step.
3. Confirm check-out prompt if presented.
4. Observe the check-out completion confirmation.
5. Observe the status card updating to 'Checked Out' showing both Check-In and Check-Out timestamps.

#### Expected Result
- Check-Out completes successfully.
- The screen records and displays the exact Check-Out time.
- Both 'Check-In' and 'Check-Out' buttons are now disabled for the remainder of the day.

#### What Tester Must Verify
- [ ] Verify total working hours duration is calculated accurately if displayed.
- [ ] Verify attendance record persists when leaving the screen and returning.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-ATT-005 — Anti-Spoofing: Rejection of Static Photo / Printed Paper

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-ATT-005` |
| **Platform** | **Android** |
| **Module** | **Attendance** |
| **Feature** | **Anti-Spoofing: Rejection of Static Photo / Printed Paper** |
| **Target Role** | **Teacher** |

#### Preconditions
- On Check-In camera preview

#### Test Data
- **Attack Vector**: Printed photo or smartphone screen displaying teacher's photo

#### Exact Manual Steps
1. Initiate Check-In.
2. Instead of a real human face, hold a printed photo or tablet screen displaying the teacher's face in front of the camera.
3. Observe the liveness evaluation engine response.

#### Expected Result
- The system fails the liveness challenge (no natural micro-movements, eye blink, or head pose yaw/pitch).
- Verification fails with error: 'Liveness verification failed: Presentation attack or spoofing detected'.
- Check-In is strictly rejected.

#### What Tester Must Verify
- [ ] Verify no attendance record is posted.
- [ ] Verify failure state offers a retry option for real human user.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 13. Android Biometrics (Face Enrollment)
### Test Case: AND-BIO-001 — First-Time Face Enrollment Flow

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-BIO-001` |
| **Platform** | **Android** |
| **Module** | **Face Enrollment** |
| **Feature** | **First-Time Face Enrollment Flow** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher account has has_face_enrolled = False
- Camera permission granted

#### Test Data
- **Target Screen**: Face Enrollment Screen

#### Exact Manual Steps
1. From More menu or setup prompt, navigate to 'Face Enrollment'.
2. Read the on-screen positioning instructions ('Hold phone at eye level, ensure good lighting, remove face coverings').
3. Tap 'Start Enrollment'.
4. Align face inside the biometric capture oval.
5. Complete the 3D head pose and blink calibration challenge.
6. Wait for 100% progress and embedding extraction.
7. Observe enrollment success confirmation.

#### Expected Result
- Face alignment guide provides real-time feedback (e.g. 'Center your face', 'Face too far', 'Optimal').
- Liveness challenge validates.
- Biometric face vector is generated and securely registered on backend.
- Confirmation screen displays 'Face Enrollment Completed Successfully'.

#### What Tester Must Verify
- [ ] Verify teacher's profile now shows 'Biometrics: Enrolled'.
- [ ] Verify subsequent Attendance Check-In can be initiated immediately.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-BIO-002 — Environmental Guidance: Poor Lighting Detection

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-BIO-002` |
| **Platform** | **Android** |
| **Module** | **Face Enrollment** |
| **Feature** | **Environmental Guidance: Poor Lighting Detection** |
| **Target Role** | **Teacher** |

#### Preconditions
- In poorly lit / dark room

#### Test Data
- **Condition**: Ambient Lux < 10

#### Exact Manual Steps
1. Open Face Enrollment in a dark room or cover light source.
2. Observe real-time feedback overlay.

#### Expected Result
- The app detects insufficient ambient illumination.
- An on-screen warning appears: 'Lighting too dark. Please move to a well-lit area'.
- Capture is paused until adequate lighting is restored.

#### What Tester Must Verify
- [ ] Verify app does not produce corrupted or blank embeddings under low light.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-BIO-003 — Multi-Face Detection Rejection

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-BIO-003` |
| **Platform** | **Android** |
| **Module** | **Face Enrollment** |
| **Feature** | **Multi-Face Detection Rejection** |
| **Target Role** | **Teacher** |

#### Preconditions
- Two individuals standing in front of camera

#### Test Data
- **Condition**: Multiple faces in frame

#### Exact Manual Steps
1. Open Face Enrollment or Check-In.
2. Have two people position their faces in the camera frame simultaneously.
3. Observe detector feedback.

#### Expected Result
- The detector identifies more than one face.
- An error/warning overlay appears: 'Multiple faces detected. Please ensure only one person is in frame'.
- Enrollment / verification is blocked until extra person steps out.

#### What Tester Must Verify
- [ ] Verify single-face restriction protects against identity confusion.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 14. Android Geofencing
### Test Case: AND-GEO-001 — Attendance Attempt Outside Campus Perimeter

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-GEO-001` |
| **Platform** | **Android** |
| **Module** | **Geofencing** |
| **Feature** | **Attendance Attempt Outside Campus Perimeter** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher device physically located outside campus (or simulated via Mock GPS > 500m away)

#### Test Data
- **Coordinates**: Outside Campus Geofence Boundary

#### Exact Manual Steps
1. Open Attendance screen while outside campus.
2. Observe the location status badge at the top.
3. Observe the message displayed: 'Outside Institutional Campus: Please be inside campus to record attendance'.
4. Tap 'Start Check-In'.

#### Expected Result
- Check-In is blocked.
- An informative dialog or toast states: 'Location Verification Failed: You are outside the authorized campus geofence'.
- Distance to the nearest campus zone is displayed (e.g. 'Distance to campus: ~650m').

#### What Tester Must Verify
- [ ] Verify camera verification cannot proceed while outside geofence.
- [ ] Verify no attendance record is saved.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-GEO-002 — Check-In with Device GPS / Location Services Disabled

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-GEO-002` |
| **Platform** | **Android** |
| **Module** | **Geofencing** |
| **Feature** | **Check-In with Device GPS / Location Services Disabled** |
| **Target Role** | **Teacher** |

#### Preconditions
- Device Location / GPS toggled OFF in Android quick settings

#### Test Data
- **Condition**: Location Services Disabled

#### Exact Manual Steps
1. Turn OFF Location/GPS in Android System Settings.
2. Open the FAFLOW Attendance screen.
3. Observe the location status card.
4. Tap 'Start Check-In'.

#### Expected Result
- The app detects that Location Services are disabled.
- Status displays: 'Location Services Disabled'.
- A system prompt or button 'Enable Location' appears prompting the user to turn on GPS.
- Check-In cannot proceed without GPS.

#### What Tester Must Verify
- [ ] Verify enabling GPS immediately re-initiates satellite fix without restarting app.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-GEO-003 — Simulated / Mock GPS Detection & Rejection

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-GEO-003` |
| **Platform** | **Android** |
| **Module** | **Geofencing** |
| **Feature** | **Simulated / Mock GPS Detection & Rejection** |
| **Target Role** | **Teacher** |

#### Preconditions
- Mock Location enabled in Android Developer Options using Fake GPS app

#### Test Data
- **Condition**: Mock Location App Active

#### Exact Manual Steps
1. Enable a Fake GPS / Mock Location provider app on the test device.
2. Set fake coordinates to be inside the campus center.
3. Open FAFLOW Attendance screen.
4. Attempt to start Check-In.

#### Expected Result
- The app's anti-spoofing detector identifies mock location provider flags.
- Status displays in red: 'Simulated Location Rejected: Mock GPS prohibited for attendance integrity'.
- Check-In is completely blocked.

#### What Tester Must Verify
- [ ] Verify security audit log on backend registers mock GPS attempt if supported.
- [ ] Verify fake attendance cannot be recorded.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-GEO-004 — Calibrating Satellite Lock (Poor Accuracy Handling)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-GEO-004` |
| **Platform** | **Android** |
| **Module** | **Geofencing** |
| **Feature** | **Calibrating Satellite Lock (Poor Accuracy Handling)** |
| **Target Role** | **Teacher** |

#### Preconditions
- Device receiving poor GPS signal (e.g. deep inside basement or heavy indoor shielding)

#### Test Data
- **Condition**: GPS Accuracy > 50 meters

#### Exact Manual Steps
1. Open Attendance screen under poor GPS signal conditions.
2. Observe the location status badge.

#### Expected Result
- Status displays in amber: 'Calibrating Satellite Lock: Current precision: ±[X]m (target: ≤[Y]m)'.
- Check-In is temporarily held until high-precision satellite fix is acquired.

#### What Tester Must Verify
- [ ] Verify app does not accept low-precision cell tower estimates that could misrepresent campus boundary.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 15. Android Offline Mode
### Test Case: AND-OFF-001 — App Launch & Cached Timetable Access in Airplane Mode

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-OFF-001` |
| **Platform** | **Android** |
| **Module** | **Offline Mode** |
| **Feature** | **App Launch & Cached Timetable Access in Airplane Mode** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher has previously logged in and loaded their timetable while online

#### Test Data
- **Condition**: Device Airplane Mode ON (No Wi-Fi, No Cellular Data)

#### Exact Manual Steps
1. Enable Airplane Mode on the Android device.
2. Launch the FAFLOW app.
3. Observe app launch behavior.
4. Navigate to the Timetable tab.
5. Switch between Day Order tabs.

#### Expected Result
- App launches successfully without crashing or getting stuck on a blank screen.
- An offline indicator banner (e.g. 'Working in Offline Mode') appears at the top.
- Cached timetable slots for all Day Orders are fully viewable from local Room database.

#### What Tester Must Verify
- [ ] Verify cached profile, credits, and schedule load without internet connection.
- [ ] Verify app does not show a blocking full-screen error.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-OFF-002 — Offline Attendance Queueing & Automatic Sync on Reconnect

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-OFF-002` |
| **Platform** | **Android** |
| **Module** | **Offline Mode** |
| **Feature** | **Offline Attendance Queueing & Automatic Sync on Reconnect** |
| **Target Role** | **Teacher** |

#### Preconditions
- Airplane Mode ON
- Teacher attempts supported offline attendance check-in

#### Test Data
- **Condition**: Offline Queue -> Online Sync

#### Exact Manual Steps
1. With Airplane mode enabled, perform an attendance verification (if offline queueing is permitted by policy).
2. Observe that the attendance record is stored locally in Room database with 'UNSYNCED' flag.
3. Navigate to 'Sync Status' screen (via More menu).
4. Verify '1 Unsynced Attendance Record' is listed.
5. Disable Airplane Mode and reconnect to Wi-Fi / mobile data.
6. Observe the background AttendanceSyncWorker execution or tap 'Sync Now'.

#### Expected Result
- The offline record is successfully transmitted to the FastAPI backend.
- Backend processes the record and returns confirmation.
- The unsynced counter decrements to '0' and status updates to 'All Records Synchronized'.
- No duplicate record is created.

#### What Tester Must Verify
- [ ] Verify timestamps match original offline capture time.
- [ ] Verify web attendance dashboard immediately reflects the synchronized record.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 16. Android UI Audit
### Test Case: AND-UI-001 — Responsiveness Across Screen Sizes (Small Phone vs Tablet)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-UI-001` |
| **Platform** | **Android** |
| **Module** | **UI Visual Audit** |
| **Feature** | **Responsiveness Across Screen Sizes (Small Phone vs Tablet)** |
| **Target Role** | **Any** |

#### Preconditions
- Testing on 360dp width compact phone and 600dp+ tablet/foldable

#### Test Data
- **Screen Formats**: Compact 5.5-inch vs Large 10-inch Display

#### Exact Manual Steps
1. Open FAFLOW on a small 360dp width screen.
2. Inspect all 4 primary tabs: Home, Timetable, Attendance, More.
3. Check for any text truncation (clipped ellipses), overlapping buttons, or horizontal scrollbar leaks.
4. Open the app on a tablet or landscape foldable.
5. Inspect grid layouts and responsive card expansion.

#### Expected Result
- All UI components scale gracefully across small and large form factors.
- No buttons or labels overlap.
- Tablets utilize multi-column or expanded cards cleanly without stretching single elements awkwardly.

#### What Tester Must Verify
- [ ] Verify minimum touch target size of 48dp for all clickable buttons and icons.
- [ ] Verify floating action buttons do not obscure bottom content.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-UI-002 — System Font Scaling & Text Wrapping Audit

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-UI-002` |
| **Platform** | **Android** |
| **Module** | **UI Visual Audit** |
| **Feature** | **System Font Scaling & Text Wrapping Audit** |
| **Target Role** | **Any** |

#### Preconditions
- Android System Settings > Display > Font Size set to 'Largest' (1.3x scaling)

#### Test Data
- **Font Scale**: 130%

#### Exact Manual Steps
1. Set Android system font size to maximum (130% / Largest).
2. Launch FAFLOW.
3. Navigate through Dashboard, Apply Leave form, and Attendance screens.
4. Inspect text labels, button labels, and table headers.

#### Expected Result
- All text elements wrap cleanly to multiple lines where necessary.
- No critical information (timestamps, balances, buttons) is cut off or unreadable.

#### What Tester Must Verify
- [ ] Verify 'Sign In', 'Submit', 'Check-In' button text remains fully legible.
- [ ] Verify date picker dialogs render correctly without clipping day numbers.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: AND-UI-003 — Dark Mode & Theme Switching Verification

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `AND-UI-003` |
| **Platform** | **Android** |
| **Module** | **UI Visual Audit** |
| **Feature** | **Dark Mode & Theme Switching Verification** |
| **Target Role** | **Any** |

#### Preconditions
- Android System Dark Theme toggled ON

#### Test Data
- **Theme**: System Dark Mode

#### Exact Manual Steps
1. Toggle device system theme between Light Mode and Dark Mode.
2. Observe FAFLOW theme adaptation.
3. Inspect contrast on dark backgrounds (cards, dialogs, inputs, bottom navigation).

#### Expected Result
- App adapts smoothly to Dark Theme (or maintains brand-consistent dark surface palette).
- Text maintains WCAG AA contrast ratio (≥ 4.5:1 for body text).
- No unreadable dark-gray text on black surfaces exists.

#### What Tester Must Verify
- [ ] Verify icons remain clearly visible in both light and dark modes.
- [ ] Verify input field borders and focus rings are distinct.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---


## 17. Web Authentication
### Test Case: WEB-AUTH-001 — Administrator Login with Username

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-AUTH-001` |
| **Platform** | **Web Application** |
| **Module** | **Authentication** |
| **Feature** | **Administrator Login with Username** |
| **Target Role** | **System Admin** |

#### Preconditions
- System Admin account exists with updated credentials
- Web frontend running on browser

#### Test Data
- **Username**: sysadmin
- **Password**: Admin@123456

#### Exact Manual Steps
1. Open the web application URL (e.g. http://localhost:5173/login) in Google Chrome or Mozilla Firefox.
2. Verify the Login card renders with the GOVERNENCE title and FAFLOW branding.
3. Enter 'sysadmin' into the Email or Username field.
4. Enter 'Admin@123456' into the Password field.
5. Click the 'Sign In' button.
6. Observe the button loading spinner and page transition.

#### Expected Result
- Authentication completes successfully without errors.
- User is redirected to the System Admin Dashboard at '/admin/dashboard'.
- TopBar displays the user's name ('System Administrator') and role badge.

#### What Tester Must Verify
- [ ] Verify full sidebar navigation options appear (Departments, Teachers, Classes, Rooms, Backup, System Metrics).
- [ ] Verify JWT token is stored in localStorage.
- [ ] Verify no 401 or 500 errors occur in browser developer console.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-AUTH-002 — First-Login Credential Change Gate

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-AUTH-002` |
| **Platform** | **Web Application** |
| **Module** | **Authentication** |
| **Feature** | **First-Login Credential Change Gate** |
| **Target Role** | **System Admin** |

#### Preconditions
- Default bootstrap admin account exists (username='admin', password='admin', must_change_credentials=True)

#### Test Data
- **Username**: admin
- **Password**: admin
- **New Username**: college_admin
- **New Password**: SecureAdminPassword@2026

#### Exact Manual Steps
1. Navigate to '/login'.
2. Enter default bootstrap credentials: Username 'admin', Password 'admin'.
3. Click 'Sign In'.
4. Observe the redirection to the First-Login Setup screen ('/first-login-setup').
5. Attempt to navigate away directly to '/admin/dashboard' via URL bar.
6. Observe the RequireCredentialsSet guard blocking dashboard access.
7. On '/first-login-setup', enter a new unique username and a strong password.
8. Confirm the password and click 'Save & Continue'.

#### Expected Result
- The system strictly forces the user to '/first-login-setup'.
- Direct URL tampering to bypass setup is rejected by both frontend guard and backend API.
- Submitting the new credentials updates the account, clears must_change_credentials, and safely redirects to the Dashboard.

#### What Tester Must Verify
- [ ] Verify subsequent login with old password 'admin' is rejected.
- [ ] Verify user can now access all administrative routes.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-AUTH-003 — Teacher Web Portal Login

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-AUTH-003` |
| **Platform** | **Web Application** |
| **Module** | **Authentication** |
| **Feature** | **Teacher Web Portal Login** |
| **Target Role** | **Teacher** |

#### Preconditions
- Teacher account exists
- Teacher credentials known

#### Test Data
- **Email**: kamesh1272006s@gmail.com
- **Password**: Kamesh1272006@k

#### Exact Manual Steps
1. Open '/login'.
2. Enter teacher email 'kamesh1272006s@gmail.com'.
3. Enter teacher password.
4. Click 'Sign In'.

#### Expected Result
- Teacher is authenticated and redirected to '/teacher/dashboard'.
- Teacher navigation menu appears: Home, Announcements, Student Attendance, My Duties, My Timetable, Classwise Timetable, Apply for Leave, Leave History, Manage Substitutes, Today's Coverage, My Credits.

#### What Tester Must Verify
- [ ] Verify admin sections (Backup, Data Retention, Departments) are absent from sidebar.
- [ ] Verify teacher name and department appear on top bar.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-AUTH-004 — Invalid Password Error State

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-AUTH-004` |
| **Platform** | **Web Application** |
| **Module** | **Authentication** |
| **Feature** | **Invalid Password Error State** |
| **Target Role** | **Any** |

#### Preconditions
- On web login page

#### Test Data
- **Identifier**: sysadmin
- **Password**: IncorrectPassword123!

#### Exact Manual Steps
1. Enter valid identifier and incorrect password.
2. Click 'Sign In'.
3. Observe visual feedback.

#### Expected Result
- Form displays a red alert toast or banner: 'Invalid username/email or password'.
- Login form shakes or highlights password box in red.
- User remains on '/login'.

#### What Tester Must Verify
- [ ] Verify network call returns 400 or 401 with informative JSON message.
- [ ] Verify password field is cleared or ready for re-entry.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-AUTH-005 — User Logout Flow

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-AUTH-005` |
| **Platform** | **Web Application** |
| **Module** | **Authentication** |
| **Feature** | **User Logout Flow** |
| **Target Role** | **Any** |

#### Preconditions
- User logged in on web

#### Test Data
- **Action**: Logout via TopBar profile menu

#### Exact Manual Steps
1. Click the user profile avatar or dropdown at the top right of the TopBar.
2. Click 'Sign Out' or 'Logout'.
3. Observe screen transition.

#### Expected Result
- Auth token is completely cleared from browser storage.
- User is redirected immediately to '/login'.
- Clicking browser 'Back' button does not access cached authenticated pages.

#### What Tester Must Verify
- [ ] Verify protected routes redirect back to '/login' after logout.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 18. Web Dashboards
### Test Case: WEB-DASH-001 — System Admin Dashboard Overview & Metrics

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-DASH-001` |
| **Platform** | **Web Application** |
| **Module** | **Dashboard** |
| **Feature** | **System Admin Dashboard Overview & Metrics** |
| **Target Role** | **System Admin** |

#### Preconditions
- Logged in as System Admin

#### Test Data
- **Target URL**: /admin/dashboard

#### Exact Manual Steps
1. Open '/admin/dashboard'.
2. Inspect the top KPI overview cards: Total Faculty, Total Departments, Active Classes, Today's Overall Attendance percentage, and System Status.
3. Inspect quick action shortcut cards: 'Add Teacher', 'Manage Timetable', 'Configure Calendar', 'Backup System'.
4. Inspect the recent activity feed or audit log summary.

#### Expected Result
- All KPI metric counts match real database records.
- Cards render without layout overflow or missing numbers.
- Clicking a quick action card navigates directly to the target management page.

#### What Tester Must Verify
- [ ] Verify clicking 'Add Teacher' opens the Teachers modal/page.
- [ ] Verify KPI values update when new records are added.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-DASH-002 — Governance Command Center (Emergency & Oversight)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-DASH-002` |
| **Platform** | **Web Application** |
| **Module** | **Dashboard** |
| **Feature** | **Governance Command Center (Emergency & Oversight)** |
| **Target Role** | **Governance** |

#### Preconditions
- Logged in as Governance user (governence@26022006)

#### Test Data
- **Target URL**: /governance

#### Exact Manual Steps
1. Log in as Governance user.
2. Navigate to '/governance'.
3. Inspect the Command Center dashboard: Emergency controls, live campus attendance monitor, timetable coverage health widget, and campus duty status.
4. Inspect the quick override buttons.

#### Expected Result
- Command center renders high-level institutional oversight widgets.
- Real-time campus statistics load accurately without rate limiting.

#### What Tester Must Verify
- [ ] Verify user has cross-department visibility across all 10 departments.
- [ ] Verify emergency broadcast and override links are fully operational.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-DASH-003 — Principal Dashboard (Campus-Wide Read-Only Oversight)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-DASH-003` |
| **Platform** | **Web Application** |
| **Module** | **Dashboard** |
| **Feature** | **Principal Dashboard (Campus-Wide Read-Only Oversight)** |
| **Target Role** | **Principal** |

#### Preconditions
- Logged in as Principal (Role.principal)

#### Test Data
- **Target URL**: /principal/dashboard

#### Exact Manual Steps
1. Log in as Principal.
2. Navigate to '/principal/dashboard'.
3. Review campus-wide student attendance analytics card.
4. Review faculty attendance summary across all departments.
5. Review upcoming campus duties and campus structure overview.

#### Expected Result
- Principal dashboard renders complete institution-level data.
- Destructive configuration actions (Delete Department, Factory Reset, Backup Purge) are omitted or read-only.

#### What Tester Must Verify
- [ ] Verify department filtering allows drill-down into CSE, ECE, MECH, etc.
- [ ] Verify no edit/delete buttons exist on read-only views.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-DASH-004 — Teacher Workspace Dashboard

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-DASH-004` |
| **Platform** | **Web Application** |
| **Module** | **Dashboard** |
| **Feature** | **Teacher Workspace Dashboard** |
| **Target Role** | **Teacher** |

#### Preconditions
- Logged in as Teacher

#### Test Data
- **Target URL**: /teacher/dashboard

#### Exact Manual Steps
1. Log in as Teacher and view '/teacher/dashboard'.
2. Inspect today's schedule grid showing periods for the active Day Order.
3. Inspect the Credit Balance widget showing current credits.
4. Inspect active Leave and Substitution alert cards.

#### Expected Result
- Teacher dashboard accurately shows personalized schedule and credits.
- Shortcut links open 'Apply for Leave' and 'Manage Substitutes' directly.

#### What Tester Must Verify
- [ ] Verify only this teacher's classes are displayed in today's schedule.
- [ ] Verify no administrative controls are visible.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 19. Web Master Data
### Test Case: WEB-MAS-001 — Create New Department

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-MAS-001` |
| **Platform** | **Web Application** |
| **Module** | **Master Data** |
| **Feature** | **Create New Department** |
| **Target Role** | **System Admin** |

#### Preconditions
- Logged in as System Admin

#### Test Data
- **Department Name**: Robotics & Automation
- **Department Code**: ROBO

#### Exact Manual Steps
1. Navigate to '/admin/departments'.
2. Click the 'Add Department' or 'New Department' button.
3. In the modal, enter 'Robotics & Automation' in the Name field.
4. Enter 'ROBO' in the Code field.
5. Click 'Save' / 'Create Department'.
6. Observe table update.

#### Expected Result
- Modal closes and success toast appears: 'Department created successfully'.
- The new department appears in the department list table.
- Department code is automatically capitalized.

#### What Tester Must Verify
- [ ] Verify department appears in department dropdowns across Teachers, Classes, and Subjects forms.
- [ ] Verify attempting to create another department with code 'ROBO' shows duplicate error.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-MAS-002 — Edit Department Details

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-MAS-002` |
| **Platform** | **Web Application** |
| **Module** | **Master Data** |
| **Feature** | **Edit Department Details** |
| **Target Role** | **System Admin** |

#### Preconditions
- Department exists

#### Test Data
- **Existing Code**: ROBO
- **Updated Name**: Robotics & Artificial Intelligence

#### Exact Manual Steps
1. On '/admin/departments', locate 'Robotics & Automation'.
2. Click the 'Edit' action button.
3. Change the Name to 'Robotics & Artificial Intelligence'.
4. Click 'Update Department'.

#### Expected Result
- Department name updates in the table immediately.
- Success notification is displayed.

#### What Tester Must Verify
- [ ] Verify updated name reflects in related views.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-MAS-003 — Delete Department with Active Dependencies Protection

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-MAS-003` |
| **Platform** | **Web Application** |
| **Module** | **Master Data** |
| **Feature** | **Delete Department with Active Dependencies Protection** |
| **Target Role** | **System Admin** |

#### Preconditions
- Department has active assigned teachers and classes (e.g. CSE)

#### Test Data
- **Target Dept**: Computer Science & Engineering

#### Exact Manual Steps
1. On '/admin/departments', locate 'Computer Science & Engineering'.
2. Click the 'Delete' icon.
3. Confirm the deletion dialog.

#### Expected Result
- The deletion is strictly rejected by the backend RESTRICT foreign key constraint.
- An informative error modal/toast appears: 'Cannot delete department: 20 teachers and 2 classes are associated with this department. Please reassign or delete dependencies first'.

#### What Tester Must Verify
- [ ] Verify CSE department is NOT removed from the table.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-MAS-004 — Create New Teacher & Role Assignment

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-MAS-004` |
| **Platform** | **Web Application** |
| **Module** | **Master Data** |
| **Feature** | **Create New Teacher & Role Assignment** |
| **Target Role** | **System Admin** |

#### Preconditions
- On Teachers management page

#### Test Data
- **Name**: Dr. Sarah Jenkins
- **Email**: sarah.jenkins@college.edu
- **Department**: Computer Science & Engineering
- **Role**: Teacher

#### Exact Manual Steps
1. Navigate to '/admin/teachers'.
2. Click 'Add Teacher' button.
3. Enter Name: 'Dr. Sarah Jenkins'.
4. Enter Email: 'sarah.jenkins@college.edu'.
5. Select Department: 'Computer Science & Engineering'.
6. Select Role: 'Teacher'.
7. Click 'Save Teacher'.

#### Expected Result
- Teacher is created in the database with active status.
- Teacher appears in the Teachers directory table.
- Default password / welcome credentials instructions are displayed.

#### What Tester Must Verify
- [ ] Verify teacher is selectable in timetable slot assignment.
- [ ] Verify teacher appears in HOD Faculty Directory.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-MAS-005 — Bulk Class Creation Workflow

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-MAS-005` |
| **Platform** | **Web Application** |
| **Module** | **Master Data** |
| **Feature** | **Bulk Class Creation Workflow** |
| **Target Role** | **System Admin** |

#### Preconditions
- On Classes management page

#### Test Data
- **Department**: CSE
- **Prefix**: CSE Year
- **Sections**: A, B
- **Semesters**: 1, 2

#### Exact Manual Steps
1. Navigate to '/admin/classes'.
2. Click 'Bulk Create Classes' or 'Generate Classes' button.
3. Select Department: 'Computer Science & Engineering'.
4. Configure semesters (Sem 1 and Sem 2) and sections (A, B).
5. Click 'Generate Classes'.

#### Expected Result
- Classes are generated systematically: 'CSE Year 1 - Sec A', 'CSE Year 1 - Sec B', 'CSE Year 2 - Sec A', 'CSE Year 2 - Sec B'.
- Success notification confirms creation count.
- Classes appear in the class list table.

#### What Tester Must Verify
- [ ] Verify roll rules and student rosters can be mapped to newly created classes.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-MAS-006 — Create Room & Lab with Capacity

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-MAS-006` |
| **Platform** | **Web Application** |
| **Module** | **Master Data** |
| **Feature** | **Create Room & Lab with Capacity** |
| **Target Role** | **System Admin** |

#### Preconditions
- On Rooms management page

#### Test Data
- **Room Number**: Lab 402
- **Room Type**: Laboratory
- **Capacity**: 40

#### Exact Manual Steps
1. Navigate to '/admin/rooms'.
2. Click 'Add Room / Lab'.
3. Enter Room Number: 'Lab 402'.
4. Select Room Type: 'Laboratory' (or 'Classroom').
5. Enter Capacity: 40.
6. Click 'Save Room'.

#### Expected Result
- Room is added to the master rooms registry.
- Room appears in Room Availability and Timetable room picker.

#### What Tester Must Verify
- [ ] Verify duplicate room number creation is prevented.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-MAS-007 — Campus Structure Builder (Blocks, Floors, Rooms, Wings)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-MAS-007` |
| **Platform** | **Web Application** |
| **Module** | **Master Data** |
| **Feature** | **Campus Structure Builder (Blocks, Floors, Rooms, Wings)** |
| **Target Role** | **System Admin** |

#### Preconditions
- On Campus Structure Builder page (/admin/campus-structure)

#### Test Data
- **Block**: Main Academic Block A
- **Floor**: 2nd Floor
- **Wing**: East Wing

#### Exact Manual Steps
1. Navigate to '/admin/campus-structure'.
2. Click 'Add Block' and create 'Main Academic Block A'.
3. Select the block and click 'Add Floor' -> '2nd Floor'.
4. Under 2nd Floor, add 'East Wing'.
5. Assign rooms (e.g. Room 201, Room 202, Lab 402) into this structural hierarchy.
6. Save structure.

#### Expected Result
- Campus tree view displays hierarchical structure: Block -> Floor -> Wing -> Rooms.
- Structure is persisted and linked to physical room entities.

#### What Tester Must Verify
- [ ] Verify Campus Duty assignment uses this structure for zone definitions.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 20. Web Academic Calendar
### Test Case: WEB-CAL-001 — Configure Academic Year & Semester Term Dates

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-CAL-001` |
| **Platform** | **Web Application** |
| **Module** | **Academic Calendar** |
| **Feature** | **Configure Academic Year & Semester Term Dates** |
| **Target Role** | **System Admin** |

#### Preconditions
- On Academic Calendar page

#### Test Data
- **Academic Year**: 2026-2027
- **Start Date**: 2026-06-01
- **End Date**: 2027-05-31
- **Active**: True

#### Exact Manual Steps
1. Navigate to '/admin/academic-calendar'.
2. Click 'Manage Academic Years' or 'New Academic Year'.
3. Enter Name: '2026-2027'.
4. Set Start Date: June 1, 2026.
5. Set End Date: May 31, 2027.
6. Toggle 'Active Academic Year' to ON.
7. Save.

#### Expected Result
- Academic year is saved and set as current active year.
- All calendar days within the range are generated or mapped in the database.

#### What Tester Must Verify
- [ ] Verify only one academic year is active at a time.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-CAL-002 — Configure Holidays & Day Order Cycle (6-Day Cycle)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-CAL-002` |
| **Platform** | **Web Application** |
| **Module** | **Academic Calendar** |
| **Feature** | **Configure Holidays & Day Order Cycle (6-Day Cycle)** |
| **Target Role** | **System Admin** |

#### Preconditions
- Active academic year selected

#### Test Data
- **Date**: Next Friday
- **Day Type**: Holiday
- **Reason**: Institutional Symposium

#### Exact Manual Steps
1. On '/admin/academic-calendar', view the monthly calendar grid.
2. Click on next Friday's date cell.
3. In the Day Configuration modal, change Day Type from 'Working Day' to 'Holiday'.
4. Enter Holiday Name: 'Institutional Symposium'.
5. Toggle Day Order assignment (verify Day Order cycle pauses or advances according to institution policy).
6. Click 'Save Day'.

#### Expected Result
- Calendar cell updates visually with holiday styling (distinct color and label).
- The date is marked as non-working day across the system.
- Day Order sequence adjusts appropriately for subsequent working days.

#### What Tester Must Verify
- [ ] Verify teachers cannot apply for regular casual leave on this marked holiday.
- [ ] Verify timetable is not scheduled on this day.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 21. Web Timetable
### Test Case: WEB-TIME-001 — Create Valid Master Timetable Slot

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-TIME-001` |
| **Platform** | **Web Application** |
| **Module** | **Timetable** |
| **Feature** | **Create Valid Master Timetable Slot** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Department HOD or Admin logged in
- Active classes, subjects, rooms, and teachers exist

#### Test Data
- **Day Order**: Day Order 1
- **Period**: Period 2
- **Class**: CSE Year 1 - Sec A
- **Subject**: Data Structures
- **Teacher**: Prof. Kamesh Govindhan
- **Room**: Room 101

#### Exact Manual Steps
1. Navigate to '/admin/timetable'.
2. Select Department: 'Computer Science & Engineering'.
3. Select Day Order: 'Day 1'.
4. Locate the grid cell for 'CSE Year 1 - Sec A' at 'Period 2'.
5. Click the '+' button or empty cell to open the Slot Assignment Modal.
6. Select Subject: 'Data Structures (CSE-SUB-1)'.
7. Select Teacher: 'Prof. Kamesh Govindhan'.
8. Select Room: 'Room 101'.
9. Click 'Save Slot'.

#### Expected Result
- Slot saves successfully.
- The grid cell populates showing Subject code, Teacher name, and Room number.
- No conflict warning appears.

#### What Tester Must Verify
- [ ] Verify slot immediately appears in the teacher's schedule on Android.
- [ ] Verify slot appears in Classwise Timetable.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-TIME-002 — Conflict Detection: Teacher Collision

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-TIME-002` |
| **Platform** | **Web Application** |
| **Module** | **Timetable** |
| **Feature** | **Conflict Detection: Teacher Collision** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Prof. Kamesh Govindhan already assigned to Period 2 on Day 1

#### Test Data
- **Conflicting Class**: CSE Year 2 - Sec B
- **Period**: Period 2
- **Teacher**: Prof. Kamesh Govindhan

#### Exact Manual Steps
1. In '/admin/timetable', attempt to assign 'Prof. Kamesh Govindhan' to another class ('CSE Year 2 - Sec B') during the SAME Day 1, Period 2.
2. Select subject and room, then click 'Save Slot'.

#### Expected Result
- System intercepts the submission with a Teacher Conflict Dialog.
- Message displays: 'Schedule Conflict: Prof. Kamesh Govindhan is already scheduled for CSE Year 1 - Sec A in Room 101 during Day 1, Period 2'.
- The slot cannot be saved.

#### What Tester Must Verify
- [ ] Verify collision modal highlights the conflicting slot details.
- [ ] Verify database remains intact without duplicate assignments.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-TIME-003 — Conflict Detection: Room Collision

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-TIME-003` |
| **Platform** | **Web Application** |
| **Module** | **Timetable** |
| **Feature** | **Conflict Detection: Room Collision** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Room 101 already occupied during Period 2 on Day 1

#### Test Data
- **Different Teacher**: Teacher 2
- **Different Class**: CSE Year 2
- **Same Room**: Room 101

#### Exact Manual Steps
1. Attempt to assign Room 101 to a different teacher and class during Day 1, Period 2.
2. Click 'Save Slot'.

#### Expected Result
- System displays Room Conflict Dialog: 'Room 101 is already allocated to CSE Year 1 - Sec A during Day 1, Period 2'.
- Submission is blocked.

#### What Tester Must Verify
- [ ] Verify room double-booking is prevented.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-TIME-004 — Timetable Approvals Workflow

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-TIME-004` |
| **Platform** | **Web Application** |
| **Module** | **Timetable** |
| **Feature** | **Timetable Approvals Workflow** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Timetable draft modified and submitted for approval

#### Test Data
- **Target URL**: /admin/timetable/approvals

#### Exact Manual Steps
1. Navigate to '/admin/timetable/approvals'.
2. Inspect the pending timetable version submissions.
3. Open diff/comparison view showing proposed slot changes.
4. Click 'Approve Timetable'.
5. Confirm publication dialog.

#### Expected Result
- Timetable version status updates to 'APPROVED' and 'ACTIVE'.
- Published timetable becomes authoritative across web and mobile.

#### What Tester Must Verify
- [ ] Verify teachers receive notification that timetable has been updated.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 22. Web Leave
### Test Case: WEB-LEV-001 — Review and Approve Pending Leave Request

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-LEV-001` |
| **Platform** | **Web Application** |
| **Module** | **Leave Management** |
| **Feature** | **Review and Approve Pending Leave Request** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Teacher has submitted a leave request in 'PENDING' state

#### Test Data
- **Target URL**: /admin/leaves

#### Exact Manual Steps
1. Log in as HOD (or Admin) and navigate to '/admin/leaves'.
2. Review the 'Pending Requests' table.
3. Locate the leave request submitted by 'Prof. Kamesh Govindhan'.
4. Click the 'View Details' action button to open the Leave Drawer.
5. Review leave details: Teacher, Leave Type, Start Date, End Date, Total Days, Reason, and impacted timetable slots.
6. Click 'Approve Leave'.
7. Confirm approval modal.

#### Expected Result
- Leave request status updates from 'PENDING' to 'APPROVED'.
- The leave moves to the 'Approved Leaves' tab/history.
- Affected timetable slots are automatically converted into pending substitution requirements.

#### What Tester Must Verify
- [ ] Verify teacher's Android app updates leave status to 'APPROVED'.
- [ ] Verify pending substitutions appear in the Substitution dashboard.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-LEV-002 — Reject Leave Request with Mandatory Reason

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-LEV-002` |
| **Platform** | **Web Application** |
| **Module** | **Leave Management** |
| **Feature** | **Reject Leave Request with Mandatory Reason** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- A pending leave request exists

#### Test Data
- **Rejection Reason**: Critical accreditation audit on requested date

#### Exact Manual Steps
1. Open Leave Drawer for a pending request.
2. Click 'Reject Leave'.
3. Observe prompt requiring a mandatory rejection reason.
4. Attempt to submit with empty reason (verify blocked).
5. Enter 'Critical accreditation audit on requested date'.
6. Click 'Confirm Rejection'.

#### Expected Result
- Leave status updates to 'REJECTED'.
- Rejection reason is stored and displayed on the record.
- No substitutions are generated.

#### What Tester Must Verify
- [ ] Verify teacher receives notification stating leave was rejected with the provided reason.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-LEV-003 — Admin Manual Leave Entry

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-LEV-003` |
| **Platform** | **Web Application** |
| **Module** | **Leave Management** |
| **Feature** | **Admin Manual Leave Entry** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Teacher called in sick or unable to use mobile app

#### Test Data
- **Target URL**: /admin/leave-entry

#### Exact Manual Steps
1. Navigate to '/admin/leave-entry'.
2. Select Teacher from dropdown: 'Dr. Sarah Jenkins'.
3. Select Leave Type: 'Medical Leave'.
4. Select Start Date and End Date.
5. Enter Admin Notes: 'Verbal request via telephone'.
6. Click 'Create & Approve Leave'.

#### Expected Result
- Leave is created and immediately approved by admin authority.
- Substitutions are automatically queued for the teacher's periods today.

#### What Tester Must Verify
- [ ] Verify audit log records that leave was created on behalf of teacher by admin.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 23. Web Substitution
### Test Case: WEB-SUB-001 — Smart Candidate Recommendations & Workload Scoring

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-SUB-001` |
| **Platform** | **Web Application** |
| **Module** | **Substitution** |
| **Feature** | **Smart Candidate Recommendations & Workload Scoring** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Approved leave generated substitution slots for today

#### Test Data
- **Target URL**: /admin/today-substitutions

#### Exact Manual Steps
1. Navigate to '/admin/today-substitutions'.
2. Locate an uncovered substitution requirement (e.g. Period 2, Class CSE Year 1, Subject Data Structures).
3. Click 'Assign Substitute'.
4. Inspect the Candidate Teachers recommendation list modal.
5. Observe the ranking of available teachers based on: Availability (Free in Period 2), Department affinity, Current workload, and Credit balance.

#### Expected Result
- The recommendation engine ranks candidate teachers intelligently.
- Teachers who already have a scheduled class in Period 2 are either excluded or flagged with 'BUSY' / 'CLASH'.
- Each candidate card displays teacher name, available periods today, and credit balance.

#### What Tester Must Verify
- [ ] Verify selecting a candidate shows their current daily timetable.
- [ ] Verify candidate with lowest workload / highest availability is recommended first.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-SUB-002 — Manual Substitute Assignment & Notification Dispatch

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-SUB-002` |
| **Platform** | **Web Application** |
| **Module** | **Substitution** |
| **Feature** | **Manual Substitute Assignment & Notification Dispatch** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Candidate recommendation modal open

#### Test Data
- **Selected Substitute**: Teacher CSE 2

#### Exact Manual Steps
1. Select 'Teacher CSE 2' from the candidate list.
2. Click 'Confirm Assignment'.
3. Observe modal close and table update.

#### Expected Result
- The substitution requirement status changes from 'UNASSIGNED' to 'ASSIGNED'.
- The assigned substitute teacher's name appears on the slot card.
- An instant notification is dispatched to Teacher CSE 2's Android device.

#### What Tester Must Verify
- [ ] Verify Teacher CSE 2 sees the substitution card in their Android app.
- [ ] Verify slot is marked covered on the daily institutional coverage dashboard.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-SUB-003 — Auto-Assign All Substitutions Workflow

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-SUB-003` |
| **Platform** | **Web Application** |
| **Module** | **Substitution** |
| **Feature** | **Auto-Assign All Substitutions Workflow** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Multiple unassigned substitution requirements exist for the day

#### Test Data
- **Action**: Click 'Auto-Assign All'

#### Exact Manual Steps
1. On '/admin/today-substitutions', locate the 'Auto-Assign All' button.
2. Click 'Auto-Assign All'.
3. Review the proposed assignment matrix summary in the confirmation dialog.
4. Click 'Confirm Bulk Assignment'.

#### Expected Result
- The automated matching algorithm assigns the best available substitute for every slot.
- No substitute receives two simultaneous classes in the same period.
- All substitution cards update to 'ASSIGNED'.

#### What Tester Must Verify
- [ ] Verify all assigned teachers receive respective notifications.
- [ ] Verify zero schedule collisions across the entire department.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 24. Web Attendance
### Test Case: WEB-ATT-001 — Live Staff Attendance Grid & Live Polling

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-ATT-001` |
| **Platform** | **Web Application** |
| **Module** | **Attendance** |
| **Feature** | **Live Staff Attendance Grid & Live Polling** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Active teaching day with faculty checking in via Android app

#### Test Data
- **Target URL**: /admin/attendance

#### Exact Manual Steps
1. Navigate to '/admin/attendance'.
2. Inspect the top summary metrics cards: Total Staff, Checked In, Checked Out, Not Reported, and On Leave.
3. Inspect the live faculty attendance table: Faculty Name, Department, Check-In Time, Check-Out Time, Location Geofence Zone, and Status badge.
4. Toggle 'Auto-Refresh' to ON (30s interval).
5. Observe live table updates when a teacher checks in on mobile.

#### Expected Result
- Table displays all faculty attendance records accurately in real time.
- Checked-in teachers display a green 'Checked In' badge with exact timestamp.
- Auto-refresh polls backend without disrupting current scroll or filter state.

#### What Tester Must Verify
- [ ] Verify status counters increment immediately upon new check-in.
- [ ] Verify teachers on approved leave display 'On Leave' (Amber) badge.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-ATT-002 — Filter Attendance by Department & Status

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-ATT-002` |
| **Platform** | **Web Application** |
| **Module** | **Attendance** |
| **Feature** | **Filter Attendance by Department & Status** |
| **Target Role** | **System Admin** |

#### Preconditions
- Multiple departments with mixed attendance states

#### Test Data
- **Filter Department**: CSE
- **Filter Status**: Not Reported

#### Exact Manual Steps
1. On '/admin/attendance', select Department filter: 'Computer Science & Engineering'.
2. Select Status filter: 'Not Reported'.
3. Observe table filtering.

#### Expected Result
- Table filters down to show only CSE teachers who have not yet checked in today.
- Summary counters update to reflect the filtered subset.

#### What Tester Must Verify
- [ ] Verify 'Clear Filters' button restores complete campus-wide list.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 25. Web Biometrics
### Test Case: WEB-BIO-001 — Biometric Registry & Face Profile Management

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-BIO-001` |
| **Platform** | **Web Application** |
| **Module** | **Biometrics** |
| **Feature** | **Biometric Registry & Face Profile Management** |
| **Target Role** | **System Admin** |

#### Preconditions
- Logged in as System Admin (SystemAdminRoute only)

#### Test Data
- **Target URL**: /admin/biometrics

#### Exact Manual Steps
1. Navigate to '/admin/biometrics'.
2. Inspect the biometric registry table: Faculty Name, Department, Enrollment Status (Enrolled / Pending), Enrolled Date/Time, and Actions.
3. Use search bar to search for 'Prof. Kamesh Govindhan'.
4. Verify enrollment status shows 'Enrolled' with green badge.

#### Expected Result
- Biometrics table lists all faculty members with accurate enrollment flags.
- Search filters faculty by name or email instantly.

#### What Tester Must Verify
- [ ] Verify Non-System Admin roles cannot access this screen (blocked by SystemAdminRoute).

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-BIO-002 — Admin Biometric Reset Action

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-BIO-002` |
| **Platform** | **Web Application** |
| **Module** | **Biometrics** |
| **Feature** | **Admin Biometric Reset Action** |
| **Target Role** | **System Admin** |

#### Preconditions
- Faculty member had facial injury or smartphone camera calibration issue needing re-enrollment

#### Test Data
- **Target Faculty**: Prof. Kamesh Govindhan

#### Exact Manual Steps
1. On '/admin/biometrics', locate 'Prof. Kamesh Govindhan'.
2. Click the 'Reset Biometrics' action button.
3. Observe warning modal: 'Are you sure you want to reset biometrics for Prof. Kamesh Govindhan? The user will be required to re-enroll face biometrics before checking in'.
4. Click 'Confirm Reset'.

#### Expected Result
- Backend clears face embeddings and sets has_face_enrolled = False.
- Status badge in table updates immediately to 'Pending' (Gray/Amber).
- Success toast confirms biometric profile reset.

#### What Tester Must Verify
- [ ] Verify teacher's Android app now prompts for Face Enrollment before allowing check-in.
- [ ] Verify security audit log registers the biometric reset action.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 26. Web Announcements
### Test Case: WEB-ANN-001 — Create and Publish Circular with PDF Attachment

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-ANN-001` |
| **Platform** | **Web Application** |
| **Module** | **Announcements** |
| **Feature** | **Create and Publish Circular with PDF Attachment** |
| **Target Role** | **Admin / Principal** |

#### Preconditions
- Logged in as Principal or Admin

#### Test Data
- **Title**: End Semester Exam Schedule Nov 2026
- **Audience**: All Faculty
- **Attachment**: exam_schedule_2026.pdf

#### Exact Manual Steps
1. Navigate to '/announcements'.
2. Click 'Create Announcement' button.
3. Enter Title: 'End Semester Exam Schedule Nov 2026'.
4. Select Target Audience: 'All Faculty' (or specific department).
5. Enter Announcement Body in the rich text editor.
6. Click 'Upload Attachment' and select a test PDF document.
7. Toggle 'Pin Announcement to Top' if urgent.
8. Click 'Publish Announcement'.

#### Expected Result
- Announcement publishes successfully and appears at the top of the feed.
- Attachment is uploaded and linked with downloadable icon.
- Push notifications are queued and sent to mobile devices.

#### What Tester Must Verify
- [ ] Verify announcement card displays author name, role, and publication time.
- [ ] Verify clicking the attachment opens or downloads the PDF without error.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-ANN-002 — Announcement Analytics Modal

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-ANN-002` |
| **Platform** | **Web Application** |
| **Module** | **Announcements** |
| **Feature** | **Announcement Analytics Modal** |
| **Target Role** | **Admin / Principal** |

#### Preconditions
- Published announcement exists with mobile users having viewed it

#### Test Data
- **Target Announcement**: Recent circular

#### Exact Manual Steps
1. On '/announcements', locate the published circular.
2. Click 'View Analytics' / 'Read Receipts' button on the card.
3. Observe the modal displaying readership statistics.

#### Expected Result
- Modal displays: Total Target Recipients, Total Views / Read Count, and List of faculty members who have viewed the circular with timestamps.

#### What Tester Must Verify
- [ ] Verify view count increments when a teacher opens the announcement on Android.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 27. Web Notifications
### Test Case: WEB-NOT-001 — Web In-App Notification Bell & Browser Push Prompt

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-NOT-001` |
| **Platform** | **Web Application** |
| **Module** | **Notifications** |
| **Feature** | **Web In-App Notification Bell & Browser Push Prompt** |
| **Target Role** | **Any** |

#### Preconditions
- User logged in on web

#### Test Data
- **Target Feature**: TopBar Notification Bell

#### Exact Manual Steps
1. Inspect the Notification Bell on the TopBar.
2. Verify unread notification count badge.
3. Click the Notification Bell to open the dropdown flyout.
4. Review notification items (Leave submissions, system alerts).
5. Check if browser push notification prompt ('Allow FAFLOW to send notifications') appears if not previously answered.
6. Click 'Allow'.

#### Expected Result
- Flyout lists recent notifications cleanly.
- Browser push subscription registers successfully with backend VAPID keys.
- Clicking 'Mark All as Read' clears the badge count.

#### What Tester Must Verify
- [ ] Verify clicking a notification navigates to the relevant record.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 28. Web Backup
### Test Case: WEB-BAK-001 — Create Instant Database Snapshot & Download Backup

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-BAK-001` |
| **Platform** | **Web Application** |
| **Module** | **Backup** |
| **Feature** | **Create Instant Database Snapshot & Download Backup** |
| **Target Role** | **System Admin** |

#### Preconditions
- Logged in as System Admin (SystemAdminRoute only)

#### Test Data
- **Target URL**: /admin/backup

#### Exact Manual Steps
1. Navigate to '/admin/backup'.
2. Review existing backups list: Backup Name, Date/Time, File Size, and Status.
3. Click 'Create Backup' / 'Generate Snapshot'.
4. Wait for backup generation progress indicator to finish.
5. Locate the newly generated backup in the table.
6. Click the 'Download' icon.

#### Expected Result
- Backup generates cleanly without database locks or server hang.
- Backup file (.json or .sql) downloads to the local browser.
- File size is greater than 0 KB and contains valid JSON/SQL schema.

#### What Tester Must Verify
- [ ] Verify non-system admins cannot access '/admin/backup' (redirected or 403 Forbidden).

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 29. Web Data Retention
### Test Case: WEB-RET-001 — Review Retention Policies & Preview Data Purge

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-RET-001` |
| **Platform** | **Web Application** |
| **Module** | **Data Retention** |
| **Feature** | **Review Retention Policies & Preview Data Purge** |
| **Target Role** | **System Admin** |

#### Preconditions
- Logged in as System Admin

#### Test Data
- **Target URL**: /admin/data-retention

#### Exact Manual Steps
1. Navigate to '/admin/data-retention'.
2. Review configured retention policies: Audit Logs (retain 365 days), Old Staff Attendance (retain 730 days), Expired Notifications (retain 90 days).
3. Click 'Preview Purge' for Expired Notifications.
4. Inspect the preview summary modal showing total candidate records eligible for purging.

#### Expected Result
- Preview calculates eligible records accurately based on age thresholds.
- Active, current academic year records are strictly marked as 'PROTECTED' and excluded from purge.

#### What Tester Must Verify
- [ ] Verify actual purge execution requires explicit typing of confirmation text (e.g. 'CONFIRM_PURGE').
- [ ] Verify audit log records any executed purge operation.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 30. Web Reports
### Test Case: WEB-REP-001 — Real-Time System Metrics & Traffic Dashboard

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-REP-001` |
| **Platform** | **Web Application** |
| **Module** | **Reports** |
| **Feature** | **Real-Time System Metrics & Traffic Dashboard** |
| **Target Role** | **System Admin** |

#### Preconditions
- Logged in as System Admin

#### Test Data
- **Target URL**: /admin/system-metrics

#### Exact Manual Steps
1. Navigate to '/admin/system-metrics'.
2. Inspect real-time HTTP traffic charts: Requests/minute, API latency (p50, p95, p99), HTTP 2xx/4xx/5xx status distribution.
3. Inspect SlowAPI rate-limiting statistics.
4. Inspect database connection pool health.

#### Expected Result
- Charts render with live traffic data.
- Latency and error rates are clearly visualized.
- Rate-limited endpoints are highlighted if thresholds are approached.

#### What Tester Must Verify
- [ ] Verify system metrics endpoint responds within < 200ms.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: WEB-REP-002 — Faculty Credits Ledger PDF Export

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `WEB-REP-002` |
| **Platform** | **Web Application** |
| **Module** | **Reports** |
| **Feature** | **Faculty Credits Ledger PDF Export** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Credits transactions exist across department faculty

#### Test Data
- **Target URL**: /admin/credits

#### Exact Manual Steps
1. Navigate to '/admin/credits'.
2. Review the faculty credits balance table.
3. Click the 'Export Report' or 'Download PDF' button on the ExportBar.
4. Open the downloaded PDF report.

#### Expected Result
- PDF generates with official college header, department name, generation timestamp, and formatted ledger table.
- Totals and credit balances match web table values exactly.

#### What Tester Must Verify
- [ ] Verify formatting is clean for printing / official auditing.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---


## 31. Role-Based Access Testing (RBAC)
### Test Case: RBAC-001 — System Admin Unrestricted Authority

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `RBAC-001` |
| **Platform** | **Cross-Platform** |
| **Module** | **Access Control** |
| **Feature** | **System Admin Unrestricted Authority** |
| **Target Role** | **System Admin** |

#### Preconditions
- Logged in as System Admin

#### Test Data
- **Target Scope**: System-wide / All Modules

#### Exact Manual Steps
1. Log in as System Admin.
2. Verify sidebar displays all administrative modules (Departments, Managers, Geofences, Biometrics, Backup, Retention, Metrics).
3. Open '/admin/departments' and verify ability to add/edit departments across the entire institution.
4. Open '/admin/geofences' and verify ability to add/edit campus geofences.
5. Open '/admin/backup' and verify backup creation access.
6. Open '/admin/system-metrics' and verify access to real-time traffic statistics.

#### Expected Result
- System Admin has complete access to every module without restriction.
- No 403 Forbidden errors occur on any administrative endpoint.

#### What Tester Must Verify
- [ ] Verify all CRUD capabilities are fully functional.
- [ ] Verify audit logs attribute actions to System Admin.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: RBAC-002 — HOD (Department Admin) Department Boundary Isolation

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `RBAC-002` |
| **Platform** | **Web Application** |
| **Module** | **Access Control** |
| **Feature** | **HOD (Department Admin) Department Boundary Isolation** |
| **Target Role** | **Admin / HOD** |

#### Preconditions
- Logged in as HOD of Computer Science & Engineering (department_id = CSE)

#### Test Data
- **Target URL**: /admin/teachers, /admin/timetable, /admin/leaves

#### Exact Manual Steps
1. Log in as HOD CSE.
2. Navigate to '/admin/teachers' and inspect the teachers list.
3. Verify ONLY teachers belonging to the CSE department are visible/editable.
4. Navigate to '/admin/leaves' and verify ONLY CSE faculty leave requests appear.
5. Navigate to '/admin/timetable' and verify timetable slots can only be edited for CSE department classes.
6. Attempt to tamper with API query parameters to fetch Mech or EEE teachers (e.g. GET /teachers?department_id=MECH).

#### Expected Result
- HOD is strictly confined to their assigned department.
- Data from other departments (EEE, Mech, Civil) is filtered out or blocked with 403 Forbidden.
- Direct API tampering is rejected by the backend DepartmentContext / RBAC dependencies.

#### What Tester Must Verify
- [ ] Verify HOD cannot approve leave requests for teachers of other departments.
- [ ] Verify HOD cannot assign substitute teachers outside their permitted pool.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: RBAC-003 — Principal Read-Only Oversight Boundary

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `RBAC-003` |
| **Platform** | **Web Application** |
| **Module** | **Access Control** |
| **Feature** | **Principal Read-Only Oversight Boundary** |
| **Target Role** | **Principal** |

#### Preconditions
- Logged in as Principal (Role.principal)

#### Test Data
- **Target URLs**: /principal/dashboard, /principal/attendance, /admin/departments

#### Exact Manual Steps
1. Log in as Principal.
2. Verify Principal navigation renders: Dashboard, Announcements, Student Attendance, Faculty Attendance, Campus Duties, Campus Structure, Classwise Timetable.
3. Verify access to institution-wide attendance across all departments.
4. Attempt to navigate directly to System Admin destructive routes (e.g. '/admin/backup', '/admin/data-retention', '/admin/geofences').

#### Expected Result
- Principal has comprehensive institution-wide read-only visibility.
- Navigating to restricted routes ('/admin/backup', '/admin/geofences') is blocked by PrincipalRoute guard and redirects to '/principal/dashboard' or displays Access Denied.
- Backend rejects direct API requests with HTTP 403 Forbidden.

#### What Tester Must Verify
- [ ] Verify Principal cannot create, edit, or delete department entities.
- [ ] Verify Principal cannot wipe database or execute data retention purges.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: RBAC-004 — Teacher Role Restrictions & Privilege Escalation Prevention

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `RBAC-004` |
| **Platform** | **Cross-Platform** |
| **Module** | **Access Control** |
| **Feature** | **Teacher Role Restrictions & Privilege Escalation Prevention** |
| **Target Role** | **Teacher** |

#### Preconditions
- Logged in as Teacher

#### Test Data
- **Restricted Targets**: /admin/*, /governance/*, /manager/*

#### Exact Manual Steps
1. Log in as Teacher on the web portal.
2. Verify sidebar strictly shows Teacher navigation items only.
3. Type '/admin/dashboard' into the browser URL address bar and press Enter.
4. Type '/admin/leaves' into the URL bar and press Enter.
5. Type '/governance' into the URL bar and press Enter.
6. Attempt to send a curl / Postman request with Teacher JWT token to an admin endpoint (e.g. POST /departments).

#### Expected Result
- Frontend route guards (AdminRoute, GovernanceRoute) intercept the direct URL attempts and immediately bounce the user back to '/teacher/dashboard' or '/login'.
- Backend API returns HTTP 403 Forbidden ('Not authorized: insufficient role permissions').

#### What Tester Must Verify
- [ ] Verify teachers cannot access admin panels or approve their own leaves.
- [ ] Verify teachers cannot modify another teacher's timetable or credits.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: RBAC-005 — Dean Role Discrepancy Verification (DOCUMENTED_BUT_NOT_FOUND)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `RBAC-005` |
| **Platform** | **Web Application** |
| **Module** | **Access Control** |
| **Feature** | **Dean Role Discrepancy Verification (DOCUMENTED_BUT_NOT_FOUND)** |
| **Target Role** | **Any** |

#### Preconditions
- User accounts directory

#### Test Data
- **Discrepancy Status**: DOCUMENTED_BUT_NOT_FOUND

#### Exact Manual Steps
1. Inspect documentation claims regarding a standalone 'Dean' role.
2. Open the database schema and review `enum user_role` in PostgreSQL (`app/models/user.py`).
3. Attempt to register or create a user with role='dean' via API or admin interface.
4. Observe the system validation.

#### Expected Result
- **DOCUMENTED_BUT_NOT_FOUND**: The database ENUM does not contain 'dean'.
- Supplying role='dean' is rejected by Pydantic / SQLAlchemy with validation error (Value not in permitted ENUM values).
- Institutional oversight duties designated for a Dean are officially handled by `Role.governance` or `Role.principal`.

#### What Tester Must Verify
- [ ] Confirm that Dean oversight is exercised via Governance Command Center or Principal accounts.
- [ ] Document this discrepancy in QA release audit report.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: RBAC-006 — Manager & Operational Staff Boundary

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `RBAC-006` |
| **Platform** | **Web Application** |
| **Module** | **Access Control** |
| **Feature** | **Manager & Operational Staff Boundary** |
| **Target Role** | **Manager / Staff** |

#### Preconditions
- Manager and Lab Staff accounts provisioned

#### Test Data
- **Roles**: Role.manager, Role.lab_staff, Role.non_teaching_staff

#### Exact Manual Steps
1. Log in as Manager.
2. Verify Manager navigation: Laboratory Staff, Non-Teaching Staff, Staff Leaves & Ledger, Staff Directory.
3. Log out and log in as Lab Staff.
4. Verify Staff navigation: Lab & Duty Workspace, My Leaves & Ledger.
5. Attempt to access academic timetable from staff account.

#### Expected Result
- Manager manages only operational/non-teaching staff without access to academic timetables.
- Staff portal is dedicated to laboratory and duty operations.
- Academic timetable routes are blocked for non-teaching staff.

#### What Tester Must Verify
- [ ] Verify clean separation between academic faculty workflows and laboratory staff workflows.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 32. Cross-Platform End-to-End Workflows
### Test Case: XPLAT-001 — Complete Leave to Substitution to Credits Lifecycle

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `XPLAT-001` |
| **Platform** | **Cross-Platform** |
| **Module** | **E2E Workflow** |
| **Feature** | **Complete Leave to Substitution to Credits Lifecycle** |
| **Target Role** | **Teacher & HOD** |

#### Preconditions
- Teacher 1 (Kamesh) has active account on Android
- HOD CSE has active account on Web
- Teacher 2 (Substitute) has active account on Android
- Today is a working Day Order with scheduled classes for Teacher 1

#### Test Data
- **Workflow**: Leave Application -> HOD Approval -> Substitution Assignment -> Mobile Acceptance -> Credit Increment

#### Exact Manual Steps
1. **Step 1 (Teacher 1 on Android)**: Open FAFLOW Android app as Teacher 1 (Prof. Kamesh). Apply for Casual Leave for today with reason 'Personal emergency'. Submit leave.
2. **Step 2 (HOD on Web)**: Log in to Web portal as HOD CSE. Open '/admin/leaves'. Locate Teacher 1's pending leave request. Click 'View Details' and 'Approve Leave'.
3. **Step 3 (HOD on Web)**: Navigate to '/admin/today-substitutions'. Observe that Teacher 1's scheduled periods for today are now listed as unassigned substitution requirements. Click 'Assign Substitute' for Period 2. Select 'Teacher 2' from the recommended candidates and confirm assignment.
4. **Step 4 (Teacher 2 on Android)**: Open FAFLOW Android app on Teacher 2's device. Observe push notification: 'New Substitution Assigned: Period 2, Class CSE Year 1, Subject Data Structures'. Tap notification to open Substitution screen. Tap 'Accept Substitution'.
5. **Step 5 (Teacher 2 on Android)**: After Period 2 completes, open Credits screen on Teacher 2's device.
6. **Step 6 (HOD on Web)**: Open '/admin/credits' and verify Teacher 2's credit balance ledger.

#### Expected Result
- The leave request transitions smoothly from PENDING to APPROVED on both Android and Web.
- Substitutions are automatically spawned upon leave approval.
- Teacher 2 receives real-time notification and accepts the workload.
- Teacher 2's credit ledger increments by +1.0 Credit with description referencing the covered period.
- All states are synchronized consistently across Android and Web without data race or loss.

#### What Tester Must Verify
- [ ] Verify Teacher 1's dashboard indicates 'On Leave' for today.
- [ ] Verify Teacher 2's timetable includes the covered Period 2.
- [ ] Verify Teacher 2's net credit balance updates on both mobile and web.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: XPLAT-002 — Circular Broadcast (Web) to Mobile Push & Attachment Download

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `XPLAT-002` |
| **Platform** | **Cross-Platform** |
| **Module** | **E2E Workflow** |
| **Feature** | **Circular Broadcast (Web) to Mobile Push & Attachment Download** |
| **Target Role** | **Principal & Teacher** |

#### Preconditions
- Principal logged in on Web
- Teacher logged in on Android device with notifications enabled

#### Test Data
- **Workflow**: Web Circular Broadcast -> Android Push Delivery -> Mobile Read Receipt

#### Exact Manual Steps
1. **Step 1 (Principal on Web)**: Log in to Web portal as Principal. Open '/announcements'. Click 'Create Announcement'.
2. **Step 2 (Principal on Web)**: Enter Title: 'Urgent: NAAC Accreditation Review Tomorrow'. Select Audience: 'All Faculty'. Attach an official PDF document ('naac_schedule.pdf'). Click 'Publish Announcement'.
3. **Step 3 (Teacher on Android)**: Observe Android device status bar. Confirm receipt of high-priority system push notification: 'New Circular: Urgent: NAAC Accreditation Review Tomorrow'.
4. **Step 4 (Teacher on Android)**: Tap the push notification. Observe that FAFLOW opens directly into the Announcement Detail screen.
5. **Step 5 (Teacher on Android)**: Read the circular and tap the attachment icon to download and view 'naac_schedule.pdf'.
6. **Step 6 (Principal on Web)**: On Web '/announcements', open 'Read Receipts' for the circular. Verify that Teacher's name appears in the read list with current timestamp.

#### Expected Result
- Push notification arrives on Android within seconds of publishing on Web.
- Tapping notification deep-links directly to the exact circular.
- Attachment downloads and opens without corruption.
- Web analytics updates to reflect that Teacher has read the announcement.

#### What Tester Must Verify
- [ ] Verify notification count badge updates on mobile TopBar.
- [ ] Verify circular appears in mobile Announcements feed.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: XPLAT-003 — Facial Geofenced Check-In (Android) to Live Attendance Dashboard (Web)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `XPLAT-003` |
| **Platform** | **Cross-Platform** |
| **Module** | **E2E Workflow** |
| **Feature** | **Facial Geofenced Check-In (Android) to Live Attendance Dashboard (Web)** |
| **Target Role** | **Teacher & Admin** |

#### Preconditions
- Teacher with enrolled face on Android
- Admin observing '/admin/attendance' on Web

#### Test Data
- **Workflow**: Mobile Check-In -> Web Live Grid Update -> Mobile Check-Out -> Web Status Refresh

#### Exact Manual Steps
1. **Step 1 (Admin on Web)**: Log in as Admin. Open '/admin/attendance'. Observe that Teacher (Prof. Kamesh) is currently listed as 'Not Reported'.
2. **Step 2 (Teacher on Android)**: Open FAFLOW Attendance screen on device while inside campus geofence. Tap 'Start Check-In'.
3. **Step 3 (Teacher on Android)**: Pass liveness challenge (tilt head / blink) and complete biometric match. Observe Check-In confirmation dialog showing time (e.g. 08:55 AM).
4. **Step 4 (Admin on Web)**: Observe the Live Attendance table (with Auto-Refresh enabled). Within 30 seconds, observe Teacher's row update to 'Checked In' with Check-In Time '08:55 AM' and Location Zone 'Main Campus'.
5. **Step 5 (Teacher on Android)**: At end of day, tap 'Start Check-Out' on Android. Confirm check-out at 04:30 PM.
6. **Step 6 (Admin on Web)**: Refresh web attendance table. Verify status updates to 'Checked Out' showing both Check-In (08:55 AM) and Check-Out (04:30 PM) times.

#### Expected Result
- Mobile check-in is instantly registered in PostgreSQL database.
- Web attendance dashboard reflects live check-in and check-out times without manual database intervention.
- Status counters (Checked In, Checked Out) increment accurately.

#### What Tester Must Verify
- [ ] Verify exact minute precision matches between mobile dialog and web table.
- [ ] Verify location geofence tag appears correctly on web.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: XPLAT-004 — Timetable Reallocation (Web) to Dynamic Mobile Schedule Sync

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `XPLAT-004` |
| **Platform** | **Cross-Platform** |
| **Module** | **E2E Workflow** |
| **Feature** | **Timetable Reallocation (Web) to Dynamic Mobile Schedule Sync** |
| **Target Role** | **Admin & Teacher** |

#### Preconditions
- Admin logged in on Web
- Teacher logged in on Android

#### Test Data
- **Workflow**: Web Timetable Edit -> Mobile Dynamic Update

#### Exact Manual Steps
1. **Step 1 (Teacher on Android)**: Open Timetable screen for Day 1. Observe Period 3 is currently 'Free Period'.
2. **Step 2 (Admin on Web)**: Log in as HOD/Admin on Web. Open '/admin/timetable'. For Day 1, Period 3, assign Teacher to class 'CSE Year 2 - Sec A' for subject 'Operating Systems' in 'Room 204'. Save slot.
3. **Step 3 (Teacher on Android)**: Return to Android app. Pull down to refresh the Dashboard or switch Day Order tabs to Day 1.
4. **Step 4 (Teacher on Android)**: Inspect Day 1, Period 3.

#### Expected Result
- Mobile schedule updates dynamically without requiring app re-installation or cache clearing.
- Day 1, Period 3 now displays: 'Operating Systems (CSE-SUB-2)', 'CSE Year 2 - Sec A', 'Room 204'.
- The slot is included in today's upcoming schedule on the Dashboard.

#### What Tester Must Verify
- [ ] Verify Room 204 and Class details match web assignment exactly.
- [ ] Verify offline cache updates with the newly allocated slot.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: XPLAT-005 — Approved Leave Cancellation & Automated Substitution Rollback

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `XPLAT-005` |
| **Platform** | **Cross-Platform** |
| **Module** | **E2E Workflow** |
| **Feature** | **Approved Leave Cancellation & Automated Substitution Rollback** |
| **Target Role** | **Teacher & HOD** |

#### Preconditions
- Teacher has an approved leave with assigned substitute for tomorrow

#### Test Data
- **Workflow**: Teacher Cancels Approved Leave -> Substitution Rollback -> Notification

#### Exact Manual Steps
1. **Step 1 (Teacher on Android)**: Open Leave History. Locate the approved leave for tomorrow. Tap 'Cancel Leave' (if policy allows pre-commencement cancellation).
2. **Step 2 (Web & Backend)**: Backend processes cancellation. Status changes to 'CANCELLED'.
3. **Step 3 (HOD on Web)**: Open '/admin/today-substitutions' (or tomorrow's date).
4. **Step 4 (Substitute on Android)**: Check Substitute Teacher's Android app.

#### Expected Result
- Cancelling the leave automatically revokes or cancels the generated substitution requirement.
- The substitute teacher is notified: 'Substitution for Period [X] cancelled as primary faculty cancelled leave'.
- The substitute's timetable frees up the cancelled period.

#### What Tester Must Verify
- [ ] Verify substitute teacher does not retain phantom workload.
- [ ] Verify no unearned credits are awarded.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 33. UI / UX Visual & Accessibility Audit
### Test Case: UIX-001 — Responsive Viewport Breakpoints Audit

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `UIX-001` |
| **Platform** | **Web Application** |
| **Module** | **UI/UX Audit** |
| **Feature** | **Responsive Viewport Breakpoints Audit** |
| **Target Role** | **Any** |

#### Preconditions
- Chrome DevTools Device Mode open

#### Test Data
- **Breakpoints**: 1920x1080 (Desktop), 1366x768 (Laptop), 1024x768 (iPad Landscape), 768x1024 (iPad Portrait), 375x667 (Mobile)

#### Exact Manual Steps
1. Open web app in Chrome DevTools Device Mode.
2. Test resolution 1920x1080: Verify sidebar is expanded and content utilizes screen space cleanly.
3. Test resolution 1366x768: Verify no horizontal overflow or scrollbar on body.
4. Test resolution 768x1024: Verify sidebar collapses into a slide-over mobile drawer or hamburger icon.
5. Test resolution 375x667: Verify tables collapse into responsive cards or provide smooth horizontal scroll.
6. Verify all modals and dialogs fit entirely within the viewport without clipping action buttons.

#### Expected Result
- Layout adapts smoothly across all standard desktop, laptop, tablet, and smartphone resolutions.
- No element clips off-screen or causes horizontal body overflow.
- Modal buttons ('Cancel', 'Confirm') are always visible and accessible.

#### What Tester Must Verify
- [ ] Verify mobile hamburger menu opens and closes smoothly.
- [ ] Verify TopBar icons (Notifications, Profile) remain accessible on mobile.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: UIX-002 — Color Contrast & Accessibility (WCAG 2.1 AA Standards)

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `UIX-002` |
| **Platform** | **Cross-Platform** |
| **Module** | **UI/UX Audit** |
| **Feature** | **Color Contrast & Accessibility (WCAG 2.1 AA Standards)** |
| **Target Role** | **Any** |

#### Preconditions
- Accessibility contrast evaluation tool active (e.g. Chrome Lighthouse or axe DevTools)

#### Test Data
- **Standard**: WCAG 2.1 AA (Contrast ratio >= 4.5:1 for normal text, >= 3:1 for large text)

#### Exact Manual Steps
1. Inspect primary buttons ('Sign In', 'Submit', 'Check-In', 'Approve'): check text color against button background.
2. Inspect secondary badges (Status: Pending, Approved, Rejected, Cancelled): check badge text contrast against badge pill color.
3. Inspect form input placeholders and helper text.
4. Inspect dark mode surfaces.

#### Expected Result
- All text elements meet or exceed WCAG AA contrast standards.
- No low-contrast light gray text on white background exists.
- Status badges (Green, Red, Amber, Gray) are distinctly distinguishable.

#### What Tester Must Verify
- [ ] Verify color is not used as the sole indicator of state (icons and text accompany color cues).

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: UIX-003 — Touch Target & Interactive Micro-Interactions

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `UIX-003` |
| **Platform** | **Cross-Platform** |
| **Module** | **UI/UX Audit** |
| **Feature** | **Touch Target & Interactive Micro-Interactions** |
| **Target Role** | **Any** |

#### Preconditions
- Android physical device and Web interface

#### Test Data
- **Standard**: Minimum touch target size 48x48 dp

#### Exact Manual Steps
1. On Android: Tap every bottom navigation icon, every shortcut chip, and every list item action button.
2. Verify that touch feedback (Material ripple or elevation change) occurs instantly on tap.
3. Verify that tightly clustered buttons (e.g. Edit and Delete table icons) have sufficient spacing to prevent mis-clicks.

#### Expected Result
- All clickable elements have minimum 48x48 dp touch target bounds.
- Instant visual feedback confirms touch registration without delay.
- Zero accidental mis-clicks on adjacent icons.

#### What Tester Must Verify
- [ ] Verify disabled buttons have clear disabled styling (opacity reduced, cursor not-allowed).

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 34. Negative & Stress Testing
### Test Case: NEG-001 — Rapid Multi-Click / Double-Submission on Forms

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `NEG-001` |
| **Platform** | **Cross-Platform** |
| **Module** | **Negative Testing** |
| **Feature** | **Rapid Multi-Click / Double-Submission on Forms** |
| **Target Role** | **Teacher / Admin** |

#### Preconditions
- On Apply Leave screen, Attendance Check-In, or Master Data forms

#### Test Data
- **Action**: Rapidly click submit button 5 times within 1 second

#### Exact Manual Steps
1. Fill out the 'Apply Leave' form with valid data.
2. Quickly click/tap the 'Submit Leave Request' button 5 times in rapid succession.
3. Observe network calls and backend database records.
4. Repeat rapid tapping on 'Start Check-In' button during attendance verification.

#### Expected Result
- The button immediately disables and shows a spinner upon the very first click, preventing subsequent triggers.
- Backend idempotency checks prevent creating duplicate leave requests or duplicate attendance rows.
- Exactly ONE record is created in the database.

#### What Tester Must Verify
- [ ] Verify no 500 Internal Server Error occurs due to race conditions.
- [ ] Verify client remains stable and does not lock up.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: NEG-002 — Browser Refresh & Back Button during Multistep Modals

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `NEG-002` |
| **Platform** | **Web Application** |
| **Module** | **Negative Testing** |
| **Feature** | **Browser Refresh & Back Button during Multistep Modals** |
| **Target Role** | **Admin** |

#### Preconditions
- Midway through bulk class creation or timetable editing

#### Test Data
- **Action**: Press F5 (Refresh) or Browser Back

#### Exact Manual Steps
1. Open the 'Bulk Class Creation' modal on Web.
2. Fill out prefix and select sections.
3. Press the browser 'Back' button.
4. Re-open the modal, fill it out again, and press 'F5' (Reload).
5. Observe application state.

#### Expected Result
- The app handles browser navigation gracefully.
- Pressing Back dismisses the modal or returns to previous screen without crashing the React virtual DOM.
- Refreshing reloads the page cleanly in a valid initial state without partial corrupted data submission.

#### What Tester Must Verify
- [ ] Verify no zombie uncommitted records are left in the database.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: NEG-003 — Input Fuzzing: Special Characters, SQL Injection & XSS Payloads

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `NEG-003` |
| **Platform** | **Cross-Platform** |
| **Module** | **Negative Testing** |
| **Feature** | **Input Fuzzing: Special Characters, SQL Injection & XSS Payloads** |
| **Target Role** | **Any** |

#### Preconditions
- Text inputs across Teachers, Departments, Announcements, Leave Reason

#### Test Data
- **Payloads**: Robert'); DROP TABLE users;--, <script>alert('XSS')</script>, <b>Bold</b>, 🚀🎉, 5000-character string

#### Exact Manual Steps
1. In 'Create Department', enter Name: `<script>alert('XSS')</script>Department`.
2. In 'Apply Leave' reason, enter: `Robert'); DROP TABLE users;--`.
3. In 'Announcements' title, enter a 2000-character long unbroken alphanumeric string.
4. Submit the forms and inspect how the inputs are handled and displayed.

#### Expected Result
- SQL injection payload is safely parameterized by SQLAlchemy ORM and treated as literal text; no SQL error occurs.
- XSS payload is sanitized / escaped by React and Jetpack Compose; no JavaScript executes.
- Excessively long string is rejected by input length constraints (e.g. max 150 chars) or truncated with clean ellipsis without breaking card layout.

#### What Tester Must Verify
- [ ] Verify database integrity is completely intact.
- [ ] Verify no raw script tag renders as HTML.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: NEG-004 — Expired Session / Tampered JWT Token Injection

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `NEG-004` |
| **Platform** | **Cross-Platform** |
| **Module** | **Negative Testing** |
| **Feature** | **Expired Session / Tampered JWT Token Injection** |
| **Target Role** | **Any** |

#### Preconditions
- User logged in with JWT token

#### Test Data
- **Action**: Manually corrupt JWT token in browser localStorage or wait for token expiry

#### Exact Manual Steps
1. Open browser developer tools -> Application -> Local Storage.
2. Locate the auth token key and edit the value to inject invalid random characters.
3. Navigate to any protected page (e.g. '/admin/teachers' or '/teacher/timetable').
4. Observe app response.

#### Expected Result
- API calls return HTTP 401 Unauthorized.
- The frontend detects token invalidity, purges corrupted token from storage, and redirects the user immediately to '/login'.
- User is prompted: 'Your session has expired. Please log in again'.

#### What Tester Must Verify
- [ ] Verify app does not get stuck in an infinite redirect loop.
- [ ] Verify no sensitive data remains displayed on screen.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: NEG-005 — Network Interruption Midway Through File Upload

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `NEG-005` |
| **Platform** | **Cross-Platform** |
| **Module** | **Negative Testing** |
| **Feature** | **Network Interruption Midway Through File Upload** |
| **Target Role** | **Admin** |

#### Preconditions
- Creating an announcement with a 15 MB PDF attachment

#### Test Data
- **Action**: Disconnect Wi-Fi / pull network cable at 50% upload progress

#### Exact Manual Steps
1. Open 'Create Announcement' on Web.
2. Attach a large PDF file and click 'Publish'.
3. While upload progress bar is active, immediately disconnect internet connection.
4. Observe error handling.

#### Expected Result
- The upload aborts cleanly.
- An informative error appears: 'Upload failed: Network connection lost. Please check your connection and retry'.
- The UI does not freeze or crash.
- Reconnecting allows the user to re-attempt the upload without losing form text.

#### What Tester Must Verify
- [ ] Verify no corrupted 0-byte orphan file remains permanently on server storage.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 35. Low Network & Throttled Performance Testing
### Test Case: NET-001 — Web Application Behavior Under Slow 3G Throttling

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `NET-001` |
| **Platform** | **Web Application** |
| **Module** | **Network Testing** |
| **Feature** | **Web Application Behavior Under Slow 3G Throttling** |
| **Target Role** | **System Admin** |

#### Preconditions
- Chrome DevTools Network tab open

#### Test Data
- **Throttling Profile**: Slow 3G (RTT: 2000ms, Download: 400kbps, Upload: 400kbps)

#### Exact Manual Steps
1. In Chrome DevTools, set Network Throttling to 'Slow 3G'.
2. Log in to the web application.
3. Navigate to '/admin/teachers' and '/admin/timetable'.
4. Observe loading states.

#### Expected Result
- Page loader skeleton placeholders appear while data loads.
- Buttons display loading spinners during API operations.
- No timeout crashes occur (FastAPI requests complete within client timeout threshold).
- Data renders correctly once responses arrive.

#### What Tester Must Verify
- [ ] Verify UI does not flicker or display raw broken layout while loading.
- [ ] Verify user cannot submit duplicate requests while waiting.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---
### Test Case: NET-002 — Android Behavior Under 2G / Flaky Connectivity

| Attribute | Specification |
| :--- | :--- |
| **Test ID** | `NET-002` |
| **Platform** | **Android** |
| **Module** | **Network Testing** |
| **Feature** | **Android Behavior Under 2G / Flaky Connectivity** |
| **Target Role** | **Teacher** |

#### Preconditions
- Android device running under throttled cellular network or emulator throttled to GSM/2G

#### Test Data
- **Network Speed**: 2G Speed (50 kbps, 500ms latency)

#### Exact Manual Steps
1. Connect Android device to throttled 2G connection.
2. Open FAFLOW.
3. Navigate to Timetable and Credits.
4. Observe cache-first loading behavior.

#### Expected Result
- App displays locally cached data instantly from Room database.
- A subtle background sync spinner indicates that fresh data is being fetched.
- If request times out, cached data remains visible with toast: 'Unable to refresh. Showing cached data'.

#### What Tester Must Verify
- [ ] Verify app remains responsive and does not freeze the main UI thread.

#### Execution Status & Sign-off
```text
[ ] PASS     [ ] FAIL     [ ] BLOCKED
```
- **Bug ID**: 
- **Tester Notes**: 
- **Evidence / Screenshot Reference**: 

---

## 36. Regression Testing & Defect Protocol
### 36.1 Standard Manual Defect Report Template
When a manual test case fails, copy and complete this standardized bug record:

```markdown
### DEFECT RECORD: BUG-[MODULE]-[NUMBER]
- **Bug ID**: BUG-__________________
- **Test ID**: [e.g. AND-ATT-002]
- **Platform**: [Android / Web Application / Backend]
- **Tested Role**: [System Admin / HOD / Teacher / Principal / Manager / Staff]
- **Module**: [e.g. Attendance / Leave / Timetable / RBAC]
- **Severity**: [P0 - Blocker | P1 - Critical | P2 - Major | P3 - Minor]
- **Hardware / Device**: [e.g. Pixel 7 / Samsung Galaxy A52 / Chrome 128 on Win 11]
- **App Version / Build**: [e.g. v1.0.0-rc2 (Build 42)]
- **Preconditions**: 
- **Steps to Reproduce**:
  1. 
  2. 
  3. 
- **Expected Result**: 
- **Actual Result**: 
- **Error Messages / Console Logs**: 
- **Evidence (Screenshot / Video Link)**: 
- **Regression Retest Result**: [ ] PASS   [ ] FAIL
```

### 36.2 Defect Severity & Triage Matrix

| Severity Level | Definition | SLA / Resolution Expectation |
| :--- | :--- | :--- |
| **P0 - Blocker** | System crash, fatal ANR, data loss, security bypass, or core workflow broken with no workaround. | Must be fixed immediately. Blocks release. |
| **P1 - Critical** | Major functional feature broken (e.g. Face verification failing 100%, Leave submission failing), but app runs. | Must be resolved before production deployment. |
| **P2 - Major** | Secondary feature broken (e.g. PDF export formatting error, filter not working), workaround exists. | Fix in release candidate cycle. |
| **P3 - Minor** | Cosmetic defect, minor typography issue, spelling error, or slight spacing inconsistency. | Scheduled for subsequent maintenance update. |

---

## 37. Final Release Verification Gate

Execute this final sign-off checklist before recommending FAFLOW for institutional production deployment:

| Check Item | Requirement | Verification Protocol | Sign-off |
| :--- | :--- | :--- | :--- |
| **1. Zero P0/P1 Defects** | All blocker and critical bugs resolved | Inspect bug tracking log; ensure zero open P0 or P1 defects. | [ ] VERIFIED |
| **2. Clean DB Migration** | PostgreSQL tables and enums verified | Run schema check; confirm zero enum collisions or missing foreign keys. | [ ] VERIFIED |
| **3. Face Biometric Health** | CameraX & Liveness functional | Verify 10 consecutive enrollments and check-ins without pipeline lock. | [ ] VERIFIED |
| **4. Geofence Integrity** | Anti-spoofing and radius checks verified | Verify boundary reject and mock GPS detection on physical device. | [ ] VERIFIED |
| **5. Cross-Platform Sync** | Leave -> Substitution -> Attendance -> Credits | Complete full XPLAT-001 through XPLAT-004 workflows without data drift. | [ ] VERIFIED |
| **6. Security & RBAC Gate** | Direct URL and API tampering blocked | Confirm all 403 Forbidden checks across System Admin, HOD, Teacher pass. | [ ] VERIFIED |
| **7. First-Login Credential Gate** | Default bootstrap passwords blocked | Confirm new admins are forced to change username and password on first login. | [ ] VERIFIED |
| **8. Backup & Data Safety** | Database snapshot download tested | Verify clean snapshot creation, download, and file size integrity. | [ ] VERIFIED |

---

### Final QA Auditor Sign-Off

```text
========================================================================================
                               FAFLOW RELEASE SIGN-OFF
========================================================================================
Application Name: FAFLOW (Faculty Flow & Governance System)
Organization: GOVERNENCE
Verification Type: Complete Manual Human Testing (Android & Web)
Target Release: Production Release Candidate 1.0.0

QA Lead / Tester Name: __________________________________________________________________
Signature:              __________________________________________________________________
Date of Verification:   __________________________________________________________________

OVERALL RECOMMENDATION:
[ ] APPROVED FOR PRODUCTION RELEASE
[ ] REJECTED — CRITICAL DEFECTS PENDING RESOLUTION
[ ] CONDITIONAL APPROVAL (REMARKS ATTACHED)

Remarks / Conditions:
________________________________________________________________________________________
________________________________________________________________________________________
========================================================================================
```

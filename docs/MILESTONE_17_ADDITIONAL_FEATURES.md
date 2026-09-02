# Milestone 17 — High-Value Additional Product Features

### 1. Overview
Beyond 100% legacy parity, Milestone 17 introduces several high-value product enhancements to maximize faculty productivity, institutional visibility, and operational resilience.

---

### 2. High-Value Enhancements

#### A. Smart Home Dashboard (`DashboardScreen.kt`)
- **Active Context Banner**: Automatically shows the upcoming scheduled period or current active class.
- **Day Order Pill (`DayOrderBadge.kt`)**: Displays current day order or holiday indicator with immediate visual cues.
- **Direct Punch Trigger**: One-tap access to biometric attendance check-in/check-out.

#### B. Today's Slot Coverage Board (`TodayCoverageScreen.kt`)
- Live breakdown of covered vs uncovered slots across all classes.
- Direct status indicators for absent faculty and assigned substitutes.

#### C. Classwise Timetable Explorer (`ClasswiseTimetableScreen.kt`)
- Interactive class dropdown with section and semester filters.
- Horizontal day order chips (Day 1 to Day 6) for rapid timetable inspection.

#### D. HOD Department Overview & Quick Actions (`HodDashboardScreen.kt`)
- Live metrics: Pending leaves count, total active faculty on premise, covered/uncovered substitution slots, and department absences.
- Fast-action cards for review, faculty directory search, and live attendance tracking.

#### E. Smart Offline Awareness & Local Queueing
- When connectivity drops, punches are stored securely in Room SQLite and marked `PENDING_SYNC`.
- Background `WorkManager` workers sync records automatically upon network restoration.

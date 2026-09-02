# Milestone 14: Controlled Staff Pilot Test Report
## 5–10 Staff Member Validation Protocol

---

## 1. Pilot Rollout Structure

| Pilot Participant | Role / Department | Device Spec (Target Handset) | Shift Schedule | Pilot Status |
|---|---|---|---|---|
| **Pilot User 01** | HOD, Computer Science | Google Pixel 7a (Android 14) | 08:30 AM - 04:30 PM | **SCHEDULED** |
| **Pilot User 02** | Associate Prof, EEE | Samsung Galaxy A54 5G (Android 13) | 08:30 AM - 04:30 PM | **SCHEDULED** |
| **Pilot User 03** | Assistant Prof, Mech | Xiaomi Redmi Note 12 (Android 13) | 09:00 AM - 05:00 PM | **SCHEDULED** |
| **Pilot User 04** | Lab Instructor, Physics | OnePlus Nord CE 3 (Android 14) | 08:30 AM - 04:30 PM | **SCHEDULED** |
| **Pilot User 05** | Administrative Staff | Vivo V29 (Android 13) | 09:00 AM - 05:00 PM | **SCHEDULED** |

---

## 2. Daily Pilot Verification Procedures

1. **Morning Check-In (08:15 AM - 08:45 AM)**:
   - Verify GPS acquisition within $15\text{m}$ campus geofence.
   - Perform on-device SCRFD detection and 3D head pose liveness challenge.
   - Confirm instant server receipt and shift check-in timestamp.
2. **Midday Inspection**:
   - Verify supervisor live dashboard (`GET /attendance/admin/live-status`) accurately shows 5 present staff members.
3. **Evening Check-Out (04:30 PM - 05:15 PM)**:
   - Complete checkout with biometric verification.
   - Confirm working duration and auto-refresh on Faculty Dashboard.
4. **Offline Resilience Trial**:
   - 1 pilot user performs check-in in Airplane mode; disables Airplane mode; confirms seamless WorkManager sync.

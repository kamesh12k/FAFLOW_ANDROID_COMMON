$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$destDir = "C:\Users\kames\.gemini\antigravity-ide\brain\f21d8419-137f-439e-9255-b6c1feff5448\screenshots\android"

if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}

function Snap($name) {
    Write-Host "Capturing Android: $name..."
    Start-Sleep -Milliseconds 1200
    & $adb -s emulator-5554 shell screencap -p /sdcard/snap.png
    & $adb -s emulator-5554 pull /sdcard/snap.png "$destDir\$name.png" | Out-Null
    Write-Host "  Saved: $name.png"
}

function Tap($x, $y) {
    & $adb -s emulator-5554 shell "input tap $x $y"
    Start-Sleep -Milliseconds 800
}

function Back() {
    & $adb -s emulator-5554 shell "input keyevent 4"
    Start-Sleep -Milliseconds 800
}

# 1. Home Dashboard
Tap 135 2270
Snap "01_home_dashboard"

# 2. Timetable Tab
Tap 405 2270
Snap "02_timetable"

# 3. Staff Attendance Tab
Tap 675 2270
Snap "03_staff_attendance"

# 4. Check In Flow (from Attendance Screen)
Tap 540 850
Snap "04_attendance_camera_flow"
Back

# 5. History Flow (from Attendance Screen)
Tap 540 1150
Snap "05_attendance_history"
Back

# 6. More Hub Tab
Tap 945 2270
Snap "06_more_hub"

# 7. Student Attendance
Tap 500 200
Snap "07_student_attendance"
Back

# 8. Apply for Leave
Tap 500 320
Snap "08_apply_leave"
Back

# 9. Leave History
Tap 500 390
Snap "09_leave_history"
Back

# 10. Casual Leave Credits
Tap 500 460
Snap "10_credits_ledger"
Back

# 11. Face Biometrics Enrollment
Tap 500 580
Snap "11_face_enrollment"
Back

# 12. Substitution Preferences
Tap 500 650
Snap "12_substitution_preferences"
Back

# 13. Staff Profile
Tap 500 770
Snap "13_staff_profile"
Back

# 14. Notifications (Top Bar)
Tap 135 2270
Tap 812 165
Snap "14_notifications"
Back

# 15. Settings & Diagnostics (Top Bar)
Tap 915 165
Snap "15_settings_diagnostics"
Back

# 16. Substitution & Duties (from Home Workload Balance)
Tap 750 450
Snap "16_substitution_duties"
Back

# 17. Today Coverage / Full Week Timetable
Tap 850 700
Snap "17_today_coverage_schedule"
Back

Write-Host "All Android screenshots captured successfully!"

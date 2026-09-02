package com.governence.faflow.attendance.model

/**
 * Exhaustive production state machine representing all 28 end-to-end attendance pipeline states.
 */
sealed class AttendancePipelineStatus(
    val title: String,
    val description: String,
    val isActionable: Boolean = false,
    val isError: Boolean = false
) {
    data object Initializing : AttendancePipelineStatus(
        "Initializing",
        "Loading security credentials and model runtimes..."
    )

    data object Authenticating : AttendancePipelineStatus(
        "Authenticating",
        "Verifying institutional JWT credentials..."
    )

    data object RequestingPermissions : AttendancePipelineStatus(
        "Permissions Required",
        "Camera and GPS permissions are required for institutional attendance verification.",
        isActionable = true
    )

    data object Locating : AttendancePipelineStatus(
        "Acquiring GPS Fix",
        "Determining device coordinates via high-accuracy GPS..."
    )

    data object LocationUnavailable : AttendancePipelineStatus(
        "Location Unavailable",
        "Unable to acquire location fix. Please ensure location services are enabled.",
        isError = true
    )

    data class OutsideGeofence(val distanceMeters: Int, val nearestGeofence: String) : AttendancePipelineStatus(
        "Outside Campus Perimeter",
        "You are currently ${distanceMeters}m outside $nearestGeofence. Please move inside institutional boundaries.",
        isError = true
    )

    data class PoorGpsAccuracy(val accuracyMeters: Int) : AttendancePipelineStatus(
        "Low GPS Accuracy",
        "GPS accuracy is currently ±${accuracyMeters}m (maximum allowable is ±50m). Move to an open area with clear sky view.",
        isError = true
    )

    data object MockLocationBlocked : AttendancePipelineStatus(
        "Fake GPS Detected",
        "Simulated location provider or mock GPS app detected. Attendance is strictly blocked.",
        isError = true
    )

    data object CameraInitializing : AttendancePipelineStatus(
        "Starting Camera",
        "Opening front camera capture session..."
    )

    data object NoFace : AttendancePipelineStatus(
        "No Face Detected",
        "Position your face inside the framing guide."
    )

    data class MultipleFaces(val count: Int) : AttendancePipelineStatus(
        "Multiple Faces Visible",
        "$count faces detected. Only one staff member must be present in the camera frame.",
        isError = true
    )

    data object FaceDetected : AttendancePipelineStatus(
        "Face Detected",
        "Position yourself steadily within the guide oval."
    )

    data object FaceTooSmall : AttendancePipelineStatus(
        "Move Closer",
        "Your face is too far from the camera. Move closer to the screen."
    )

    data object FaceOutOfFrame : AttendancePipelineStatus(
        "Center Face",
        "Face partially out of frame. Please align your face inside the guide."
    )

    data object FaceAlignmentRequired : AttendancePipelineStatus(
        "Aligning Features",
        "Calculating 5-point canonical similarity transform..."
    )

    data object FaceVerification : AttendancePipelineStatus(
        "Verifying Identity",
        "Matching ArcFace embedding against encrypted staff profile..."
    )

    data class LivenessCheck(val instructions: String, val progress: Float) : AttendancePipelineStatus(
        "Verifying Liveness",
        instructions
    )

    data class VerificationFailed(val reason: String) : AttendancePipelineStatus(
        "Verification Mismatch",
        reason,
        isError = true
    )

    data class ReadyForCheckIn(val staffId: String, val similarity: Float) : AttendancePipelineStatus(
        "Ready for Check-In",
        "Staff member #$staffId verified ($similarity% match). Tap below to record check-in.",
        isActionable = true
    )

    data object CheckingIn : AttendancePipelineStatus(
        "Checking In",
        "Transmitting attendance record to FAFLOW server..."
    )

    data class CheckedIn(val timestamp: String) : AttendancePipelineStatus(
        "Checked In",
        "Shift check-in confirmed at $timestamp."
    )

    data class ReadyForCheckOut(val staffId: String) : AttendancePipelineStatus(
        "Ready for Check-Out",
        "Staff member #$staffId verified. Tap below to record check-out.",
        isActionable = true
    )

    data object CheckingOut : AttendancePipelineStatus(
        "Checking Out",
        "Transmitting check-out record to FAFLOW server..."
    )

    data class CheckedOut(val timestamp: String, val duration: String?) : AttendancePipelineStatus(
        "Checked Out",
        "Shift check-out confirmed at $timestamp${duration?.let { " ($it)" } ?: ""}."
    )

    data class SavedOffline(val message: String) : AttendancePipelineStatus(
        "Saved Offline",
        message
    )

    data class SyncPending(val pendingCount: Int) : AttendancePipelineStatus(
        "Sync Pending",
        "$pendingCount offline record(s) queued for background upload."
    )

    data object Syncing : AttendancePipelineStatus(
        "Synchronizing",
        "Uploading queued attendance records to FAFLOW server..."
    )

    data object Synced : AttendancePipelineStatus(
        "Synchronized",
        "All offline attendance records successfully synchronized with the backend."
    )

    data class ServerRejected(val reason: String) : AttendancePipelineStatus(
        "Server Rejected",
        reason,
        isError = true
    )

    data class Error(val message: String) : AttendancePipelineStatus(
        "Operational Error",
        message,
        isError = true
    )
}

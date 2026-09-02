from datetime import date, datetime, timezone
import math
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.exceptions import DomainException
from app.models.user import User
from app.models.campus_geofence import CampusGeofence
from app.models.staff_attendance import StaffAttendanceRecord
from app.models.audit_log import AuditLog
from app.schemas.attendance import (
    AttendanceCheckInRequest,
    AttendanceCheckOutRequest,
    AttendanceRecordOut,
    AttendanceTodaySummaryOut,
    AttendanceSupervisorLiveStatusOut
)
from app.services.geofence_service import GeofenceService


class AttendanceService:

    @staticmethod
    def _log_audit(db: Session, user_id: Optional[int], action: str, details: dict):
        try:
            audit = AuditLog(
                actor_user_id=user_id,
                action=action,
                target_type="attendance",
                details=details
            )
            db.add(audit)
            db.commit()
        except Exception:
            db.rollback()

    @staticmethod
    def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r = 6371000.0  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return r * c

    @staticmethod
    def _validate_server_geofence(db: Session, lat: float, lon: float, accuracy: float) -> Tuple[bool, Optional[CampusGeofence]]:
        if accuracy > 50.0:
            raise DomainException(f"GPS accuracy ({accuracy:.1f}m) exceeds allowable threshold (50.0m)", status_code=400)

        active_geofences = GeofenceService.list_geofences(db, is_active_only=True)
        if not active_geofences:
            # If no geofences configured in system, pass by default with no geofence attached
            return True, None

        for g in active_geofences:
            dist = AttendanceService._haversine_meters(lat, lon, g.center_latitude, g.center_longitude)
            if dist <= (g.radius_meters + g.tolerance_meters):
                return True, g

        return False, None

    @staticmethod
    def check_in(db: Session, user: User, data: AttendanceCheckInRequest) -> AttendanceRecordOut:
        if not user.is_active:
            AttendanceService._log_audit(db, user.id, "ATTENDANCE_CHECK_IN_REJECTED", {"reason": "Staff account deactivated"})
            raise DomainException("Staff account is deactivated", status_code=403)

        # 1. Idempotency Check
        existing_idempotent = db.query(StaffAttendanceRecord).filter(
            StaffAttendanceRecord.idempotency_key == data.idempotency_key
        ).first()
        if existing_idempotent:
            return AttendanceService._to_dto(existing_idempotent)

        # 2. Biometric Verification Gate
        if data.face_similarity_score < 0.60:
            AttendanceService._log_audit(db, user.id, "FACE_VERIFICATION_FAILURE", {"similarity": data.face_similarity_score})
            raise DomainException(f"Biometric face similarity score ({data.face_similarity_score:.2f}) below threshold 0.60", status_code=400)
        if not data.liveness_verified:
            AttendanceService._log_audit(db, user.id, "LIVENESS_FAILURE", {"liveness_verified": False})
            raise DomainException("Liveness / presentation attack verification failed", status_code=400)

        # 3. Server-side Geofence Validation
        try:
            is_inside, geofence = AttendanceService._validate_server_geofence(db, data.latitude, data.longitude, data.accuracy_meters)
        except DomainException as e:
            AttendanceService._log_audit(db, user.id, "GPS_ACCURACY_FAILURE", {"accuracy": data.accuracy_meters})
            raise e

        if not is_inside:
            AttendanceService._log_audit(db, user.id, "GEOFENCE_FAILURE", {"latitude": data.latitude, "longitude": data.longitude})
            raise DomainException("Location verification failed: Staff member is outside institutional campus geofence perimeters", status_code=400)

        # 4. Check Duplicate Check-In for Today
        today = date.today()
        existing_today = db.query(StaffAttendanceRecord).filter(
            StaffAttendanceRecord.user_id == user.id,
            StaffAttendanceRecord.attendance_date == today
        ).first()

        if existing_today and existing_today.check_in_time is not None:
            AttendanceService._log_audit(db, user.id, "DUPLICATE_ATTENDANCE", {"date": str(today)})
            raise DomainException(f"Staff member is already checked in for today ({today})", status_code=400)

        # 5. Record Authoritative Shift Check-In
        now_utc = datetime.now(timezone.utc)
        record = existing_today or StaffAttendanceRecord(
            user_id=user.id,
            attendance_date=today
        )

        record.check_in_time = now_utc
        record.status = "PRESENT"
        record.check_in_latitude = data.latitude
        record.check_in_longitude = data.longitude
        record.check_in_accuracy = data.accuracy_meters
        record.check_in_geofence_id = geofence.id if geofence else None
        record.face_similarity_score = data.face_similarity_score
        record.liveness_verified = data.liveness_verified
        record.verification_method = data.verification_method
        record.idempotency_key = data.idempotency_key
        record.device_reference = data.device_reference

        db.add(record)
        db.commit()
        db.refresh(record)

        AttendanceService._log_audit(db, user.id, "ATTENDANCE_CHECK_IN_ACCEPTED", {"record_id": record.id, "time": str(now_utc)})
        return AttendanceService._to_dto(record)

    @staticmethod
    def check_out(db: Session, user: User, data: AttendanceCheckOutRequest) -> AttendanceRecordOut:
        if not user.is_active:
            AttendanceService._log_audit(db, user.id, "ATTENDANCE_CHECK_OUT_REJECTED", {"reason": "Staff account deactivated"})
            raise DomainException("Staff account is deactivated", status_code=403)

        # 1. Idempotency Check
        existing_idempotent = db.query(StaffAttendanceRecord).filter(
            StaffAttendanceRecord.idempotency_key == data.idempotency_key
        ).first()
        if existing_idempotent and existing_idempotent.check_out_time is not None:
            return AttendanceService._to_dto(existing_idempotent)

        # 2. Server-side Geofence Validation
        is_inside, geofence = AttendanceService._validate_server_geofence(db, data.latitude, data.longitude, data.accuracy_meters)
        if not is_inside:
            AttendanceService._log_audit(db, user.id, "GEOFENCE_FAILURE", {"latitude": data.latitude, "longitude": data.longitude})
            raise DomainException("Location verification failed: Staff member is outside institutional campus geofence perimeters", status_code=400)

        # 3. Find Today's Check-In Record
        today = date.today()
        record = db.query(StaffAttendanceRecord).filter(
            StaffAttendanceRecord.user_id == user.id,
            StaffAttendanceRecord.attendance_date == today
        ).first()

        if not record or record.check_in_time is None:
            AttendanceService._log_audit(db, user.id, "ATTENDANCE_CHECK_OUT_REJECTED", {"reason": "No prior check-in found"})
            raise DomainException("Cannot check out: No prior check-in recorded for today", status_code=400)

        if record.check_out_time is not None:
            AttendanceService._log_audit(db, user.id, "DUPLICATE_ATTENDANCE", {"reason": "Already checked out"})
            raise DomainException(f"Staff member is already checked out for today ({today})", status_code=400)

        now_utc = datetime.now(timezone.utc)
        record.check_out_time = now_utc
        record.check_out_latitude = data.latitude
        record.check_out_longitude = data.longitude
        record.check_out_accuracy = data.accuracy_meters
        record.check_out_geofence_id = geofence.id if geofence else None

        # Calculate Working Hours
        if record.check_in_time:
            check_in_utc = record.check_in_time.replace(tzinfo=timezone.utc) if record.check_in_time.tzinfo is None else record.check_in_time
            diff = now_utc - check_in_utc
            total_seconds = max(0, int(diff.total_seconds()))
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            record.working_hours = f"{hours}h {minutes}m"

        db.add(record)
        db.commit()
        db.refresh(record)

        AttendanceService._log_audit(db, user.id, "ATTENDANCE_CHECK_OUT_ACCEPTED", {"record_id": record.id, "working_hours": record.working_hours})
        return AttendanceService._to_dto(record)

    @staticmethod
    def get_today_summary(db: Session, user_id: int) -> AttendanceTodaySummaryOut:
        today = date.today()
        record = db.query(StaffAttendanceRecord).filter(
            StaffAttendanceRecord.user_id == user_id,
            StaffAttendanceRecord.attendance_date == today
        ).first()

        if not record:
            return AttendanceTodaySummaryOut(
                is_checked_in=False,
                is_checked_out=False,
                check_in_time=None,
                check_out_time=None,
                working_duration=None,
                record=None
            )

        dto = AttendanceService._to_dto(record)
        return AttendanceTodaySummaryOut(
            is_checked_in=record.check_in_time is not None,
            is_checked_out=record.check_out_time is not None,
            check_in_time=record.check_in_time,
            check_out_time=record.check_out_time,
            working_duration=record.working_hours,
            record=dto
        )

    @staticmethod
    def list_my_history(db: Session, user_id: int, limit: int = 30, offset: int = 0) -> List[AttendanceRecordOut]:
        records = db.query(StaffAttendanceRecord).filter(
            StaffAttendanceRecord.user_id == user_id
        ).order_by(
            desc(StaffAttendanceRecord.attendance_date),
            desc(StaffAttendanceRecord.check_in_time)
        ).offset(offset).limit(limit).all()

        return [AttendanceService._to_dto(r) for r in records]

    @staticmethod
    def get_supervisor_live_status(db: Session, current_user: User) -> AttendanceSupervisorLiveStatusOut:
        allowed_roles = ["admin", "super_admin", "principal", "hod", "manager"]
        if getattr(current_user, "role", "").lower() not in allowed_roles:
            raise DomainException("Access forbidden: Supervisor or Administrator privilege required", status_code=403)

        today = date.today()
        total_staff = db.query(User).filter(User.is_active == True).count()
        today_records = db.query(StaffAttendanceRecord).filter(StaffAttendanceRecord.attendance_date == today).all()

        checked_in = sum(1 for r in today_records if r.check_in_time is not None and r.check_out_time is None)
        checked_out = sum(1 for r in today_records if r.check_out_time is not None)
        absent = max(0, total_staff - (checked_in + checked_out))

        active_shifts = [AttendanceService._to_dto(r) for r in today_records if r.check_in_time is not None and r.check_out_time is None]

        return AttendanceSupervisorLiveStatusOut(
            total_staff=total_staff,
            checked_in_count=checked_in,
            checked_out_count=checked_out,
            absent_count=absent,
            active_shifts=active_shifts,
            anomalies_count=0
        )

    @staticmethod
    def _to_dto(record: StaffAttendanceRecord) -> AttendanceRecordOut:
        staff_name = None
        if record.user:
            staff_name = getattr(record.user, "name", None) or getattr(record.user, "username", None)

        check_in_geofence = record.check_in_geofence.name if record.check_in_geofence else None
        check_out_geofence = record.check_out_geofence.name if record.check_out_geofence else None

        return AttendanceRecordOut(
            id=record.id,
            user_id=record.user_id,
            staff_name=staff_name,
            attendance_date=record.attendance_date,
            check_in_time=record.check_in_time,
            check_out_time=record.check_out_time,
            status=record.status,
            check_in_geofence_name=check_in_geofence,
            check_out_geofence_name=check_out_geofence,
            face_similarity_score=record.face_similarity_score,
            liveness_verified=record.liveness_verified,
            verification_method=record.verification_method,
            working_hours=record.working_hours,
            is_synced=True
        )

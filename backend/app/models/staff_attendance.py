from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.database import Base


class StaffAttendanceRecord(Base):
    """Authoritative institutional attendance record for staff and faculty members.
    Gated by on-device biometric face verification and campus geofencing."""
    __tablename__ = "staff_attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    attendance_date = Column(Date, nullable=False, index=True)
    check_in_time = Column(DateTime(timezone=True), nullable=True)
    check_out_time = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="PRESENT")  # 'PRESENT', 'HALF_DAY', 'LATE', 'ON_DUTY'

    # Check-in location metadata
    check_in_latitude = Column(Float, nullable=True)
    check_in_longitude = Column(Float, nullable=True)
    check_in_accuracy = Column(Float, nullable=True)
    check_in_geofence_id = Column(Integer, ForeignKey("campus_geofences.id", ondelete="SET NULL"), nullable=True)

    # Check-out location metadata
    check_out_latitude = Column(Float, nullable=True)
    check_out_longitude = Column(Float, nullable=True)
    check_out_accuracy = Column(Float, nullable=True)
    check_out_geofence_id = Column(Integer, ForeignKey("campus_geofences.id", ondelete="SET NULL"), nullable=True)

    # Biometric verification receipts (metadata only, zero raw images/embeddings)
    face_similarity_score = Column(Float, nullable=True)
    liveness_verified = Column(Boolean, nullable=False, default=False)
    verification_method = Column(String(50), nullable=False, default="FACE_ON_DEVICE")

    # Idempotency and sync provenance
    idempotency_key = Column(String(64), unique=True, nullable=True, index=True)
    device_reference = Column(String(100), nullable=True)
    sync_source = Column(String(20), nullable=False, default="DIRECT")  # 'DIRECT', 'OFFLINE_SYNC'
    working_hours = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])
    check_in_geofence = relationship("CampusGeofence", foreign_keys=[check_in_geofence_id])
    check_out_geofence = relationship("CampusGeofence", foreign_keys=[check_out_geofence_id])

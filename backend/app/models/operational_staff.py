from sqlalchemy import Column, Integer, String, ForeignKey, Enum, DateTime, Date, Text, func, JSON
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class StaffCategory(str, enum.Enum):
    laboratory = "laboratory"
    non_teaching = "non_teaching"


class EmploymentStatus(str, enum.Enum):
    active = "active"
    on_leave = "on_leave"
    transferred = "transferred"
    inactive = "inactive"


class ShiftType(str, enum.Enum):
    general = "general"
    morning = "morning"
    evening = "evening"
    night = "night"


class OperationalStaff(Base):
    __tablename__ = "operational_staff"

    id = Column(Integer, primary_key=True, index=True)
    employee_code = Column(String(50), nullable=False, unique=True, index=True)
    full_name = Column(String(150), nullable=False, index=True)
    category = Column(Enum(StaffCategory, name="staff_category", create_type=False), nullable=False, index=True)
    designation = Column(String(100), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_room_ids = Column(JSON, default=list, nullable=True)  # Multiple controlled labs: [room_id_1, room_id_2, ...]
    phone_number = Column(String(20), nullable=True)
    email = Column(String(150), nullable=True)
    employment_status = Column(Enum(EmploymentStatus, name="employment_status", create_type=False), default=EmploymentStatus.active, nullable=False, index=True)
    shift_type = Column(Enum(ShiftType, name="shift_type", create_type=False), default=ShiftType.general, nullable=False)
    joining_date = Column(Date, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by_manager_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    department = relationship("Department")
    assigned_room = relationship("Room")
    created_by_manager = relationship("User", foreign_keys=[created_by_manager_id])

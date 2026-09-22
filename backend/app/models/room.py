from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, Enum, DateTime, func
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class RoomType(str, enum.Enum):
    classroom = "classroom"
    lab = "lab"
    laboratory = "laboratory"
    seminar_hall = "seminar_hall"
    examination_hall = "examination_hall"
    staff_room = "staff_room"
    office = "office"
    auditorium = "auditorium"
    meeting_room = "meeting_room"
    store_room = "store_room"
    other = "other"


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(50), nullable=False, unique=True, index=True)
    room_name = Column(String(150), nullable=True)
    room_type = Column(Enum(RoomType, name="room_type", create_type=False), default=RoomType.classroom, nullable=False)
    capacity = Column(Integer, nullable=False, default=60)
    
    # Campus Hierarchy Links
    block_id = Column(Integer, ForeignKey("campus_blocks.id", ondelete="SET NULL"), nullable=True, index=True)
    floor_id = Column(Integer, ForeignKey("campus_floors.id", ondelete="SET NULL"), nullable=True, index=True)
    area_id = Column(Integer, ForeignKey("campus_areas.id", ondelete="SET NULL"), nullable=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
    primary_class_id = Column(Integer, ForeignKey("classes.id", ondelete="SET NULL", use_alter=True, name="fk_rooms_primary_class_id"), nullable=True, index=True)

    # Examination Hall Configuration
    is_exam_eligible = Column(Boolean, nullable=False, default=False, index=True)
    exam_capacity = Column(Integer, nullable=True)
    required_invigilators = Column(Integer, nullable=False, default=1)

    # Laboratory Configuration
    lab_type = Column(String(100), nullable=True)
    equipment_category = Column(String(100), nullable=True)

    # Operational status & metadata
    is_timetable_eligible = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    department = relationship("Department")
    block = relationship("CampusBlock", back_populates="rooms")
    floor = relationship("CampusFloor", back_populates="rooms")
    area = relationship("CampusArea")
    primary_class = relationship("Class", foreign_keys=[primary_class_id])

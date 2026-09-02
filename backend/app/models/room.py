from sqlalchemy import Column, Integer, String, ForeignKey, Enum, DateTime, func
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class RoomType(str, enum.Enum):
    classroom = "classroom"
    lab = "lab"


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(20), nullable=False, unique=True)
    room_type = Column(Enum(RoomType, name="room_type", create_type=False), default=RoomType.classroom, nullable=False)
    capacity = Column(Integer, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department")

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    section = Column(String(10), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    semester = Column(Integer, nullable=False)
    default_room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department")
    default_room = relationship("Room", foreign_keys=[default_room_id])

    # A class is an institution-wide entity.  department_id identifies the
    # owning department, but another department may legitimately teach it.
    __table_args__ = (UniqueConstraint("name", "section", name="uq_global_class_name_section"),)

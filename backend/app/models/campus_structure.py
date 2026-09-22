import enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    ForeignKey, func, UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.database import Base


class CampusBlock(Base):
    """Authoritative physical building or academic block."""
    __tablename__ = "campus_blocks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False, unique=True, index=True)
    floors_count = Column(Integer, nullable=False, default=1)
    description = Column(Text, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    department = relationship("Department", foreign_keys=[department_id])
    floors = relationship("CampusFloor", back_populates="block", cascade="all, delete-orphan", order_by="CampusFloor.display_order")
    rooms = relationship("Room", back_populates="block")


class CampusFloor(Base):
    """A floor within a specific campus block."""
    __tablename__ = "campus_floors"

    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(Integer, ForeignKey("campus_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    floor_number = Column(Integer, nullable=False)  # e.g., -1=Basement, 0=Ground, 1=1st, 2=2nd
    floor_name = Column(String(100), nullable=False)  # e.g., "Ground Floor", "First Floor", "Mezzanine"
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    block = relationship("CampusBlock", back_populates="floors")
    rooms = relationship("Room", back_populates="floor")

    __table_args__ = (
        UniqueConstraint("block_id", "floor_number", name="uq_block_floor_number"),
    )

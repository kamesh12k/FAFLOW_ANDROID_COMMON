from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class CampusGeofence(Base):
    """Stores administrative campus boundaries (Circular & Polygonal)
    used for faculty and staff attendance location verification."""
    __tablename__ = "campus_geofences"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    type = Column(String(20), nullable=False, default="circle")  # 'circle' or 'polygon'
    center_latitude = Column(Float, nullable=False)
    center_longitude = Column(Float, nullable=False)
    radius_meters = Column(Float, nullable=False, default=150.0)
    geometry = Column(JSONB, nullable=False)  # GeoJSON structure with vertices / radius
    tolerance_meters = Column(Float, nullable=False, default=15.0)
    area_sq_meters = Column(Float, nullable=True)
    perimeter_meters = Column(Float, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])

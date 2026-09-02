from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, validator


class GeofenceBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    type: str = Field("circle", pattern="^(circle|polygon)$")
    tolerance_meters: float = Field(15.0, ge=0.0, le=100.0)


class GeofenceCreate(GeofenceBase):
    center_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    center_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    radius_meters: Optional[float] = Field(150.0, ge=5.0, le=10000.0)
    polygon_vertices: Optional[List[List[float]]] = None  # List of [lat, lng] pairs

    @validator("polygon_vertices")
    def validate_vertices(cls, v, values):
        if values.get("type") == "polygon":
            if not v or len(v) < 3:
                raise ValueError("Polygons must contain at least 3 distinct coordinate vertices")
            for pt in v:
                if len(pt) != 2:
                    raise ValueError("Each polygon vertex must have [latitude, longitude]")
                lat, lng = pt[0], pt[1]
                if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
                    raise ValueError(f"Invalid coordinate in polygon: {lat}, {lng}")
        return v


class GeofenceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    type: Optional[str] = Field(None, pattern="^(circle|polygon)$")
    center_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    center_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    radius_meters: Optional[float] = Field(None, ge=5.0, le=10000.0)
    polygon_vertices: Optional[List[List[float]]] = None
    tolerance_meters: Optional[float] = Field(None, ge=0.0, le=100.0)
    is_active: Optional[bool] = None


class GeofenceOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    type: str
    center_latitude: float
    center_longitude: float
    radius_meters: float
    geometry: Dict[str, Any]
    tolerance_meters: float
    area_sq_meters: Optional[float]
    perimeter_meters: Optional[float]
    is_active: bool
    created_by: Optional[int]
    creator_name: Optional[str] = None
    updated_by: Optional[int]
    updater_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True          # Pydantic v1 compat
        from_attributes = True   # Pydantic v2 compat


class GeofenceActiveOut(BaseModel):
    """Optimized payload for staff mobile location verification."""
    id: int
    name: str
    type: str
    center_latitude: float
    center_longitude: float
    radius_meters: float
    geometry: Dict[str, Any]
    tolerance_meters: float
    is_active: bool

    class Config:
        orm_mode = True          # Pydantic v1 compat
        from_attributes = True   # Pydantic v2 compat

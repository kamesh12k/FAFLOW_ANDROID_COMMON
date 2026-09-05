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
    polygon_vertices: Optional[Any] = None  # List of [lat, lng] pairs or dicts

    @validator("polygon_vertices", pre=True)
    def validate_vertices(cls, v, values):
        if not v:
            return v
        normalized = []
        for pt in v:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                lat, lng = float(pt[0]), float(pt[1])
            elif isinstance(pt, dict):
                lat = float(pt.get("latitude", pt.get("lat", 0)))
                lng = float(pt.get("longitude", pt.get("lng", 0)))
            else:
                raise ValueError("Invalid coordinate format in polygon")
            if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
                raise ValueError(f"Invalid coordinate in polygon: {lat}, {lng}")
            normalized.append([lat, lng])

        if values.get("type") == "polygon" and len(normalized) < 3:
            raise ValueError("Polygons must contain at least 3 distinct coordinate vertices")
        return normalized


class GeofenceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    type: Optional[str] = Field(None, pattern="^(circle|polygon)$")
    center_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    center_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    radius_meters: Optional[float] = Field(None, ge=5.0, le=10000.0)
    polygon_vertices: Optional[Any] = None
    tolerance_meters: Optional[float] = Field(None, ge=0.0, le=100.0)
    is_active: Optional[bool] = None

    @validator("polygon_vertices", pre=True)
    def validate_vertices(cls, v, values):
        if not v:
            return v
        normalized = []
        for pt in v:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                lat, lng = float(pt[0]), float(pt[1])
            elif isinstance(pt, dict):
                lat = float(pt.get("latitude", pt.get("lat", 0)))
                lng = float(pt.get("longitude", pt.get("lng", 0)))
            else:
                raise ValueError("Invalid coordinate format in polygon")
            if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
                raise ValueError(f"Invalid coordinate in polygon: {lat}, {lng}")
            normalized.append([lat, lng])
        return normalized



class GeofenceOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    type: str
    center_latitude: float
    center_longitude: float
    radius_meters: Optional[float] = None
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
    radius_meters: Optional[float] = None
    geometry: Dict[str, Any]
    tolerance_meters: float
    is_active: bool

    class Config:
        orm_mode = True          # Pydantic v1 compat
        from_attributes = True   # Pydantic v2 compat


class LocationTestRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    accuracy_meters: Optional[float] = Field(5.0, ge=0.0, le=1000.0)


class LocationTestResponse(BaseModel):
    is_inside: bool
    status: str
    message: str
    nearest_geofence_name: Optional[str] = None
    nearest_geofence_type: Optional[str] = None
    distance_to_boundary_meters: float
    distance_to_center_meters: float
    accuracy_meters: float


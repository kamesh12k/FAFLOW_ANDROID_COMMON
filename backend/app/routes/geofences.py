from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin, require_system_admin, require_super_admin
from app.models.user import User
from app.schemas.geofence import (
    GeofenceCreate,
    GeofenceUpdate,
    GeofenceOut,
    GeofenceActiveOut,
    LocationTestRequest,
    LocationTestResponse
)
from app.services.geofence_service import GeofenceService

router = APIRouter(prefix="/geofences", tags=["Campus Geofences"])


@router.post("/test-location", response_model=LocationTestResponse)
def test_campus_location(
    data: LocationTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Authoritative test of a GPS coordinate against active campus geofences.
    Calculates exact boundary containment, distance to perimeter, and radius tolerance.
    """
    return GeofenceService.test_location(
        db=db,
        lat=data.latitude,
        lon=data.longitude,
        accuracy_meters=data.accuracy_meters or 5.0
    )


@router.get("/active", response_model=List[GeofenceActiveOut])
def get_active_geofences_for_mobile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns active campus geofence perimeters for staff mobile attendance verification.
    Accessible to all authenticated faculty & staff."""
    return GeofenceService.list_geofences(db, is_active_only=True)


@router.get("/", response_model=List[GeofenceOut])
def list_all_geofences_admin(
    is_active: bool = Query(None, description="Filter by active status"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Lists all campus geofences with administrative metadata (Admin read-only)."""
    geofences = GeofenceService.list_geofences(db, is_active_only=(is_active is True))
    result = []
    for g in geofences:
        out = GeofenceOut.from_orm(g)
        out.creator_name = g.creator.name if g.creator else None
        out.updater_name = g.updater.name if g.updater else None
        result.append(out)
    return result


@router.get("/{geofence_id}", response_model=GeofenceOut)
def get_geofence_admin(
    geofence_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Retrieves detailed geofence configuration (Admin read-only)."""
    g = GeofenceService.get_geofence_by_id(db, geofence_id)
    out = GeofenceOut.from_orm(g)
    out.creator_name = g.creator.name if g.creator else None
    out.updater_name = g.updater.name if g.updater else None
    return out


# ─────────────────────────────────────────────────────────────────────────────
# MUTATION ENDPOINTS — SYSTEM ADMIN ONLY
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=GeofenceOut, status_code=status.HTTP_201_CREATED)
def create_geofence_admin(
    data: GeofenceCreate,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """
    Creates a new circular or polygonal campus geofence.
    SYSTEM_ADMIN only.
    """
    g = GeofenceService.create_geofence(db, data, current_user.id)
    out = GeofenceOut.from_orm(g)
    out.creator_name = current_user.name
    return out


@router.put("/{geofence_id}", response_model=GeofenceOut)
def update_geofence_admin(
    geofence_id: int,
    data: GeofenceUpdate,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """
    Updates an existing campus geofence boundary, radius, or polygon vertices.
    SYSTEM_ADMIN only.
    """
    g = GeofenceService.update_geofence(db, geofence_id, data, current_user.id)
    out = GeofenceOut.from_orm(g)
    out.updater_name = current_user.name
    return out


@router.patch("/{geofence_id}/toggle", response_model=GeofenceOut)
def toggle_geofence_admin(
    geofence_id: int,
    is_active: bool = Query(..., description="Target active state"),
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """
    Activates or deactivates an institutional geofence.
    SYSTEM_ADMIN only.
    """
    g = GeofenceService.toggle_geofence(db, geofence_id, is_active, current_user.id)
    out = GeofenceOut.from_orm(g)
    out.updater_name = current_user.name
    return out


@router.delete("/{geofence_id}")
def delete_geofence_admin(
    geofence_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """
    Soft-deletes/deactivates a campus geofence.
    SYSTEM_ADMIN only.
    """
    return GeofenceService.delete_geofence(db, geofence_id, current_user.id)


import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, Role
from app.models.campus_geofence import CampusGeofence
from app.services.geofence_service import GeofenceService
from app.schemas.geofence import GeofenceCreate, GeofenceUpdate


def test_create_and_get_circular_geofence(db_session: Session, client: TestClient, test_admin: User):
    create_data = GeofenceCreate(
        name="Main Admin Circle",
        description="Administrative block circular perimeter",
        type="circle",
        center_latitude=11.016844,
        center_longitude=76.955833,
        radius_meters=180.0,
        tolerance_meters=15.0
    )
    g = GeofenceService.create_geofence(db_session, create_data, test_admin.id)
    assert g.id is not None
    assert g.name == "Main Admin Circle"
    assert g.type == "circle"
    assert g.radius_meters == 180.0
    assert g.is_active is True

    fetched = GeofenceService.get_geofence_by_id(db_session, g.id)
    assert fetched.name == "Main Admin Circle"


def test_create_polygon_geofence(db_session: Session, test_admin: User):
    vertices = [
        [11.0160, 76.9550],
        [11.0175, 76.9550],
        [11.0175, 76.9565],
        [11.0160, 76.9565]
    ]
    create_data = GeofenceCreate(
        name="Science Block Polygon",
        description="Quad campus perimeter",
        type="polygon",
        polygon_vertices=vertices,
        tolerance_meters=10.0
    )
    g = GeofenceService.create_geofence(db_session, create_data, test_admin.id)
    assert g.id is not None
    assert g.type == "polygon"
    assert g.area_sq_meters > 100.0
    assert g.perimeter_meters > 50.0


def test_toggle_and_delete_geofence(db_session: Session, test_admin: User):
    create_data = GeofenceCreate(
        name="Temporary Sports Arena",
        type="circle",
        center_latitude=11.0180,
        center_longitude=76.9570,
        radius_meters=120.0
    )
    g = GeofenceService.create_geofence(db_session, create_data, test_admin.id)
    assert g.is_active is True

    # Toggle to Inactive
    toggled = GeofenceService.toggle_geofence(db_session, g.id, is_active=False, user_id=test_admin.id)
    assert toggled.is_active is False

    # Soft Delete
    deleted = GeofenceService.delete_geofence(db_session, g.id, user_id=test_admin.id)
    assert "deactivated successfully" in deleted["message"]

    refetched = db_session.query(CampusGeofence).filter(CampusGeofence.id == g.id).first()
    assert refetched.is_active is False

import pytest
from fastapi import HTTPException
from app.models.campus_geofence import CampusGeofence
from app.models.audit_log import AuditLog
from app.schemas.geofence import GeofenceCreate, GeofenceUpdate
from app.services.geofence_service import GeofenceService, haversine_distance_meters, compute_polygon_metrics


def test_haversine_distance_computation():
    # Coimbatore points approx 130m apart
    d = haversine_distance_meters(11.016844, 76.955833, 11.018000, 76.956000)
    assert 120.0 <= d <= 140.0


def test_compute_polygon_metrics_valid():
    # 4-point quadrilateral
    vertices = [
        [11.017000, 76.956000],
        [11.019000, 76.956000],
        [11.019000, 76.958000],
        [11.017000, 76.958000]
    ]
    c_lat, c_lon, rad, area, perim = compute_polygon_metrics(vertices)
    assert 11.0175 <= c_lat <= 11.0185
    assert 76.9565 <= c_lon <= 76.9575
    assert area > 1000.0  # Significant physical area
    assert perim > 100.0


def test_compute_polygon_metrics_invalid_fewer_vertices():
    with pytest.raises(ValueError):
        compute_polygon_metrics([[11.0, 76.0], [11.1, 76.1]])


def test_compute_polygon_metrics_zero_area():
    # Collinear points with zero area
    with pytest.raises(ValueError):
        compute_polygon_metrics([[11.0, 76.0], [11.0, 76.0], [11.0, 76.0]])


def test_create_circle_geofence_and_audit(db_session, test_admin):
    data = GeofenceCreate(
        name="Main Academic Perimeter",
        description="Main campus central area",
        type="circle",
        center_latitude=11.016844,
        center_longitude=76.955833,
        radius_meters=180.0,
        tolerance_meters=20.0
    )

    geofence = GeofenceService.create_geofence(db_session, data, user_id=test_admin.id)
    assert geofence.id is not None
    assert geofence.name == "Main Academic Perimeter"
    assert geofence.type == "circle"
    assert geofence.radius_meters == 180.0
    assert geofence.area_sq_meters > 100000.0
    assert geofence.is_active is True

    # Verify audit log
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "CREATE_CAMPUS_GEOFENCE",
        AuditLog.target_id == geofence.id
    ).first()
    assert audit is not None


def test_create_polygon_geofence(db_session, test_admin):
    vertices = [
        [11.017000, 76.956000],
        [11.019000, 76.956000],
        [11.019000, 76.958000],
        [11.017000, 76.958000]
    ]
    data = GeofenceCreate(
        name="Science Complex Polygon",
        description="Irregular science block polygon",
        type="polygon",
        polygon_vertices=vertices,
        tolerance_meters=15.0
    )

    geofence = GeofenceService.create_geofence(db_session, data, user_id=test_admin.id)
    assert geofence.id is not None
    assert geofence.type == "polygon"
    assert geofence.area_sq_meters > 1000.0
    assert geofence.perimeter_meters > 100.0


def test_create_geofence_duplicate_name_rejected(db_session, test_admin):
    data1 = GeofenceCreate(
        name="Library Block",
        type="circle",
        center_latitude=11.016,
        center_longitude=76.955,
        radius_meters=100.0
    )
    GeofenceService.create_geofence(db_session, data1, user_id=test_admin.id)

    data2 = GeofenceCreate(
        name="Library Block",
        type="circle",
        center_latitude=11.017,
        center_longitude=76.956,
        radius_meters=100.0
    )
    with pytest.raises(HTTPException) as exc:
        GeofenceService.create_geofence(db_session, data2, user_id=test_admin.id)
    assert exc.value.status_code == 400


def test_toggle_and_deactivate_geofence(db_session, test_admin):
    data = GeofenceCreate(
        name="Administrative Wing",
        type="circle",
        center_latitude=11.016,
        center_longitude=76.955,
        radius_meters=120.0
    )
    geofence = GeofenceService.create_geofence(db_session, data, user_id=test_admin.id)
    assert geofence.is_active is True

    # Deactivate
    toggled = GeofenceService.toggle_geofence(db_session, geofence.id, is_active=False, user_id=test_admin.id)
    assert toggled.is_active is False

    # Soft delete
    del_res = GeofenceService.delete_geofence(db_session, geofence.id, user_id=test_admin.id)
    assert "deactivated" in del_res["message"]

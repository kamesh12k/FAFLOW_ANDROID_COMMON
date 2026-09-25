import pytest
import uuid
from app.core.exceptions import DomainException
from app.models.campus_geofence import CampusGeofence
from app.models.staff_attendance import StaffAttendanceRecord
from app.schemas.attendance import AttendanceCheckInRequest, AttendanceCheckOutRequest
from app.schemas.geofence import GeofenceCreate
from app.services.attendance_service import AttendanceService
from app.services.geofence_service import GeofenceService


@pytest.fixture
def active_campus_geofence(db_session, test_admin):
    data = GeofenceCreate(
        name="Main Campus Geofence",
        description="Main institutional perimeter",
        type="circle",
        center_latitude=11.016844,
        center_longitude=76.955833,
        radius_meters=200.0,
        tolerance_meters=15.0
    )
    return GeofenceService.create_geofence(db_session, data, user_id=test_admin.id)


def test_successful_check_in_and_check_out(db_session, test_teacher, active_campus_geofence):
    check_in_req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=8.0,
        face_similarity_score=0.88,
        liveness_verified=True,
        verification_method="FACE_ON_DEVICE"
    )

    record = AttendanceService.check_in(db_session, test_teacher, check_in_req)
    assert record.id is not None
    assert record.user_id == test_teacher.id
    assert record.check_in_time is not None
    assert record.check_out_time is None
    assert record.status == "PRESENT"
    assert record.face_similarity_score == 0.88
    assert record.liveness_verified is True

    # Check Out
    check_out_req = AttendanceCheckOutRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=6.0,
        face_similarity_score=0.90,
        liveness_verified=True,
        verification_method="FACE_ON_DEVICE"
    )

    out_record = AttendanceService.check_out(db_session, test_teacher, check_out_req)
    assert out_record.check_out_time is not None
    assert out_record.working_hours is not None


def test_check_in_outside_geofence_rejected(db_session, test_teacher, active_campus_geofence):
    far_away_req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.050000,
        longitude=76.990000,
        accuracy_meters=5.0,
        face_similarity_score=0.85,
        liveness_verified=True
    )

    with pytest.raises(DomainException) as exc:
        AttendanceService.check_in(db_session, test_teacher, far_away_req)
    assert "outside institutional campus geofence" in str(exc.value.detail).lower()


def test_check_in_poor_gps_accuracy_rejected(db_session, test_teacher, active_campus_geofence):
    inaccurate_req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=85.0,
        face_similarity_score=0.85,
        liveness_verified=True
    )

    with pytest.raises(DomainException) as exc:
        AttendanceService.check_in(db_session, test_teacher, inaccurate_req)
    assert "accuracy" in str(exc.value.detail).lower()


def test_check_in_low_face_similarity_rejected(db_session, test_teacher, active_campus_geofence):
    low_sim_req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.45,
        liveness_verified=True
    )

    with pytest.raises(DomainException) as exc:
        AttendanceService.check_in(db_session, test_teacher, low_sim_req)
    assert "similarity score" in str(exc.value.detail).lower()


def test_check_in_failed_liveness_rejected(db_session, test_teacher, active_campus_geofence):
    failed_liveness_req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.88,
        liveness_verified=False
    )

    with pytest.raises(DomainException) as exc:
        AttendanceService.check_in(db_session, test_teacher, failed_liveness_req)
    assert "liveness" in str(exc.value.detail).lower()


def test_duplicate_check_in_rejected(db_session, test_teacher, active_campus_geofence):
    req1 = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.88,
        liveness_verified=True
    )
    AttendanceService.check_in(db_session, test_teacher, req1)

    req2 = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.88,
        liveness_verified=True
    )
    with pytest.raises(DomainException) as exc:
        AttendanceService.check_in(db_session, test_teacher, req2)
    assert "already checked in" in str(exc.value.detail).lower()


def test_idempotent_check_in_replay(db_session, test_teacher, active_campus_geofence):
    shared_key = str(uuid.uuid4())
    req = AttendanceCheckInRequest(
        idempotency_key=shared_key,
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.88,
        liveness_verified=True
    )

    res1 = AttendanceService.check_in(db_session, test_teacher, req)
    res2 = AttendanceService.check_in(db_session, test_teacher, req)
    assert res1.id == res2.id
    assert res1.check_in_time == res2.check_in_time


def test_check_out_without_check_in_rejected(db_session, test_teacher, active_campus_geofence):
    req = AttendanceCheckOutRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.88,
        liveness_verified=True
    )
    with pytest.raises(DomainException) as exc:
        AttendanceService.check_out(db_session, test_teacher, req)
    assert "no prior check-in" in str(exc.value.detail).lower()


def test_today_summary_and_my_history(db_session, test_teacher, active_campus_geofence):
    summary_before = AttendanceService.get_today_summary(db_session, test_teacher.id)
    assert summary_before.is_checked_in is False

    req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.88,
        liveness_verified=True
    )
    AttendanceService.check_in(db_session, test_teacher, req)

    summary_after = AttendanceService.get_today_summary(db_session, test_teacher.id)
    assert summary_after.is_checked_in is True
    assert summary_after.is_checked_out is False

    history = AttendanceService.list_my_history(db_session, test_teacher.id)
    assert len(history) == 1
    assert history[0].user_id == test_teacher.id


def test_supervisor_live_status_authorized(db_session, test_admin, test_teacher, active_campus_geofence):
    # Check in a teacher
    req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.88,
        liveness_verified=True
    )
    AttendanceService.check_in(db_session, test_teacher, req)

    # Admin requests supervisor live status
    status_out = AttendanceService.get_supervisor_live_status(db_session, test_admin)
    assert status_out.total_staff >= 1
    assert status_out.checked_in_count >= 1
    assert len(status_out.active_shifts) >= 1


def test_supervisor_live_status_unauthorized_teacher(db_session, test_teacher):
    # Regular teacher cannot access supervisor dashboard
    with pytest.raises(DomainException) as exc:
        AttendanceService.get_supervisor_live_status(db_session, test_teacher)
    assert exc.value.status_code == 403


def test_supervisor_live_status_endpoint_rbac_and_scoping(client, auth_headers_teacher, auth_headers_admin, db_session, test_admin, test_teacher, active_campus_geofence):
    """Verifies that regular teachers cannot access supervisor live status (403), and admins receive 200 scoped."""
    res_teacher = client.get("/attendance/admin/live-status", headers=auth_headers_teacher)
    assert res_teacher.status_code == 403

    res_admin = client.get("/attendance/admin/live-status", headers=auth_headers_admin)
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert "total_staff" in data
    assert "active_shifts" in data


def test_check_in_after_checkout_rejected(db_session, test_teacher, active_campus_geofence):
    """Verifies that attempting check-in after checkout is strictly rejected and today's summary remains checked_out."""
    # 1. Check in
    check_in_req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.88,
        liveness_verified=True
    )
    AttendanceService.check_in(db_session, test_teacher, check_in_req)

    # 2. Check out
    check_out_req = AttendanceCheckOutRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.88,
        liveness_verified=True
    )
    AttendanceService.check_out(db_session, test_teacher, check_out_req)

    # 3. Attempt second check-in -> MUST be rejected
    second_check_in = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.88,
        liveness_verified=True
    )
    with pytest.raises(DomainException) as exc:
        AttendanceService.check_in(db_session, test_teacher, second_check_in)
    assert "already checked out" in str(exc.value.detail).lower()

    # 4. GET today's summary must return checked_out=True
    summary = AttendanceService.get_today_summary(db_session, test_teacher.id)
    assert summary.is_checked_in is True
    assert summary.is_checked_out is True


def test_polygon_geofence_check_in_authorized(db_session, test_teacher, test_admin):
    """Verifies that an employee inside a polygon geofence perimeter is authorized for check-in."""
    vertices = [
        [12.9710, 77.5940],
        [12.9730, 77.5940],
        [12.9730, 77.5960],
        [12.9710, 77.5960]
    ]
    poly_data = GeofenceCreate(
        name="Bangalore Center Polygon",
        description="Institutional polygon campus perimeter",
        type="polygon",
        polygon_vertices=vertices,
        tolerance_meters=10.0
    )
    poly_geofence = GeofenceService.create_geofence(db_session, poly_data, user_id=test_admin.id)

    # Point clearly inside polygon: (12.9720, 77.5950)
    inside_req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=12.9720,
        longitude=77.5950,
        accuracy_meters=5.0,
        face_similarity_score=0.92,
        liveness_verified=True,
        verification_method="FACE_ON_DEVICE"
    )
    record = AttendanceService.check_in(db_session, test_teacher, inside_req)
    assert record.id is not None
    assert record.check_in_geofence_name == "Bangalore Center Polygon"


def test_check_in_no_geofences_fails_closed(db_session, test_teacher):
    """Verifies that if no active geofences exist in the database, attendance FAILS CLOSED."""
    # Deactivate any existing geofences
    all_geofences = GeofenceService.list_geofences(db_session, is_active_only=False)
    for g in all_geofences:
        g.is_active = False
    db_session.commit()

    req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.90,
        liveness_verified=True
    )

    with pytest.raises(DomainException) as exc:
        AttendanceService.check_in(db_session, test_teacher, req)
    assert "no active campus geofence configured" in str(exc.value.detail).lower()


def test_delete_attendance_record_service_and_audit(db_session, test_teacher, test_admin, active_campus_geofence):
    """Verifies that an admin can delete an individual attendance record and an audit log is created."""
    check_in_req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.89,
        liveness_verified=True,
        verification_method="FACE_ON_DEVICE"
    )
    record = AttendanceService.check_in(db_session, test_teacher, check_in_req)
    record_id = record.id

    # Verify deletion by admin
    result = AttendanceService.delete_record(db_session, record_id, test_admin)
    assert result["success"] is True
    assert result["details"]["record_id"] == record_id

    # Verify record no longer exists
    assert db_session.query(StaffAttendanceRecord).filter(StaffAttendanceRecord.id == record_id).first() is None


def test_delete_attendance_record_not_found(db_session, test_admin):
    """Verifies that attempting to delete a non-existent attendance record raises a 404 error."""
    with pytest.raises(DomainException) as exc:
        AttendanceService.delete_record(db_session, 999999, test_admin)
    assert exc.value.status_code == 404


def test_delete_attendance_record_api_endpoint_rbac(client, auth_headers_teacher, auth_headers_admin, db_session, test_teacher, test_admin, active_campus_geofence):
    """Verifies that teacher is forbidden (403) from deleting attendance records, while admin succeeds (200)."""
    check_in_req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.91,
        liveness_verified=True,
        verification_method="FACE_ON_DEVICE"
    )
    record = AttendanceService.check_in(db_session, test_teacher, check_in_req)
    record_id = record.id

    # 1. Teacher attempt -> 403 Forbidden
    res_teacher = client.delete(f"/attendance/admin/record/{record_id}", headers=auth_headers_teacher)
    assert res_teacher.status_code == 403

    # 2. Admin attempt -> 200 OK
    res_admin = client.delete(f"/attendance/admin/record/{record_id}", headers=auth_headers_admin)
    assert res_admin.status_code == 200
    assert res_admin.json()["success"] is True

def test_offline_sync_captured_at_timestamp_preserved(db_session, test_teacher, active_campus_geofence):
    """Verifies that an offline-synced check-in and check-out preserves the original captured_at time."""
    from datetime import datetime, timezone, timedelta
    past_check_in = datetime.now(timezone.utc) - timedelta(hours=2)
    past_check_out = datetime.now(timezone.utc) - timedelta(hours=1)

    check_in_req = AttendanceCheckInRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.92,
        liveness_verified=True,
        verification_method="FACE_ON_DEVICE",
        captured_at=past_check_in
    )

    rec = AttendanceService.check_in(db_session, test_teacher, check_in_req)
    assert rec.check_in_time.replace(microsecond=0) == past_check_in.replace(microsecond=0)

    # Check out with captured_at
    check_out_req = AttendanceCheckOutRequest(
        idempotency_key=str(uuid.uuid4()),
        latitude=11.016844,
        longitude=76.955833,
        accuracy_meters=5.0,
        face_similarity_score=0.92,
        liveness_verified=True,
        verification_method="FACE_ON_DEVICE",
        captured_at=past_check_out
    )
    out_rec = AttendanceService.check_out(db_session, test_teacher, check_out_req)
    assert out_rec.check_out_time.replace(microsecond=0) == past_check_out.replace(microsecond=0)
    assert "1h 0m" in out_rec.working_hours





import pytest
import uuid
from app.core.exceptions import DomainException
from app.models.campus_geofence import CampusGeofence
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

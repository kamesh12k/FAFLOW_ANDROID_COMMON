import io
import pytest
from fastapi import HTTPException
from app.models.user import Role
from app.models.announcement import AnnouncementType, AnnouncementPriority
from app.schemas.announcement import AnnouncementCreateIn, CompleteAttachmentIn
from app.services import announcement_service
from app.services.storage_service import (
    validate_file_metadata, validate_file_magic_bytes,
    sanitize_filename, LocalStorageBackend
)
from tests.conftest import _make_user


def test_hod_cannot_target_another_department(db_session):
    cs_hod = _make_user(db_session, name="CS HOD", role=Role.admin, department="CS", username="cshod_sec")
    ee_dept = _make_user(db_session, name="EE Faculty", role=Role.teacher, department="EE", email="ee_sec@test.com")

    # Attempt targeting EE department with CS HOD account
    data = AnnouncementCreateIn(
        title="Unauthorized Notice",
        body="Trying to notify EE department.",
        type=AnnouncementType.NOTICE,
        target_type="DEPARTMENT",
        department_ids=[ee_dept.department_id],
        publish_now=True,
    )

    with pytest.raises(HTTPException) as exc:
        announcement_service.create_announcement(db_session, cs_hod, data)
    assert exc.value.status_code == 403
    assert "cannot target a foreign department" in str(exc.value.detail).lower()


def test_hod_cannot_target_foreign_faculty_members(db_session):
    cs_hod = _make_user(db_session, name="CS HOD", role=Role.admin, department="CS", username="cshod_fac")
    ee_teacher = _make_user(db_session, name="EE Teacher", role=Role.teacher, department="EE", email="ee_teach@test.com")

    data = AnnouncementCreateIn(
        title="Unauthorized User Target",
        body="Trying to message EE teacher directly.",
        type=AnnouncementType.NOTICE,
        target_type="USER",
        user_ids=[ee_teacher.id],
        publish_now=True,
    )

    with pytest.raises(HTTPException) as exc:
        announcement_service.create_announcement(db_session, cs_hod, data)
    assert exc.value.status_code == 403
    assert "outside your department" in str(exc.value.detail).lower()


def test_faculty_cannot_publish_announcements(db_session):
    teacher = _make_user(db_session, name="Regular Teacher", role=Role.teacher, email="faculty_sec@test.com")

    data = AnnouncementCreateIn(
        title="Illegal Notice",
        body="Teachers cannot broadcast announcements.",
        type=AnnouncementType.NOTICE,
        target_type="COLLEGE",
        publish_now=True,
    )

    with pytest.raises(HTTPException) as exc:
        announcement_service.create_announcement(db_session, teacher, data)
    assert exc.value.status_code == 403
    assert "do not have permission" in str(exc.value.detail).lower()


def test_hod_cannot_target_entire_college(db_session):
    cs_hod = _make_user(db_session, name="CS HOD", role=Role.admin, department="CS", username="cshod_all")

    data = AnnouncementCreateIn(
        title="Broad Notice",
        body="Trying to notify entire college as HOD.",
        type=AnnouncementType.NOTICE,
        target_type="COLLEGE",
        publish_now=True,
    )

    with pytest.raises(HTTPException) as exc:
        announcement_service.create_announcement(db_session, cs_hod, data)
    assert exc.value.status_code == 403
    assert "college-wide" in str(exc.value.detail).lower()


def test_file_validation_rejects_executables_and_bad_extensions():
    # Executable extension
    with pytest.raises(HTTPException) as exc:
        validate_file_metadata("malicious.exe", "application/x-msdownload", 1024)
    assert exc.value.status_code == 400

    # Shell script
    with pytest.raises(HTTPException) as exc2:
        validate_file_metadata("exploit.sh", "application/x-sh", 1024)
    assert exc2.value.status_code == 400

    # Oversized file
    with pytest.raises(HTTPException) as exc3:
        validate_file_metadata("huge.pdf", "application/pdf", 100 * 1024 * 1024)
    assert exc3.value.status_code == 400


def test_file_validation_rejects_mime_spoofing():
    # A file named "document.pdf" but containing PE/EXE header
    fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00"
    assert validate_file_magic_bytes(fake_pdf, "application/pdf") is False

    # Valid PDF magic bytes
    real_pdf = b"%PDF-1.7\r\n..."
    assert validate_file_magic_bytes(real_pdf, "application/pdf") is True

    # Valid PNG magic bytes
    real_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    assert validate_file_magic_bytes(real_png, "image/png") is True

    # Valid JPEG magic bytes
    real_jpeg = b"\xFF\xD8\xFF\xE0\x00\x10JFIF"
    assert validate_file_magic_bytes(real_jpeg, "image/jpeg") is True


def test_filename_sanitization_prevents_path_traversal():
    traversal_input = "../../../etc/passwd.pdf"
    safe = sanitize_filename(traversal_input)
    assert ".." not in safe
    assert "/" not in safe
    assert "\\" not in safe
    assert safe.endswith(".pdf")

    windows_traversal = "C:\\Windows\\System32\\cmd.exe"
    safe2 = sanitize_filename(windows_traversal)
    assert ":" not in safe2
    assert "\\" not in safe2
    assert safe2 == "cmd.exe"

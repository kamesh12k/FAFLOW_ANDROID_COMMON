import pytest
from app.models.user import Role
from tests.conftest import _make_user, make_auth_headers


def test_announcement_api_lifecycle(client, db_session):
    principal = _make_user(db_session, name="Principal User", role=Role.principal, username="princ_api")
    teacher = _make_user(db_session, name="Teacher User", role=Role.teacher, email="teacher_api@college.edu", department="CS")

    p_headers = make_auth_headers(principal)
    t_headers = make_auth_headers(teacher)

    # 1. Get candidate directory
    resp = client.get("/announcements/candidates", headers=p_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "departments" in data
    assert "faculty" in data

    # 2. Create announcement as Principal
    create_payload = {
        "title": "Semester Examination Circular",
        "body": "The semester examinations will commence on October 15. Attendance is mandatory.",
        "type": "CIRCULAR",
        "priority": "HIGH",
        "target_type": "COLLEGE",
        "publish_now": True,
        "requires_acknowledgement": True,
        "allow_replies": True,
        "allow_reactions": True,
    }
    resp = client.post("/announcements", json=create_payload, headers=p_headers)
    assert resp.status_code == 201
    announcement = resp.json()
    aid = announcement["id"]
    assert announcement["title"] == "Semester Examination Circular"
    assert announcement["status"] == "PUBLISHED"

    # 3. Teacher fetches feed
    resp = client.get("/announcements", headers=t_headers)
    assert resp.status_code == 200
    feed = resp.json()
    assert len(feed) >= 1
    found = [item for item in feed if item["id"] == aid][0]
    assert found["is_read"] is False
    assert found["is_acknowledged"] is False

    # 4. Teacher views detail (auto-marks read)
    resp = client.get(f"/announcements/{aid}", headers=t_headers)
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["is_read"] is True
    assert detail["is_acknowledged"] is False
    assert detail["can_acknowledge"] is True

    # 5. Teacher acknowledges
    resp = client.post(f"/announcements/{aid}/acknowledge", headers=t_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # 6. Teacher posts message
    msg_payload = {
        "content": "Noted with thanks.",
    }
    resp = client.post(f"/announcements/{aid}/messages", json=msg_payload, headers=t_headers)
    assert resp.status_code == 201
    msg = resp.json()
    mid = msg["id"]
    assert msg["content"] == "Noted with thanks."

    # 7. Teacher reacts with 👍
    rx_payload = {"reaction": "👍"}
    resp = client.post(f"/announcements/messages/{mid}/reactions", json=rx_payload, headers=t_headers)
    assert resp.status_code == 200
    rx_data = resp.json()
    assert rx_data["reaction"] == "👍"
    assert rx_data["count"] == 1
    assert rx_data["has_reacted"] is True

    # 8. Principal checks analytics
    resp = client.get(f"/announcements/{aid}/analytics", headers=p_headers)
    assert resp.status_code == 200
    analytics = resp.json()
    assert analytics["total_recipients"] >= 1
    assert analytics["viewed_count"] >= 1
    assert analytics["acknowledged_count"] >= 1
    assert analytics["acknowledgement_rate_pct"] > 0

    # 9. Teacher discovers mention candidates via dedicated endpoint
    cand_resp = client.get(f"/announcements/{aid}/mention-candidates", headers=t_headers)
    assert cand_resp.status_code == 200
    cands = cand_resp.json()
    assert isinstance(cands, list)
    assert len(cands) >= 1
    names = [c["name"] for c in cands]
    assert "Teacher User" in names

    # 10. Search with query parameter
    search_resp = client.get(f"/announcements/{aid}/mention-candidates?q=principal", headers=t_headers)
    assert search_resp.status_code == 200
    search_cands = search_resp.json()
    assert any(c["name"] == "Principal User" for c in search_cands)


def test_mention_candidates_department_isolation_and_security(client, db_session):
    from app.models.department import Department

    # HOD and Teacher of CSE
    hod_cse = _make_user(db_session, name="HOD CSE Admin", email="hod_cse_iso@test.com", username="hod_cse_iso", role=Role.admin, department="CSE_SEC")
    teacher_cse = _make_user(db_session, name="Teacher CSE Staff", email="teacher_cse_iso@test.com", username="teacher_cse_iso", role=Role.teacher, department="CSE_SEC")

    # HOD and Teacher of ECE (foreign department)
    hod_ece = _make_user(db_session, name="HOD ECE Admin", email="hod_ece_iso@test.com", username="hod_ece_iso", role=Role.admin, department="ECE_SEC")
    teacher_ece = _make_user(db_session, name="Teacher ECE Staff", email="teacher_ece_iso@test.com", username="teacher_ece_iso", role=Role.teacher, department="ECE_SEC")

    dept_cse = db_session.query(Department).filter(Department.name == "CSE_SEC").first()

    hod_cse_headers = make_auth_headers(hod_cse)
    teacher_cse_headers = make_auth_headers(teacher_cse)
    teacher_ece_headers = make_auth_headers(teacher_ece)

    # 1. HOD CSE creates CSE-department announcement
    create_payload = {
        "title": "CSE Department Internal Notice",
        "body": "All CSE department faculty please attend.",
        "type": "CIRCULAR",
        "priority": "HIGH",
        "target_type": "DEPARTMENT",
        "publish_now": True,
        "allow_replies": True,
        "target_department_ids": [dept_cse.id] if dept_cse else [],
    }
    resp = client.post("/announcements", json=create_payload, headers=hod_cse_headers)
    assert resp.status_code == 201
    aid = resp.json()["id"]

    # 2. Teacher CSE can get mention candidates, but only CSE faculty
    cands_resp = client.get(f"/announcements/{aid}/mention-candidates", headers=teacher_cse_headers)
    assert cands_resp.status_code == 200
    cands = cands_resp.json()
    cands_names = [c["name"] for c in cands]
    assert any("CSE" in n for n in cands_names)
    assert "Teacher ECE Staff" not in cands_names
    assert "HOD ECE Admin" not in cands_names

    # 3. Even if Teacher CSE searches specifically for "?q=ECE", foreign faculty are NOT returned
    search_resp = client.get(f"/announcements/{aid}/mention-candidates?q=ECE", headers=teacher_cse_headers)
    assert search_resp.status_code == 200
    search_cands = search_resp.json()
    assert len(search_cands) == 0

    # 4. Teacher ECE (unauthorized user from foreign department) cannot view or get mention candidates for CSE announcement
    foreign_resp = client.get(f"/announcements/{aid}/mention-candidates", headers=teacher_ece_headers)
    assert foreign_resp.status_code in (403, 404)


def test_attachment_upload_stream_pdf_and_images(client, db_session):
    admin = _make_user(db_session, name="Admin Att", email="admin_att@test.com", username="admin_att", role=Role.admin)
    headers = make_auth_headers(admin)

    # 1. Presign and upload PDF
    pdf_content = b"%PDF-1.4 test pdf content here"
    presign_pdf = client.post("/announcements/attachments/presign", json={
        "file_name": "circular.pdf",
        "file_type": "application/pdf",
        "file_size": len(pdf_content),
    }, headers=headers)
    assert presign_pdf.status_code == 200
    pdf_data = presign_pdf.json()
    upload_url_pdf = pdf_data["upload_url"]

    upload_pdf = client.post(
        upload_url_pdf.replace("/api", ""),
        files={"file": ("circular.pdf", pdf_content, "application/pdf")}
    )
    assert upload_pdf.status_code == 200

    # 2. Presign and upload PNG
    png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 20
    presign_png = client.post("/announcements/attachments/presign", json={
        "file_name": "photo.png",
        "file_type": "image/png",
        "file_size": len(png_content),
    }, headers=headers)
    assert presign_png.status_code == 200
    png_data = presign_png.json()
    upload_url_png = png_data["upload_url"]

    upload_png = client.post(
        upload_url_png.replace("/api", ""),
        files={"file": ("photo.png", png_content, "image/png")}
    )
    assert upload_png.status_code == 200

    # 3. Presign and upload JPEG
    jpeg_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00" + b"\x00" * 20
    presign_jpeg = client.post("/announcements/attachments/presign", json={
        "file_name": "photo.jpg",
        "file_type": "image/jpeg",
        "file_size": len(jpeg_content),
    }, headers=headers)
    assert presign_jpeg.status_code == 200
    jpeg_data = presign_jpeg.json()
    upload_url_jpeg = jpeg_data["upload_url"]

    upload_jpeg = client.post(
        upload_url_jpeg.replace("/api", ""),
        files={"file": ("photo.jpg", jpeg_content, "image/jpeg")}
    )
    assert upload_jpeg.status_code == 200



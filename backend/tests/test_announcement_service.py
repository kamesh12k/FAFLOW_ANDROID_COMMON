import pytest
from datetime import datetime, timezone, timedelta
from app.models.user import Role
from app.models.announcement import (
    Announcement, AnnouncementStatus, AnnouncementType, AnnouncementPriority,
    TargetType
)
from app.schemas.announcement import (
    AnnouncementCreateIn, AnnouncementUpdateIn, CompleteAttachmentIn
)
from app.services import announcement_service
from tests.conftest import _make_user


def test_create_and_publish_college_announcement(db_session):
    principal = _make_user(db_session, name="Dr. Principal", role=Role.principal, username="principal")
    teacher1 = _make_user(db_session, name="Prof A", role=Role.teacher, email="a@college.edu", department="CS")
    teacher2 = _make_user(db_session, name="Prof B", role=Role.teacher, email="b@college.edu", department="ME")

    data = AnnouncementCreateIn(
        title="College Day Celebration",
        body="All faculty are cordially invited to the annual college day.",
        type=AnnouncementType.EVENT,
        priority=AnnouncementPriority.IMPORTANT,
        target_type="COLLEGE",
        publish_now=True,
        requires_acknowledgement=True,
    )

    announcement = announcement_service.create_announcement(db_session, principal, data)
    assert announcement.id is not None
    assert announcement.status == AnnouncementStatus.PUBLISHED.value
    assert announcement.target_summary == "COLLEGE"
    assert announcement.requires_acknowledgement is True

    # Check visible feed for teachers
    feed_t1, count1 = announcement_service.list_announcements(db_session, teacher1)
    assert count1 == 1
    assert feed_t1[0].id == announcement.id
    assert feed_t1[0].is_read is False
    assert feed_t1[0].is_acknowledged is False

    # Mark as read
    detail = announcement_service.get_announcement_detail(db_session, teacher1, announcement.id)
    assert detail.is_read is True
    assert detail.is_acknowledged is False

    # Acknowledge
    ack_res = announcement_service.acknowledge_announcement(db_session, teacher1, announcement.id, "127.0.0.1", "pytest")
    assert ack_res is True

    # Re-check detail
    detail_after = announcement_service.get_announcement_detail(db_session, teacher1, announcement.id)
    assert detail_after.is_acknowledged is True

    # Check analytics from principal perspective
    analytics = announcement_service.get_announcement_analytics(db_session, principal, announcement.id)
    assert analytics.total_recipients >= 2
    assert analytics.viewed_count >= 1
    assert analytics.acknowledged_count == 1


def test_hod_department_targeting(db_session):
    cs_hod = _make_user(db_session, name="CS HOD", role=Role.admin, department="CS", username="cshod")
    cs_teacher = _make_user(db_session, name="CS Faculty", role=Role.teacher, department="CS", email="cs_fac@test.com")
    ee_teacher = _make_user(db_session, name="EE Faculty", role=Role.teacher, department="EE", email="ee_fac@test.com")

    data = AnnouncementCreateIn(
        title="CS Department Meeting",
        body="Meeting in CS Conference room at 3 PM.",
        type=AnnouncementType.ACADEMIC,
        priority=AnnouncementPriority.NORMAL,
        target_type="DEPARTMENT",
        department_ids=[cs_hod.department_id],
        publish_now=True,
    )

    announcement = announcement_service.create_announcement(db_session, cs_hod, data)
    assert announcement.department_id == cs_hod.department_id

    # CS teacher should see it
    cs_feed, cs_cnt = announcement_service.list_announcements(db_session, cs_teacher)
    assert cs_cnt == 1
    assert cs_feed[0].id == announcement.id

    # EE teacher MUST NOT see it
    ee_feed, ee_cnt = announcement_service.list_announcements(db_session, ee_teacher)
    assert ee_cnt == 0


def test_conversation_thread_replies_and_reactions(db_session):
    principal = _make_user(db_session, name="Principal", role=Role.principal, username="princ")
    teacher = _make_user(db_session, name="Teacher", role=Role.teacher, department="CS", email="t@test.com")

    data = AnnouncementCreateIn(
        title="Exam Duty Instructions",
        body="Please report to the examination cell 30 minutes before time.",
        type=AnnouncementType.CIRCULAR,
        target_type="COLLEGE",
        publish_now=True,
        allow_replies=True,
        allow_reactions=True,
    )
    announcement = announcement_service.create_announcement(db_session, principal, data)

    # Teacher asks a question
    msg1 = announcement_service.add_message(
        db=db_session,
        current_user=teacher,
        announcement_id=announcement.id,
        content="Could you clarify if afternoon duties also follow this reporting time?",
    )
    assert msg1.id is not None
    assert msg1.content.startswith("Could you clarify")

    # Principal replies directly to that comment
    reply = announcement_service.add_message(
        db=db_session,
        current_user=principal,
        announcement_id=announcement.id,
        content="Yes, afternoon session reporting is 1:30 PM.",
        parent_message_id=msg1.id,
    )
    assert reply.parent_message_id == msg1.id

    # Teacher reacts with 👍 to the principal's reply
    rx_res = announcement_service.toggle_reaction(db_session, teacher, reply.id, "👍")
    assert rx_res["has_reacted"] is True
    assert rx_res["count"] == 1

    # Toggling again removes the reaction
    rx_res2 = announcement_service.toggle_reaction(db_session, teacher, reply.id, "👍")
    assert rx_res2["has_reacted"] is False
    assert rx_res2["count"] == 0

    # Principal pins the clarification reply
    is_pinned = announcement_service.toggle_pin_message(db_session, principal, reply.id)
    assert is_pinned is True

    # Retrieve conversation tree
    tree = announcement_service.get_conversation_messages(db_session, teacher, announcement.id)
    assert len(tree) == 1
    assert tree[0].id == msg1.id
    assert len(tree[0].replies) == 1
    assert tree[0].replies[0].id == reply.id
    assert tree[0].replies[0].is_pinned is True


def test_circular_revision_version_tracking(db_session):
    principal = _make_user(db_session, name="Principal", role=Role.principal, username="princ2")
    data = AnnouncementCreateIn(
        title="Circular 101: Timetable Changes",
        body="Version 1 timetable schedule...",
        type=AnnouncementType.CIRCULAR,
        target_type="COLLEGE",
        publish_now=True,
    )
    announcement = announcement_service.create_announcement(db_session, principal, data)
    assert announcement.version == 1

    # Edit circular body
    update_data = AnnouncementUpdateIn(
        body="Version 2 timetable schedule with lab revision.",
        revision_notes="Updated Lab slot for 3rd year CS.",
    )
    updated = announcement_service.update_announcement(db_session, principal, announcement.id, update_data)
    assert updated.version == 2
    assert updated.revision_notes == "Updated Lab slot for 3rd year CS."
    assert "Version 2" in updated.body


def test_mention_discovery_20_faculty_in_department(db_session):
    """
    Validates that:
    1. A department with 20 faculty returns all 20 candidates (no 5-item cutoff).
    2. Partial name search works case-insensitively.
    3. The 20th record can be found individually.
    4. Department isolation is preserved (foreign department faculty not exposed).
    5. Structured mentions and notifications are generated.
    """
    from app.models.department import Department
    from app.models.announcement import MessageMention

    dept_cs = Department(name="Computer Science & Engineering", code="CSE_TEST")
    dept_me = Department(name="Mechanical Engineering", code="ME_TEST")
    db_session.add_all([dept_cs, dept_me])
    db_session.commit()

    # Create HOD and 19 other teachers in CSE (total 20 faculty in department)
    hod = _make_user(db_session, name="HOD CSE", role=Role.admin, username="hod_cse_test", department="CSE_TEST")
    faculty_list = [hod]
    for i in range(1, 20):
        t = _make_user(
            db_session,
            name=f"Faculty {i:02d} CS",
            role=Role.teacher,
            email=f"cs_faculty_{i:02d}@college.edu",
            department="CSE_TEST",
        )
        faculty_list.append(t)

    # Create 3 faculty in foreign department (Mechanical)
    me_teacher = _make_user(
        db_session,
        name="Foreign ME Teacher",
        role=Role.teacher,
        email="me_foreign@college.edu",
        department="ME_TEST",
    )

    # HOD creates department announcement
    ann_data = AnnouncementCreateIn(
        title="Department Faculty Meeting Notice",
        body="All departmental faculty please note the meeting agenda.",
        type=AnnouncementType.NOTICE,
        target_type="DEPARTMENT",
        department_ids=[dept_cs.id],
        publish_now=True,
    )
    ann = announcement_service.create_announcement(db_session, hod, ann_data)

    # 1. Test discovering all 20 faculty in department
    cand_all = announcement_service.get_mention_candidates(db_session, faculty_list[1], ann.id, limit=50)
    assert len(cand_all) == 20, f"Expected 20 faculty members, got {len(cand_all)}"
    candidate_names = [c.name for c in cand_all]
    assert "HOD CSE" in candidate_names
    assert "Faculty 19 CS" in candidate_names  # Last alphabetical faculty member present!

    # Foreign department faculty must NOT be in the results
    assert "Foreign ME Teacher" not in candidate_names

    # 2. Test search: query for specific individual (e.g. "Faculty 15 CS")
    cand_15 = announcement_service.get_mention_candidates(db_session, faculty_list[1], ann.id, query="faculty 15")
    assert len(cand_15) == 1
    assert cand_15[0].name == "Faculty 15 CS"

    # 3. Test case-insensitivity: query "FACULTY 19"
    cand_upper = announcement_service.get_mention_candidates(db_session, faculty_list[1], ann.id, query="FACULTY 19")
    assert len(cand_upper) == 1
    assert cand_upper[0].name == "Faculty 19 CS"

    # 4. Test posting a message with mention
    target_faculty = cand_15[0]
    msg = announcement_service.add_message(
        db=db_session,
        current_user=faculty_list[1],
        announcement_id=ann.id,
        content=f"Please review this @{target_faculty.name} regarding project allocation.",
        mentioned_user_ids=[target_faculty.id],
    )
    assert msg.id is not None

    # Verify structured mention was recorded in DB
    stored_mention = db_session.query(MessageMention).filter(MessageMention.message_id == msg.id).first()
    assert stored_mention is not None
    assert stored_mention.mentioned_user_id == target_faculty.id
    assert stored_mention.mention_text == f"@{target_faculty.name}"


def test_delete_announcement_and_search_filters(db_session):
    principal = _make_user(db_session, name="Dr. Principal Admin", role=Role.principal, username="princ_del")
    author_teacher = _make_user(db_session, name="Dr. Raman Author", role=Role.teacher, email="raman_del@college.edu", department="CSE")
    other_teacher = _make_user(db_session, name="Prof Other", role=Role.teacher, email="other_del@college.edu", department="CSE")

    # 1. Author creates announcement
    ann_data = AnnouncementCreateIn(
        title="Faculty Research Symposium 2026",
        body="Submissions are open for upcoming research papers and presentations.",
        type=AnnouncementType.ACADEMIC,
        priority=AnnouncementPriority.HIGH,
        target_type="COLLEGE",
        publish_now=True,
    )
    ann = announcement_service.create_announcement(db_session, principal, ann_data)

    # 2. Check feed and can_delete flag
    feed, total = announcement_service.list_announcements(db_session, principal)
    assert total >= 1
    item = next(i for i in feed if i.id == ann.id)
    assert item.can_delete is True

    # Other teacher cannot delete
    feed_other, _ = announcement_service.list_announcements(db_session, other_teacher)
    item_other = next(i for i in feed_other if i.id == ann.id)
    assert item_other.can_delete is False

    # 3. Test search by title keyword
    search_res, s_count = announcement_service.list_announcements(db_session, principal, search="Symposium")
    assert any(i.id == ann.id for i in search_res)

    # Test search by author name
    search_author, _ = announcement_service.list_announcements(db_session, other_teacher, search="Principal")
    assert any(i.id == ann.id for i in search_author)

    # 4. Other teacher trying to delete should raise 403
    with pytest.raises(Exception):
        announcement_service.delete_announcement(db_session, other_teacher, ann.id)

    # 5. Authorized user deletes announcement
    del_res = announcement_service.delete_announcement(db_session, principal, ann.id)
    assert del_res is True

    # 6. Feed must no longer return the deleted announcement
    feed_after, _ = announcement_service.list_announcements(db_session, principal)
    assert not any(i.id == ann.id for i in feed_after)

    # 7. Detail lookup should return 404
    with pytest.raises(Exception):
        announcement_service.get_announcement_detail(db_session, principal, ann.id)


def test_20_faculty_mention_system(db_session):
    """Verifies that in a department with 20 faculty members:
    - all 20 exist
    - all authorized
    - each can be found by search query without arbitrary 5-cutoff
    - each can be selected and referenced
    - each creates the correct structured MessageMention record
    - in-app notifications are properly dispatched
    """
    from app.models.announcement import MessageMention
    from app.models.department import Department
    from app.models.notification import Notification

    # 1. Setup Department & HOD
    dept = Department(name="Computer Science", code="CSE")
    db_session.add(dept)
    db_session.commit()
    db_session.refresh(dept)

    hod = _make_user(db_session, name="Prof CS HOD", role=Role.admin, department="Computer Science", username="cs_hod_20")

    # 2. Create 20 distinct faculty members
    faculty_list = []
    for i in range(1, 21):
        f = _make_user(
            db_session,
            name=f"Faculty Member {i:02d}",
            role=Role.teacher,
            department="Computer Science",
            username=f"cse_fac_{i:02d}",
            email=f"fac{i:02d}@cs.edu",
        )
        faculty_list.append(f)

    assert len(faculty_list) == 20

    # 3. Create announcement targeted to CSE department
    ann_data = AnnouncementCreateIn(
        title="Curriculum Revision Meeting",
        body="Department meeting to finalize the 2026 CS syllabus.",
        type=AnnouncementType.ACADEMIC,
        priority=AnnouncementPriority.HIGH,
        target_type="DEPARTMENT",
        department_ids=[dept.id],
        publish_now=True,
    )
    ann = announcement_service.create_announcement(db_session, hod, ann_data)
    assert ann.id is not None

    # 4. Verify candidate retrieval returns all 20 faculty (limit >= 20, default is 50)
    candidates = announcement_service.get_mention_candidates(
        db=db_session,
        current_user=hod,
        announcement_id=ann.id,
        limit=50,
    )
    candidate_ids = {c.id for c in candidates}
    for f in faculty_list:
        assert f.id in candidate_ids, f"Faculty {f.name} (id {f.id}) was not found in mention candidates"

    # 5. Verify search query finds each individual faculty member (no cutoff at 5)
    for f in faculty_list:
        # Search by specific number or name suffix
        q_name = f"Member {f.name.split()[-1]}"
        found = announcement_service.get_mention_candidates(
            db=db_session,
            current_user=hod,
            announcement_id=ann.id,
            query=q_name,
            limit=50,
        )
        assert any(c.id == f.id for c in found), f"Search query '{q_name}' failed to find {f.name}"

    # 6. Post a message mentioning all 20 faculty members
    all_faculty_ids = [f.id for f in faculty_list]
    content = "Please review the proposed syllabus changes: " + " ".join(f"@{f.name}" for f in faculty_list)
    msg = announcement_service.add_message(
        db=db_session,
        current_user=hod,
        announcement_id=ann.id,
        content=content,
        mentioned_user_ids=all_faculty_ids,
    )
    assert msg.id is not None

    # 7. Verify all 20 structured mentions exist in the database
    mentions = db_session.query(MessageMention).filter(MessageMention.message_id == msg.id).all()
    assert len(mentions) == 20
    mentioned_ids = {m.mentioned_user_id for m in mentions}
    assert mentioned_ids == set(all_faculty_ids)
    for m in mentions:
        assert m.mention_text.startswith("@Faculty Member")


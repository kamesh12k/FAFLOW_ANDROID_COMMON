from __future__ import annotations
import re
import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import or_, and_, func, distinct

from app.models.user import User, Role
from app.models.department import Department
from app.models.audit_log import AuditLog
from app.models.announcement import (
    Announcement, AnnouncementTarget, AnnouncementAttachment,
    AnnouncementRead, AnnouncementAcknowledgement, AnnouncementMessage,
    MessageReaction, MessageMention, AnnouncementType, AnnouncementPriority,
    AnnouncementStatus, TargetType
)
from app.schemas.announcement import (
    AnnouncementCreateIn, AnnouncementUpdateIn, CompleteAttachmentIn,
    AnnouncementAnalyticsOut, RecipientStatItem, CandidateDirectoryOut,
    CandidateFacultyItem, ReactionOut, MentionOut, MessageOut,
    AnnouncementListItemOut, AnnouncementDetailOut, TargetOut, AttachmentOut
)
from app.services.storage_service import storage_service
from app.services import notification_service

logger = logging.getLogger(__name__)


def _is_future(dt: Optional[datetime]) -> bool:
    """Safely checks whether a datetime is in the future across offset-naive and offset-aware formats."""
    if dt is None:
        return False
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt > now


def log_audit_action(
    db: Session,
    actor: User,
    action: str,
    target_type: str,
    target_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    try:
        audit = AuditLog(
            actor_user_id=actor.id,
            department_id=actor.department_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details or {},
        )
        db.add(audit)
        db.flush()
    except Exception as e:
        logger.warning("Could not record audit log: %s", e)


def can_manage_announcements(user: User) -> bool:
    """True if user role has publishing/creation rights."""
    return user.role in (Role.principal, Role.system_admin, Role.admin)


def can_user_modify_announcement(announcement: Announcement, current_user: User) -> bool:
    """Checks whether current_user has permission to edit or delete the given announcement."""
    if not announcement or not current_user:
        return False
    # Author can always modify their own announcement
    if announcement.created_by_id == current_user.id:
        return True
    # Principal, System Admin, and Governance have institution-wide authority
    if current_user.role in (Role.principal, Role.system_admin, Role.governance):
        return True
    # College-wide Admin (Role.admin with no specific department_id)
    if current_user.role == Role.admin and current_user.department_id is None:
        return True
    # Department HOD (Role.admin with department_id)
    if current_user.role == Role.admin and current_user.department_id is not None:
        target_dept_ids = {t.department_id for t in announcement.targets if t.department_id is not None}
        if announcement.department_id:
            target_dept_ids.add(announcement.department_id)
        if announcement.department_id == current_user.department_id or current_user.department_id in target_dept_ids:
            return True
    return False


def validate_target_permissions(
    db: Session,
    current_user: User,
    target_type: str,
    department_ids: List[int],
    user_ids: List[int],
) -> Tuple[str, List[int], List[int]]:
    """Enforces strict server-side authorization on targeting.
    - Principal & System Admin: Any target permitted.
    - HOD (admin): Can only target their own department or teachers within their department.
    - Teacher/Staff: Cannot publish announcements.
    """
    if not can_manage_announcements(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create or publish announcements.",
        )

    t_type = target_type.upper().strip()

    # Principal & System Admin have college-wide privileges
    if current_user.role in (Role.principal, Role.system_admin):
        if t_type == "COLLEGE":
            return "COLLEGE", [], []
        elif t_type in ("DEPARTMENT", "MULTIPLE_DEPARTMENTS"):
            if not department_ids:
                raise HTTPException(status_code=400, detail="Please select at least one department.")
            return "DEPARTMENT", department_ids, []
        elif t_type in ("USER", "MULTIPLE_USERS"):
            if not user_ids:
                raise HTTPException(status_code=400, detail="Please select at least one recipient.")
            return "USER", [], user_ids
        return "COLLEGE", [], []

    # HOD (admin with department_id)
    if current_user.role == Role.admin:
        hod_dept_id = current_user.department_id
        if not hod_dept_id:
            raise HTTPException(status_code=403, detail="HOD account is not assigned to a department.")

        if t_type == "COLLEGE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Department HOD accounts are restricted to department-level targeting and cannot publish college-wide announcements.",
            )

        if t_type in ("DEPARTMENT", "MULTIPLE_DEPARTMENTS"):
            # Ensure HOD only targets their own department
            for d_id in department_ids:
                if d_id != hod_dept_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="HOD cannot target a foreign department.",
                    )
            return "DEPARTMENT", [hod_dept_id], []

        if t_type in ("USER", "MULTIPLE_USERS"):
            if not user_ids:
                raise HTTPException(status_code=400, detail="Please select at least one recipient in your department.")
            # Verify all selected users belong to this HOD's department
            foreign_users = db.query(User).filter(
                User.id.in_(user_ids),
                User.department_id != hod_dept_id,
            ).count()
            if foreign_users > 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot target faculty outside your department.",
                )
            return "USER", [], user_ids

    raise HTTPException(status_code=403, detail="Unauthorized targeting configuration.")


def create_announcement(
    db: Session,
    current_user: User,
    data: AnnouncementCreateIn,
) -> Announcement:
    normalized_type, validated_depts, validated_users = validate_target_permissions(
        db=db,
        current_user=current_user,
        target_type=data.target_type,
        department_ids=data.department_ids or [],
        user_ids=data.user_ids or [],
    )

    now = datetime.now(timezone.utc)
    status_val = AnnouncementStatus.DRAFT.value
    pub_at = None

    if data.publish_now:
        status_val = AnnouncementStatus.PUBLISHED.value
        pub_at = now
    elif data.scheduled_at and _is_future(data.scheduled_at):
        status_val = AnnouncementStatus.SCHEDULED.value
        pub_at = data.scheduled_at

    announcement = Announcement(
        tenant_id="default",
        title=data.title.strip(),
        body=data.body.strip(),
        type=data.type.value if hasattr(data.type, "value") else str(data.type),
        priority=data.priority.value if hasattr(data.priority, "value") else str(data.priority),
        status=status_val,
        created_by_id=current_user.id,
        department_id=current_user.department_id if current_user.role == Role.admin else None,
        target_summary=normalized_type,
        is_pinned=data.is_pinned,
        requires_acknowledgement=data.requires_acknowledgement,
        allow_replies=data.allow_replies,
        allow_reactions=data.allow_reactions,
        allow_download=data.allow_download,
        is_locked=False,
        version=1,
        published_at=pub_at,
        scheduled_at=data.scheduled_at,
        expires_at=data.expires_at,
    )
    db.add(announcement)
    db.flush()

    # Targets
    if normalized_type == "COLLEGE":
        t = AnnouncementTarget(announcement_id=announcement.id, target_type=TargetType.COLLEGE.value)
        db.add(t)
    elif normalized_type == "DEPARTMENT":
        for d_id in validated_depts:
            t = AnnouncementTarget(
                announcement_id=announcement.id,
                target_type=TargetType.DEPARTMENT.value,
                department_id=d_id,
            )
            db.add(t)
    elif normalized_type == "USER":
        for u_id in validated_users:
            t = AnnouncementTarget(
                announcement_id=announcement.id,
                target_type=TargetType.USER.value,
                user_id=u_id,
            )
            db.add(t)

    # Attachments
    if data.attachments:
        for att in data.attachments:
            a_record = AnnouncementAttachment(
                announcement_id=announcement.id,
                file_name=att.file_name,
                file_type=att.file_type,
                file_size=att.file_size,
                storage_key=att.storage_key,
                checksum_sha256=att.checksum_sha256,
                uploaded_by_id=current_user.id,
            )
            db.add(a_record)

    db.commit()
    db.refresh(announcement)

    log_audit_action(
        db=db,
        actor=current_user,
        action="announcement_created",
        target_type="announcement",
        target_id=announcement.id,
        details={"title": announcement.title, "type": announcement.type, "status": announcement.status},
    )

    # If published, fan out notifications asynchronously
    if announcement.status == AnnouncementStatus.PUBLISHED.value:
        recipients = resolve_recipient_user_ids(db, announcement)
        # Exclude author from self-notification
        filtered_recipients = [uid for uid in recipients if uid != current_user.id]
        event_type = "announcement_ack_required" if announcement.requires_acknowledgement else "announcement_new"
        notification_service.batch_fanout_announcement_notifications(
            announcement_id=announcement.id,
            recipient_user_ids=filtered_recipients,
            title=f"📢 {announcement.title}",
            body=f"{announcement.body[:120]}...",
            event_type=event_type,
        )

    return announcement


def resolve_recipient_user_ids(db: Session, announcement: Announcement) -> List[int]:
    """Resolves all active user IDs targeted by this announcement."""
    targets = db.query(AnnouncementTarget).filter(AnnouncementTarget.announcement_id == announcement.id).all()
    if not targets:
        return []

    target_types = {t.target_type for t in targets}
    if TargetType.COLLEGE.value in target_types:
        return [u.id for u in db.query(User.id).filter(User.is_active == True).all()]  # noqa: E712

    dept_ids = [t.department_id for t in targets if t.target_type == TargetType.DEPARTMENT.value and t.department_id]
    user_ids = [t.user_id for t in targets if t.target_type == TargetType.USER.value and t.user_id]

    final_ids = set(user_ids)
    if dept_ids:
        dept_users = db.query(User.id).filter(
            User.department_id.in_(dept_ids),
            User.is_active == True,  # noqa: E712
        ).all()
        for u in dept_users:
            final_ids.add(u.id)

    return list(final_ids)


def get_visible_announcements_query(db: Session, current_user: User):
    """Constructs the base SQLAlchemy query for announcements visible to current_user."""
    now = datetime.now(timezone.utc)

    # Principal, System Admin, Governance, and College Admin have global visibility of all non-deleted
    if current_user.role in (Role.system_admin, Role.principal, Role.governance) or (
        current_user.role == Role.admin and current_user.department_id is None
    ):
        return db.query(Announcement).filter(
            Announcement.status != AnnouncementStatus.DELETED.value,
        )

    # Regular users (Teachers, Staff, Managers, HODs viewing the feed)
    # Visible if not deleted and:
    # 1) Author
    # 2) Published (and published_at <= now and not expired) AND (Target is COLLEGE OR Target is User's Dept OR Target is User)
    base_published = and_(
        Announcement.status == AnnouncementStatus.PUBLISHED.value,
        or_(Announcement.published_at.is_(None), Announcement.published_at <= now),
        or_(Announcement.expires_at.is_(None), Announcement.expires_at > now),
    )

    college_target = Announcement.targets.any(AnnouncementTarget.target_type == TargetType.COLLEGE.value)
    user_target = Announcement.targets.any(AnnouncementTarget.user_id == current_user.id)
    
    conditions = [
        Announcement.created_by_id == current_user.id,
        and_(base_published, college_target),
        and_(base_published, user_target),
    ]

    if current_user.department_id:
        dept_target = Announcement.targets.any(
            and_(
                AnnouncementTarget.target_type == TargetType.DEPARTMENT.value,
                AnnouncementTarget.department_id == current_user.department_id,
            )
        )
        conditions.append(and_(base_published, dept_target))

    return db.query(Announcement).filter(
        Announcement.status != AnnouncementStatus.DELETED.value,
        or_(*conditions),
    )


def list_announcements(
    db: Session,
    current_user: User,
    tab: str = "all",
    search: Optional[str] = None,
    announcement_type: Optional[str] = None,
    priority: Optional[str] = None,
    department_id: Optional[int] = None,
    page: int = 1,
    limit: int = 20,
) -> Tuple[List[AnnouncementListItemOut], int]:
    """Retrieves paginated, filtered announcement feed with read/ack status."""
    q = get_visible_announcements_query(db, current_user)

    if search:
        s = f"%{search.strip()}%"
        q = q.outerjoin(User, Announcement.created_by_id == User.id).filter(
            or_(
                Announcement.title.ilike(s),
                Announcement.body.ilike(s),
                Announcement.type.ilike(s),
                Announcement.priority.ilike(s),
                User.name.ilike(s),
            )
        )

    if announcement_type and announcement_type.upper() != "ALL":
        q = q.filter(Announcement.type == announcement_type.upper())

    if priority and priority.upper() != "ALL":
        q = q.filter(Announcement.priority == priority.upper())

    if department_id:
        q = q.filter(Announcement.department_id == department_id)

    # Tab-based filtering
    tab_lower = (tab or "all").lower()
    if tab_lower == "unread":
        # Announcements NOT in announcement_reads for this user
        read_subq = db.query(AnnouncementRead.announcement_id).filter(AnnouncementRead.user_id == current_user.id).subquery()
        q = q.filter(~Announcement.id.in_(read_subq))
    elif tab_lower == "important":
        q = q.filter(Announcement.priority.in_([AnnouncementPriority.IMPORTANT.value, AnnouncementPriority.HIGH.value, AnnouncementPriority.URGENT.value]))
    elif tab_lower == "mentioned":
        # Announcements with a message mentioning this user
        mention_subq = db.query(AnnouncementMessage.announcement_id).join(MessageMention).filter(
            MessageMention.mentioned_user_id == current_user.id
        ).subquery()
        q = q.filter(Announcement.id.in_(mention_subq))
    elif tab_lower == "ack_pending":
        # Requires ack and user has NOT acknowledged
        ack_subq = db.query(AnnouncementAcknowledgement.announcement_id).filter(AnnouncementAcknowledgement.user_id == current_user.id).subquery()
        q = q.filter(
            Announcement.requires_acknowledgement == True,  # noqa: E712
            ~Announcement.id.in_(ack_subq),
        )

    total_count = q.count()

    # Pinned first, then published_at DESC
    items = q.options(
        joinedload(Announcement.author),
        joinedload(Announcement.department),
        selectinload(Announcement.targets),
        selectinload(Announcement.attachments),
    ).order_by(
        Announcement.is_pinned.desc(),
        func.coalesce(Announcement.published_at, Announcement.created_at).desc(),
    ).offset((page - 1) * limit).limit(limit).all()

    if not items:
        return [], total_count

    announcement_ids = [a.id for a in items]

    # Pre-fetch read and ack status for current user in batch
    user_reads = set(
        r[0] for r in db.query(AnnouncementRead.announcement_id).filter(
            AnnouncementRead.announcement_id.in_(announcement_ids),
            AnnouncementRead.user_id == current_user.id,
        ).all()
    )
    user_acks = set(
        a[0] for a in db.query(AnnouncementAcknowledgement.announcement_id).filter(
            AnnouncementAcknowledgement.announcement_id.in_(announcement_ids),
            AnnouncementAcknowledgement.user_id == current_user.id,
        ).all()
    )

    # Pre-fetch reply counts in batch
    reply_counts = dict(
        db.query(
            AnnouncementMessage.announcement_id,
            func.count(AnnouncementMessage.id)
        ).filter(
            AnnouncementMessage.announcement_id.in_(announcement_ids),
            AnnouncementMessage.is_deleted == False  # noqa: E712
        ).group_by(AnnouncementMessage.announcement_id).all()
    )

    # Pre-fetch reactions summary in batch
    reactions_raw = db.query(
        AnnouncementMessage.announcement_id,
        MessageReaction.reaction,
        func.count(MessageReaction.id)
    ).join(MessageReaction, MessageReaction.message_id == AnnouncementMessage.id).filter(
        AnnouncementMessage.announcement_id.in_(announcement_ids)
    ).group_by(AnnouncementMessage.announcement_id, MessageReaction.reaction).all()

    reactions_map: Dict[int, List[Dict[str, Any]]] = {}
    for aid, emoji, cnt in reactions_raw:
        reactions_map.setdefault(aid, []).append({"reaction": emoji, "count": cnt})

    results = []
    for a in items:
        attachments_out = [
            AttachmentOut(
                id=att.id,
                announcement_id=att.announcement_id,
                file_name=att.file_name,
                file_type=att.file_type,
                file_size=att.file_size,
                storage_key=att.storage_key,
                download_url=storage_service.generate_presigned_download(att.storage_key, att.file_name, 900),
                created_at=att.created_at,
            )
            for att in a.attachments
        ]

        author_name = a.author.name if a.author else "Institutional Administration"
        author_role = (a.author.role.value if a.author else "System").replace("_", " ").title()
        dept_name = a.department.name if a.department else None

        body_snippet = a.body[:220] + ("..." if len(a.body) > 220 else "")
        can_del = can_user_modify_announcement(a, current_user)
        can_ed = can_del

        results.append(
            AnnouncementListItemOut(
                id=a.id,
                tenant_id=a.tenant_id,
                title=a.title,
                body_snippet=body_snippet,
                type=a.type,
                priority=a.priority,
                status=a.status,
                target_summary=a.target_summary,
                is_pinned=a.is_pinned,
                requires_acknowledgement=a.requires_acknowledgement,
                allow_replies=a.allow_replies,
                allow_reactions=a.allow_reactions,
                is_locked=a.is_locked,
                version=a.version,
                published_at=a.published_at,
                created_at=a.created_at,
                created_by_id=a.created_by_id,
                author_name=author_name,
                author_role=author_role,
                department_name=dept_name,
                attachment_count=len(a.attachments),
                attachments=attachments_out,
                reply_count=reply_counts.get(a.id, 0),
                reactions_summary=reactions_map.get(a.id, []),
                is_read=a.id in user_reads,
                is_acknowledged=a.id in user_acks,
                can_delete=can_del,
                can_edit=can_ed,
            )
        )

    return results, total_count


def get_user_unread_count(db: Session, current_user: User) -> int:
    """Efficiently returns the total number of unread visible announcements for current_user."""
    q = get_visible_announcements_query(db, current_user)
    read_subq = db.query(AnnouncementRead.announcement_id).filter(
        AnnouncementRead.user_id == current_user.id
    ).subquery()
    return q.filter(~Announcement.id.in_(read_subq)).count()


def get_announcement_detail(db: Session, current_user: User, announcement_id: int) -> AnnouncementDetailOut:
    """Retrieves full announcement detail, targets, attachments, and permissions."""
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id,
        Announcement.status != AnnouncementStatus.DELETED.value,
    ).first()

    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    # Validate visibility for non-admin users
    if current_user.role not in (Role.system_admin, Role.principal, Role.governance):
        if announcement.created_by_id != current_user.id:
            if announcement.status != AnnouncementStatus.PUBLISHED.value:
                raise HTTPException(status_code=403, detail="This announcement is not published.")
            if _is_future(announcement.published_at):
                raise HTTPException(status_code=403, detail="This announcement is not yet available.")
            recipients = resolve_recipient_user_ids(db, announcement)
            if current_user.id not in recipients:
                raise HTTPException(status_code=403, detail="You are not an authorized recipient of this announcement.")

    # Read tracking
    read_rec = db.query(AnnouncementRead).filter(
        AnnouncementRead.announcement_id == announcement.id,
        AnnouncementRead.user_id == current_user.id,
    ).first()
    if not read_rec:
        read_rec = AnnouncementRead(announcement_id=announcement.id, user_id=current_user.id)
        db.add(read_rec)
        db.commit()
    else:
        read_rec.last_viewed_at = datetime.now(timezone.utc)
        db.commit()

    ack_rec = db.query(AnnouncementAcknowledgement).filter(
        AnnouncementAcknowledgement.announcement_id == announcement.id,
        AnnouncementAcknowledgement.user_id == current_user.id,
    ).first()

    # Permissions
    can_modify = can_user_modify_announcement(announcement, current_user)
    can_edit = can_modify
    can_delete = can_modify
    can_moderate = can_modify
    can_view_analytics = can_modify
    can_reply = announcement.allow_replies and not announcement.is_locked
    can_ack = announcement.requires_acknowledgement and (ack_rec is None)

    targets_out = [
        TargetOut(
            id=t.id,
            target_type=t.target_type,
            department_id=t.department_id,
            user_id=t.user_id,
            department_name=t.department.name if t.department else None,
            user_name=t.user.name if t.user else None,
        )
        for t in announcement.targets
    ]

    attachments_out = [
        AttachmentOut(
            id=att.id,
            announcement_id=att.announcement_id,
            file_name=att.file_name,
            file_type=att.file_type,
            file_size=att.file_size,
            storage_key=att.storage_key,
            download_url=storage_service.generate_presigned_download(att.storage_key, att.file_name, 900),
            created_at=att.created_at,
        )
        for att in announcement.attachments
    ]

    author_name = announcement.author.name if announcement.author else "Institutional Administration"
    author_role = (announcement.author.role.value if announcement.author else "System").replace("_", " ").title()
    dept_name = announcement.department.name if announcement.department else None

    # Compact publisher stats
    total_recipients = None
    viewed_count = None
    acknowledged_count = None
    if can_view_analytics:
        recipients = resolve_recipient_user_ids(db, announcement)
        total_recipients = len(recipients)
        viewed_count = db.query(func.count(distinct(AnnouncementRead.user_id))).filter(
            AnnouncementRead.announcement_id == announcement.id
        ).scalar() or 0
        acknowledged_count = db.query(func.count(distinct(AnnouncementAcknowledgement.user_id))).filter(
            AnnouncementAcknowledgement.announcement_id == announcement.id
        ).scalar() or 0

    return AnnouncementDetailOut(
        id=announcement.id,
        tenant_id=announcement.tenant_id,
        title=announcement.title,
        body=announcement.body,
        type=announcement.type,
        priority=announcement.priority,
        status=announcement.status,
        target_summary=announcement.target_summary,
        is_pinned=announcement.is_pinned,
        requires_acknowledgement=announcement.requires_acknowledgement,
        allow_replies=announcement.allow_replies,
        allow_reactions=announcement.allow_reactions,
        allow_download=announcement.allow_download,
        is_locked=announcement.is_locked,
        version=announcement.version,
        previous_version_id=announcement.previous_version_id,
        revision_notes=announcement.revision_notes,
        published_at=announcement.published_at,
        scheduled_at=announcement.scheduled_at,
        expires_at=announcement.expires_at,
        created_at=announcement.created_at,
        updated_at=announcement.updated_at,
        created_by_id=announcement.created_by_id,
        author_name=author_name,
        author_role=author_role,
        department_name=dept_name,
        targets=targets_out,
        attachments=attachments_out,
        is_read=True,
        first_viewed_at=read_rec.first_viewed_at if read_rec else None,
        is_acknowledged=ack_rec is not None,
        acknowledged_at=ack_rec.acknowledged_at if ack_rec else None,
        can_edit=can_edit,
        can_delete=can_delete,
        can_reply=can_reply,
        can_moderate=can_moderate,
        can_acknowledge=can_ack,
        can_view_analytics=can_view_analytics,
        total_recipients=total_recipients,
        viewed_count=viewed_count,
        acknowledged_count=acknowledged_count,
    )


def update_announcement(
    db: Session,
    current_user: User,
    announcement_id: int,
    data: AnnouncementUpdateIn,
) -> AnnouncementDetailOut:
    """Updates announcement details with version tracking for official circulars."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    if not can_user_modify_announcement(announcement, current_user):
        raise HTTPException(status_code=403, detail="You do not have permission to edit this announcement.")

    # Version tracking if published circular body or title changed
    content_changed = False
    if data.title and data.title.strip() != announcement.title:
        announcement.title = data.title.strip()
        content_changed = True
    if data.body and data.body.strip() != announcement.body:
        announcement.body = data.body.strip()
        content_changed = True

    if content_changed and announcement.status == AnnouncementStatus.PUBLISHED.value:
        announcement.version += 1
        if data.revision_notes:
            announcement.revision_notes = data.revision_notes.strip()

    if data.type is not None:
        announcement.type = data.type.value if hasattr(data.type, "value") else str(data.type)
    if data.priority is not None:
        announcement.priority = data.priority.value if hasattr(data.priority, "value") else str(data.priority)
    if data.is_pinned is not None:
        announcement.is_pinned = data.is_pinned
    if data.requires_acknowledgement is not None:
        announcement.requires_acknowledgement = data.requires_acknowledgement
    if data.allow_replies is not None:
        announcement.allow_replies = data.allow_replies
    if data.allow_reactions is not None:
        announcement.allow_reactions = data.allow_reactions
    if data.allow_download is not None:
        announcement.allow_download = data.allow_download
    if data.is_locked is not None:
        announcement.is_locked = data.is_locked
    if data.scheduled_at is not None:
        announcement.scheduled_at = data.scheduled_at
    if data.expires_at is not None:
        announcement.expires_at = data.expires_at

    announcement.updated_at = datetime.now(timezone.utc)
    db.commit()

    log_audit_action(
        db=db,
        actor=current_user,
        action="announcement_updated",
        target_type="announcement",
        target_id=announcement.id,
        details={"version": announcement.version, "title": announcement.title},
    )

    return get_announcement_detail(db, current_user, announcement_id)


def publish_announcement(db: Session, current_user: User, announcement_id: int) -> AnnouncementDetailOut:
    """Publishes a draft or scheduled announcement immediately."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    if not can_manage_announcements(current_user):
        raise HTTPException(status_code=403, detail="Unauthorized.")

    announcement.status = AnnouncementStatus.PUBLISHED.value
    announcement.published_at = datetime.now(timezone.utc)
    db.commit()

    log_audit_action(
        db=db,
        actor=current_user,
        action="announcement_published",
        target_type="announcement",
        target_id=announcement.id,
    )

    # Asynchronous fanout
    recipients = resolve_recipient_user_ids(db, announcement)
    filtered_recipients = [uid for uid in recipients if uid != current_user.id]
    event_type = "announcement_ack_required" if announcement.requires_acknowledgement else "announcement_new"
    notification_service.batch_fanout_announcement_notifications(
        announcement_id=announcement.id,
        recipient_user_ids=filtered_recipients,
        title=f"📢 {announcement.title}",
        body=f"{announcement.body[:120]}...",
        event_type=event_type,
    )

    return get_announcement_detail(db, current_user, announcement_id)


def acknowledge_announcement(
    db: Session,
    current_user: User,
    announcement_id: int,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> bool:
    """Records formal institutional acknowledgement from user."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    if not announcement.requires_acknowledgement:
        raise HTTPException(status_code=400, detail="This announcement does not require formal acknowledgement.")

    existing = db.query(AnnouncementAcknowledgement).filter(
        AnnouncementAcknowledgement.announcement_id == announcement_id,
        AnnouncementAcknowledgement.user_id == current_user.id,
    ).first()

    if not existing:
        ack = AnnouncementAcknowledgement(
            announcement_id=announcement_id,
            user_id=current_user.id,
            ip_address=ip_address,
            user_agent=user_agent[:255] if user_agent else None,
        )
        db.add(ack)
        db.commit()

        log_audit_action(
            db=db,
            actor=current_user,
            action="announcement_acknowledged",
            target_type="announcement",
            target_id=announcement_id,
        )

    return True


def delete_announcement(db: Session, current_user: User, announcement_id: int) -> bool:
    """Soft deletes announcement."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    if not can_user_modify_announcement(announcement, current_user):
        raise HTTPException(status_code=403, detail="Permission denied. You cannot delete this announcement.")

    announcement.status = AnnouncementStatus.DELETED.value
    db.commit()

    log_audit_action(
        db=db,
        actor=current_user,
        action="announcement_deleted",
        target_type="announcement",
        target_id=announcement_id,
    )

    return True


# ── Threaded Conversation Methods ──
def get_conversation_messages(db: Session, current_user: User, announcement_id: int) -> List[MessageOut]:
    """Returns threaded conversation tree with reactions, mentions, and permissions."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    # All active messages for this announcement
    raw_msgs = db.query(AnnouncementMessage).filter(
        AnnouncementMessage.announcement_id == announcement_id,
    ).order_by(AnnouncementMessage.created_at.asc()).all()

    if not raw_msgs:
        return []

    msg_ids = [m.id for m in raw_msgs]

    # Pre-fetch reactions
    reactions = db.query(MessageReaction).filter(MessageReaction.message_id.in_(msg_ids)).all()
    rx_map: Dict[int, Dict[str, Dict[str, Any]]] = {}
    for r in reactions:
        m_dict = rx_map.setdefault(r.message_id, {})
        if r.reaction not in m_dict:
            m_dict[r.reaction] = {"count": 0, "user_ids": [], "user_names": [], "has_reacted": False}
        m_dict[r.reaction]["count"] += 1
        m_dict[r.reaction]["user_ids"].append(r.user_id)
        if r.user:
            m_dict[r.reaction]["user_names"].append(r.user.name)
        if r.user_id == current_user.id:
            m_dict[r.reaction]["has_reacted"] = True

    # Pre-fetch mentions
    mentions = db.query(MessageMention).filter(MessageMention.message_id.in_(msg_ids)).all()
    mention_map: Dict[int, List[MentionOut]] = {}
    for men in mentions:
        m_name = men.mentioned_user.name if men.mentioned_user else "User"
        mention_map.setdefault(men.message_id, []).append(
            MentionOut(
                mentioned_user_id=men.mentioned_user_id,
                mentioned_user_name=m_name,
                mention_text=men.mention_text,
            )
        )

    is_admin = current_user.role in (Role.principal, Role.system_admin)
    is_dept_hod = (
        current_user.role == Role.admin and
        current_user.department_id is not None and
        announcement.department_id == current_user.department_id
    )

    out_map: Dict[int, MessageOut] = {}
    root_messages: List[MessageOut] = []

    for m in raw_msgs:
        author_name = m.author.name if m.author else "Faculty Member"
        author_role = (m.author.role.value if m.author else "Teacher").replace("_", " ").title()
        author_dept = m.author.department if m.author else None

        content = "[This message has been removed by moderator]" if m.is_deleted else m.content

        m_reactions = [
            ReactionOut(
                reaction=r_emoji,
                count=data["count"],
                user_ids=data["user_ids"],
                user_names=data["user_names"],
                has_reacted=data["has_reacted"],
            )
            for r_emoji, data in rx_map.get(m.id, {}).items()
        ]

        can_mod = is_admin or is_dept_hod
        can_del = can_mod or (m.author_id == current_user.id and not m.is_deleted)

        m_out = MessageOut(
            id=m.id,
            announcement_id=m.announcement_id,
            parent_message_id=m.parent_message_id,
            author_id=m.author_id,
            author_name=author_name,
            author_role=author_role,
            author_department=author_dept,
            content=content,
            is_pinned=m.is_pinned,
            is_deleted=m.is_deleted,
            is_edited=m.is_edited,
            created_at=m.created_at,
            updated_at=m.updated_at,
            reactions=m_reactions,
            mentions=mention_map.get(m.id, []),
            reply_count=0,
            replies=[],
            can_moderate=can_mod,
            can_delete=can_del,
        )
        out_map[m.id] = m_out

    # Assemble hierarchy
    for m in raw_msgs:
        m_out = out_map[m.id]
        if m.parent_message_id and m.parent_message_id in out_map:
            parent = out_map[m.parent_message_id]
            parent.replies.append(m_out)
            parent.reply_count += 1
        else:
            root_messages.append(m_out)

    return root_messages


def add_message(
    db: Session,
    current_user: User,
    announcement_id: int,
    content: str,
    parent_message_id: Optional[int] = None,
    mentioned_user_ids: Optional[List[int]] = None,
) -> MessageOut:
    """Posts a new message or nested reply in the announcement conversation."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    if not announcement.allow_replies or announcement.is_locked:
        raise HTTPException(status_code=403, detail="Conversations are disabled or locked for this announcement.")

    clean_content = content.strip()
    if not clean_content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty.")

    if parent_message_id:
        parent = db.query(AnnouncementMessage).filter(
            AnnouncementMessage.id == parent_message_id,
            AnnouncementMessage.announcement_id == announcement_id,
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent message not found.")

    msg = AnnouncementMessage(
        announcement_id=announcement_id,
        parent_message_id=parent_message_id,
        author_id=current_user.id,
        content=clean_content,
        is_pinned=False,
        is_deleted=False,
        is_edited=False,
    )
    db.add(msg)
    db.flush()

    # Mentions handling: combine explicit IDs and text mentions (@Name)
    all_mentioned_ids = set(mentioned_user_ids or [])
    text_mention_matches = re.findall(r"@([A-Za-z0-9_.\s]{2,50})", clean_content)
    if text_mention_matches:
        for raw_name in text_mention_matches:
            cand = raw_name.strip()
            matched = db.query(User).filter(
                func.lower(User.name) == cand.lower(),
                User.is_active == True,  # noqa: E712
            ).first()
            if matched:
                all_mentioned_ids.add(matched.id)

    if all_mentioned_ids:
        # Validate users exist and belong to active directory
        valid_users = db.query(User).filter(
            User.id.in_(list(all_mentioned_ids)),
            User.is_active == True,  # noqa: E712
        ).all()
        for u in valid_users:
            mention = MessageMention(
                message_id=msg.id,
                mentioned_user_id=u.id,
                mention_text=f"@{u.name}",
            )
            db.add(mention)

            # Send mention notification
            if u.id != current_user.id:
                notification_service.create_notification(
                    db=db,
                    user_id=u.id,
                    title=f"💬 Mentioned by {current_user.name}",
                    body=f'{current_user.name} mentioned you in "{announcement.title}": {clean_content[:100]}',
                    event_type="announcement_mention",
                    send_push=True,
                )

    # If replying to someone else's message, notify parent message author
    if parent_message_id and parent.author_id and parent.author_id != current_user.id:
        notification_service.create_notification(
            db=db,
            user_id=parent.author_id,
            title=f"💬 New Reply from {current_user.name}",
            body=f'{current_user.name} replied to your comment on "{announcement.title}": {clean_content[:100]}',
            event_type="announcement_reply",
            send_push=True,
        )

    db.commit()
    db.refresh(msg)

    log_audit_action(
        db=db,
        actor=current_user,
        action="message_created",
        target_type="announcement_message",
        target_id=msg.id,
    )

    # Return formatted MessageOut
    author_name = current_user.name
    author_role = current_user.role.value.replace("_", " ").title()
    author_dept = current_user.department

    return MessageOut(
        id=msg.id,
        announcement_id=msg.announcement_id,
        parent_message_id=msg.parent_message_id,
        author_id=msg.author_id,
        author_name=author_name,
        author_role=author_role,
        author_department=author_dept,
        content=msg.content,
        is_pinned=msg.is_pinned,
        is_deleted=msg.is_deleted,
        is_edited=msg.is_edited,
        created_at=msg.created_at,
        updated_at=msg.updated_at,
        reactions=[],
        mentions=[],
        reply_count=0,
        replies=[],
        can_moderate=True,
        can_delete=True,
    )


def delete_message(db: Session, current_user: User, message_id: int) -> bool:
    """Soft deletes a message (preserving audit tree)."""
    msg = db.query(AnnouncementMessage).filter(AnnouncementMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    is_author = msg.author_id == current_user.id
    is_admin = current_user.role in (Role.principal, Role.system_admin)
    is_dept_hod = (
        current_user.role == Role.admin and
        current_user.department_id is not None and
        msg.announcement and msg.announcement.department_id == current_user.department_id
    )

    if not (is_author or is_admin or is_dept_hod):
        raise HTTPException(status_code=403, detail="You do not have permission to delete this message.")

    msg.is_deleted = True
    msg.updated_at = datetime.now(timezone.utc)
    db.commit()

    log_audit_action(
        db=db,
        actor=current_user,
        action="message_deleted",
        target_type="announcement_message",
        target_id=message_id,
    )

    return True


def toggle_pin_message(db: Session, current_user: User, message_id: int) -> bool:
    """Pins or unpins a message in the conversation (moderator action)."""
    msg = db.query(AnnouncementMessage).filter(AnnouncementMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    is_admin = current_user.role in (Role.principal, Role.system_admin)
    is_dept_hod = (
        current_user.role == Role.admin and
        current_user.department_id is not None and
        msg.announcement and msg.announcement.department_id == current_user.department_id
    )

    if not (is_admin or is_dept_hod):
        raise HTTPException(status_code=403, detail="Only Principal or HOD can pin replies.")

    msg.is_pinned = not msg.is_pinned
    db.commit()

    log_audit_action(
        db=db,
        actor=current_user,
        action="message_pinned" if msg.is_pinned else "message_unpinned",
        target_type="announcement_message",
        target_id=message_id,
    )

    return msg.is_pinned


def toggle_reaction(db: Session, current_user: User, message_id: int, reaction: str) -> Dict[str, Any]:
    """Adds or removes an emoji reaction on a message."""
    clean_rx = reaction.strip()
    if not clean_rx:
        raise HTTPException(status_code=400, detail="Reaction emoji cannot be empty.")

    msg = db.query(AnnouncementMessage).filter(AnnouncementMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    if msg.announcement and not msg.announcement.allow_reactions:
        raise HTTPException(status_code=403, detail="Reactions are disabled for this announcement.")

    existing = db.query(MessageReaction).filter(
        MessageReaction.message_id == message_id,
        MessageReaction.user_id == current_user.id,
        MessageReaction.reaction == clean_rx,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        has_reacted = False
    else:
        new_rx = MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            reaction=clean_rx,
        )
        db.add(new_rx)
        db.commit()
        has_reacted = True

    count = db.query(MessageReaction).filter(
        MessageReaction.message_id == message_id,
        MessageReaction.reaction == clean_rx,
    ).count()

    return {"reaction": clean_rx, "count": count, "has_reacted": has_reacted}


def get_announcement_analytics(db: Session, current_user: User, announcement_id: int) -> AnnouncementAnalyticsOut:
    """Computes delivery, read, and acknowledgement metrics for publishers."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    if not can_user_modify_announcement(announcement, current_user):
        raise HTTPException(status_code=403, detail="You do not have permission to view analytics for this announcement.")

    recipients = resolve_recipient_user_ids(db, announcement)
    total_recipients = len(recipients)

    reads = {
        r.user_id: r.first_viewed_at
        for r in db.query(AnnouncementRead).filter(AnnouncementRead.announcement_id == announcement_id).all()
    }
    acks = {
        a.user_id: a.acknowledged_at
        for a in db.query(AnnouncementAcknowledgement).filter(AnnouncementAcknowledgement.announcement_id == announcement_id).all()
    }

    users = db.query(User).filter(User.id.in_(recipients)).all() if recipients else []
    recipient_stats = []
    viewed_count = 0
    acknowledged_count = 0

    for u in users:
        has_viewed = u.id in reads
        first_view = reads.get(u.id)
        has_ack = u.id in acks
        ack_at = acks.get(u.id)

        if has_viewed:
            viewed_count += 1
        if has_ack:
            acknowledged_count += 1

        dept_name = u.department_rel.name if u.department_rel else (getattr(u, "department_old", None) or "General")
        raw_role = u.role.value if hasattr(u.role, "value") else str(u.role)
        role_label = raw_role.replace("_", " ").title()

        recipient_stats.append(
            RecipientStatItem(
                user_id=u.id,
                name=u.name,
                email=u.email or u.username,
                role=role_label,
                department=dept_name,
                has_viewed=has_viewed,
                first_viewed_at=first_view,
                has_acknowledged=has_ack,
                acknowledged_at=ack_at,
            )
        )

    unread_count = total_recipients - viewed_count
    pending_ack = total_recipients - acknowledged_count if announcement.requires_acknowledgement else 0

    view_pct = round((viewed_count / total_recipients) * 100, 1) if total_recipients > 0 else 0.0
    ack_pct = round((acknowledged_count / total_recipients) * 100, 1) if total_recipients > 0 else 0.0

    return AnnouncementAnalyticsOut(
        announcement_id=announcement.id,
        title=announcement.title,
        total_recipients=total_recipients,
        viewed_count=viewed_count,
        unread_count=unread_count,
        acknowledged_count=acknowledged_count,
        pending_acknowledgement_count=pending_ack,
        view_rate_pct=view_pct,
        acknowledgement_rate_pct=ack_pct,
        requires_acknowledgement=announcement.requires_acknowledgement,
        published_at=announcement.published_at,
        recipients=recipient_stats,
    )


def get_candidate_directory(db: Session, current_user: User) -> CandidateDirectoryOut:
    """Returns candidate departments and faculty for audience targeting."""
    if not can_manage_announcements(current_user):
        raise HTTPException(status_code=403, detail="Permission denied.")

    if current_user.role in (Role.principal, Role.system_admin):
        departments = db.query(Department).order_by(Department.name.asc()).all()
        faculty = db.query(User).filter(
            User.role.in_([Role.teacher, Role.admin]),
            User.is_active == True,  # noqa: E712
        ).order_by(User.name.asc()).all()
    else:
        # HOD: only their own department
        departments = db.query(Department).filter(Department.id == current_user.department_id).all()
        faculty = db.query(User).filter(
            User.department_id == current_user.department_id,
            User.role.in_([Role.teacher, Role.admin]),
            User.is_active == True,  # noqa: E712
        ).order_by(User.name.asc()).all()

    dept_out = [{"id": d.id, "name": d.name, "code": d.code} for d in departments]
    faculty_out = [
        CandidateFacultyItem(
            id=f.id,
            name=f.name,
            email=f.email or f.username,
            department_id=f.department_id,
            department_name=f.department_rel.name if f.department_rel else f.department_old,
            role=f.role.value,
        )
        for f in faculty
    ]

    return CandidateDirectoryOut(departments=dept_out, faculty=faculty_out)


def get_mention_candidates(
    db: Session,
    current_user: User,
    announcement_id: int,
    query: Optional[str] = None,
    limit: int = 50,
) -> List[CandidateFacultyItem]:
    """
    Returns authorized faculty candidates that can be @mentioned in an announcement conversation.
    - Principal & System Admin: can mention any active faculty/staff across college.
    - HOD & Teachers: can mention active faculty within their own department
      and any active faculty participating in/targeted by this announcement.
    - Search query filters by name, email, or username case-insensitively.
    - Bounded by limit (default 50, max 100).
    """
    announcement = db.query(Announcement).filter(
        Announcement.id == announcement_id,
        Announcement.status != AnnouncementStatus.DELETED.value,
    ).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")

    # Validate that current_user has access to view/participate in this announcement
    if current_user.role not in (Role.system_admin, Role.principal, Role.governance):
        if announcement.created_by_id != current_user.id:
            recipients = resolve_recipient_user_ids(db, announcement)
            if current_user.id not in recipients:
                raise HTTPException(status_code=403, detail="Not authorized to participate in this announcement.")

    # Base candidate query: active users in faculty / staff / admin roles
    faculty_query = db.query(User).filter(
        User.is_active == True,  # noqa: E712
        User.role.in_([Role.teacher, Role.admin, Role.principal, Role.system_admin]),
    )

    is_elevated = current_user.role in (Role.principal, Role.system_admin)
    is_college_wide = announcement.target_summary == "COLLEGE"

    if not is_elevated and not is_college_wide:
        allowed_dept_ids = set()
        if current_user.department_id:
            allowed_dept_ids.add(current_user.department_id)
        if announcement.department_id:
            allowed_dept_ids.add(announcement.department_id)

        target_records = db.query(AnnouncementTarget).filter(
            AnnouncementTarget.announcement_id == announcement.id
        ).all()
        for t in target_records:
            if t.department_id:
                allowed_dept_ids.add(t.department_id)

        filter_conditions = []
        if allowed_dept_ids:
            filter_conditions.append(User.department_id.in_(list(allowed_dept_ids)))
        if announcement.created_by_id:
            filter_conditions.append(User.id == announcement.created_by_id)

        if filter_conditions:
            faculty_query = faculty_query.filter(or_(*filter_conditions))
        elif current_user.department_id:
            faculty_query = faculty_query.filter(User.department_id == current_user.department_id)

    # Search filtering
    if query and query.strip():
        search_pattern = f"%{query.strip().lower()}%"
        faculty_query = faculty_query.filter(
            or_(
                func.lower(User.name).like(search_pattern),
                func.lower(User.email).like(search_pattern),
                func.lower(User.username).like(search_pattern),
            )
        )

    bounded_limit = min(max(limit, 1), 100)
    faculty = faculty_query.order_by(User.name.asc()).limit(bounded_limit).all()

    return [
        CandidateFacultyItem(
            id=f.id,
            name=f.name,
            email=f.email or f.username,
            department_id=f.department_id,
            department_name=f.department_rel.name if f.department_rel else f.department_old,
            role=f.role.value,
        )
        for f in faculty
    ]

from __future__ import annotations
import os
import io
import logging
from typing import Optional, List
from fastapi import (
    APIRouter, Depends, HTTPException, Query, Request,
    status, UploadFile, File
)
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_credentials_set
from app.models.user import User, Role
from app.models.announcement import Announcement, AnnouncementAttachment
from app.schemas.announcement import (
    AnnouncementCreateIn, AnnouncementUpdateIn, AnnouncementListItemOut,
    AnnouncementDetailOut, AnnouncementAnalyticsOut, CandidateDirectoryOut,
    CandidateFacultyItem, PresignUploadIn, PresignUploadOut, MessageCreateIn, MessageOut,
    ReactionToggleIn
)
from app.services import announcement_service
from app.services.storage_service import (
    storage_service, generate_storage_key, validate_file_metadata,
    validate_file_magic_bytes, LocalStorageBackend
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/announcements", tags=["Announcements"])


@router.get("", response_model=List[AnnouncementListItemOut])
def list_announcements(
    tab: str = Query("all", description="all, unread, important, mentioned, ack_pending"),
    search: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Retrieves paginated announcements feed tailored to the user's role and targeting."""
    items, _ = announcement_service.list_announcements(
        db=db,
        current_user=current_user,
        tab=tab,
        search=search,
        announcement_type=type,
        priority=priority,
        department_id=department_id,
        page=page,
        limit=limit,
    )
    return items


@router.get("/unread-count")
def get_unread_announcements_count(
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Returns the count of unread visible announcements for the current user."""
    count = announcement_service.get_user_unread_count(db, current_user)
    return {"count": count}


@router.get("/candidates", response_model=CandidateDirectoryOut)
def get_candidates(
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Returns permissible departments and faculty recipients for audience selection."""
    return announcement_service.get_candidate_directory(db, current_user)


@router.post("", response_model=AnnouncementDetailOut, status_code=status.HTTP_201_CREATED)
def create_announcement(
    data: AnnouncementCreateIn,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Creates a draft, scheduled, or published announcement with audience targeting."""
    announcement = announcement_service.create_announcement(db, current_user, data)
    return announcement_service.get_announcement_detail(db, current_user, announcement.id)


@router.get("/{announcement_id}", response_model=AnnouncementDetailOut)
def get_announcement_detail(
    announcement_id: int,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Retrieves full circular details, attachments, and marks as read."""
    return announcement_service.get_announcement_detail(db, current_user, announcement_id)


@router.patch("/{announcement_id}", response_model=AnnouncementDetailOut)
def update_announcement(
    announcement_id: int,
    data: AnnouncementUpdateIn,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Edits announcement details or revisions with version bumping."""
    return announcement_service.update_announcement(db, current_user, announcement_id, data)


@router.delete("/{announcement_id}")
def delete_announcement(
    announcement_id: int,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Soft-deletes an announcement."""
    announcement_service.delete_announcement(db, current_user, announcement_id)
    return {"ok": True, "message": "Announcement deleted successfully."}


@router.post("/{announcement_id}/publish", response_model=AnnouncementDetailOut)
def publish_announcement(
    announcement_id: int,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Publishes a draft or scheduled announcement immediately."""
    return announcement_service.publish_announcement(db, current_user, announcement_id)


@router.post("/{announcement_id}/read")
def mark_announcement_read(
    announcement_id: int,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Explicitly marks an announcement as read."""
    announcement_service.get_announcement_detail(db, current_user, announcement_id)
    return {"ok": True}


@router.post("/{announcement_id}/acknowledge")
def acknowledge_announcement(
    announcement_id: int,
    request: Request,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Submits formal institutional acknowledgement."""
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")
    announcement_service.acknowledge_announcement(
        db=db,
        current_user=current_user,
        announcement_id=announcement_id,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return {"ok": True, "message": "Acknowledgement recorded successfully."}


@router.get("/{announcement_id}/analytics", response_model=AnnouncementAnalyticsOut)
def get_announcement_analytics(
    announcement_id: int,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Returns delivery, read, and acknowledgement metrics."""
    return announcement_service.get_announcement_analytics(db, current_user, announcement_id)


# ── Threaded Conversation Endpoints ──
@router.get("/{announcement_id}/mention-candidates", response_model=List[CandidateFacultyItem])
def get_mention_candidates(
    announcement_id: int,
    q: Optional[str] = Query(None, description="Search query for faculty name or email"),
    limit: int = Query(50, ge=1, le=100, description="Max candidates to return"),
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Returns permissible faculty members that current user can @mention in this announcement thread."""
    return announcement_service.get_mention_candidates(
        db=db,
        current_user=current_user,
        announcement_id=announcement_id,
        query=q,
        limit=limit,
    )


@router.get("/{announcement_id}/messages", response_model=List[MessageOut])
def get_conversation_messages(
    announcement_id: int,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Retrieves threaded messages and replies for an announcement."""
    return announcement_service.get_conversation_messages(db, current_user, announcement_id)


@router.post("/{announcement_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def post_message(
    announcement_id: int,
    data: MessageCreateIn,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Posts a message or reply in the announcement conversation."""
    return announcement_service.add_message(
        db=db,
        current_user=current_user,
        announcement_id=announcement_id,
        content=data.content,
        parent_message_id=data.parent_message_id,
        mentioned_user_ids=data.mentioned_user_ids,
    )


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Soft-deletes a message (preserves conversation continuity)."""
    announcement_service.delete_message(db, current_user, message_id)
    return {"ok": True}


@router.post("/messages/{message_id}/pin")
def toggle_pin_message(
    message_id: int,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Toggles pin status on a message (moderator action)."""
    is_pinned = announcement_service.toggle_pin_message(db, current_user, message_id)
    return {"ok": True, "is_pinned": is_pinned}


@router.post("/messages/{message_id}/reactions")
def toggle_reaction(
    message_id: int,
    data: ReactionToggleIn,
    current_user: User = Depends(require_credentials_set),
    db: Session = Depends(get_db),
):
    """Adds or removes an emoji reaction on a message."""
    return announcement_service.toggle_reaction(db, current_user, message_id, data.reaction)


# ── Storage & Attachment Endpoints ──
@router.post("/attachments/presign", response_model=PresignUploadOut)
def presign_attachment_upload(
    data: PresignUploadIn,
    current_user: User = Depends(require_credentials_set),
):
    """Authorizes an attachment upload and returns a presigned URL or signed token."""
    if not announcement_service.can_manage_announcements(current_user):
        raise HTTPException(status_code=403, detail="You do not have permission to upload attachments.")

    validate_file_metadata(data.file_name, data.file_type, data.file_size)
    storage_key = generate_storage_key("default", "temp", data.file_name)
    presigned = storage_service.generate_presigned_upload(
        storage_key=storage_key,
        file_name=data.file_name,
        file_type=data.file_type,
        file_size=data.file_size,
        expires_in=900,
    )
    return presigned


@router.post("/attachments/upload-stream")
async def upload_attachment_stream(
    request: Request,
    token: str = Query(...),
    file: UploadFile = File(...),
):
    """Direct streaming upload endpoint for LocalStorageBackend.
    Validates the signed token, inspects magic bytes, and streams file to disk."""
    if not isinstance(storage_service, LocalStorageBackend):
        raise HTTPException(status_code=400, detail="Streaming endpoint is only used with LocalStorageBackend.")

    token_data = storage_service.verify_token(token)
    storage_key = token_data["key"]
    declared_type = token_data["type"]
    expected_size = int(token_data["size"])

    bytes_written, sha256_hash = storage_service.save_file_stream(
        storage_key=storage_key,
        stream=file.file,
        expected_size=expected_size,
        declared_type=declared_type,
    )

    return {
        "ok": True,
        "storage_key": storage_key,
        "bytes_written": bytes_written,
        "checksum_sha256": sha256_hash,
    }


@router.get("/attachments/{attachment_id}/file")
def download_attachment_file(
    attachment_id: int,
    token: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Streams attachment file securely.
    Supports either a valid signed token (for direct browser preview) or authenticated bearer user session."""
    attachment = db.query(AnnouncementAttachment).filter(AnnouncementAttachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found.")

    authorized = False
    if token and isinstance(storage_service, LocalStorageBackend):
        try:
            token_data = storage_service.verify_token(token)
            if token_data.get("key") == attachment.storage_key:
                authorized = True
        except Exception:
            pass

    if not authorized and current_user:
        # Check announcement visibility for current_user
        announcement = attachment.announcement
        if announcement:
            if current_user.role in (Role.principal, Role.system_admin, Role.governance) or announcement.created_by_id == current_user.id:
                authorized = True
            else:
                recipients = announcement_service.resolve_recipient_user_ids(db, announcement)
                if current_user.id in recipients:
                    authorized = True

    if not authorized:
        raise HTTPException(status_code=403, detail="Unauthorized access to attachment.")

    file_path, stream, size = storage_service.get_file_path_or_stream(attachment.storage_key)
    if file_path and os.path.isfile(file_path):
        return FileResponse(
            path=file_path,
            filename=attachment.file_name,
            media_type=attachment.file_type,
            content_disposition_type="inline",
        )
    elif stream:
        return StreamingResponse(
            stream,
            media_type=attachment.file_type,
            headers={"Content-Disposition": f'inline; filename="{attachment.file_name}"'},
        )

    raise HTTPException(status_code=404, detail="File content not found.")


@router.get("/attachments/file")
def download_file_by_token(
    token: str = Query(...),
):
    """Direct tokenized download endpoint for presigned links."""
    if not isinstance(storage_service, LocalStorageBackend):
        raise HTTPException(status_code=400, detail="Token download endpoint is only for LocalStorageBackend.")

    token_data = storage_service.verify_token(token)
    storage_key = token_data["key"]
    file_name = token_data.get("name", "attachment")

    file_path, stream, size = storage_service.get_file_path_or_stream(storage_key)
    if file_path and os.path.isfile(file_path):
        import mimetypes
        mime_type, _ = mimetypes.guess_type(file_name)
        return FileResponse(
            path=file_path,
            filename=file_name,
            media_type=mime_type or "application/octet-stream",
            content_disposition_type="inline",
        )

    raise HTTPException(status_code=404, detail="File not found.")

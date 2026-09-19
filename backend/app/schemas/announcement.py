from __future__ import annotations
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

from app.models.announcement import (
    AnnouncementType, AnnouncementPriority, AnnouncementStatus, TargetType
)


# ── Target Schemas ──
class TargetIn(BaseModel):
    target_type: TargetType
    department_id: Optional[int] = None
    user_id: Optional[int] = None


class TargetOut(BaseModel):
    id: int
    target_type: str
    department_id: Optional[int] = None
    user_id: Optional[int] = None
    department_name: Optional[str] = None
    user_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ── Attachment Schemas ──
class PresignUploadIn(BaseModel):
    file_name: str = Field(..., max_length=255)
    file_type: str = Field(..., max_length=100)
    file_size: int = Field(..., gt=0)


class PresignUploadOut(BaseModel):
    upload_url: str
    storage_key: str
    file_name: str
    file_type: str
    file_size: int
    signed_token: Optional[str] = None
    expires_in: int


class CompleteAttachmentIn(BaseModel):
    file_name: str = Field(..., max_length=255)
    file_type: str = Field(..., max_length=100)
    file_size: int = Field(..., gt=0)
    storage_key: str = Field(..., max_length=500)
    checksum_sha256: Optional[str] = None


class AttachmentOut(BaseModel):
    id: int
    announcement_id: int
    file_name: str
    file_type: str
    file_size: int
    storage_key: str
    download_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Reaction & Mention Schemas ──
class ReactionOut(BaseModel):
    reaction: str
    count: int
    user_ids: List[int] = []
    user_names: List[str] = []
    has_reacted: bool = False


class ReactionToggleIn(BaseModel):
    reaction: str = Field(..., max_length=20)


class MentionOut(BaseModel):
    mentioned_user_id: int
    mentioned_user_name: str
    mention_text: str

    model_config = ConfigDict(from_attributes=True)


# ── Conversation / Message Schemas ──
class MessageCreateIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    parent_message_id: Optional[int] = None
    mentioned_user_ids: Optional[List[int]] = []


class MessageUpdateIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class MessageOut(BaseModel):
    id: int
    announcement_id: int
    parent_message_id: Optional[int] = None
    author_id: Optional[int] = None
    author_name: str
    author_role: str
    author_department: Optional[str] = None
    content: str
    is_pinned: bool = False
    is_deleted: bool = False
    is_edited: bool = False
    created_at: datetime
    updated_at: datetime
    reactions: List[ReactionOut] = []
    mentions: List[MentionOut] = []
    reply_count: int = 0
    replies: List[MessageOut] = []
    can_moderate: bool = False
    can_delete: bool = False

    model_config = ConfigDict(from_attributes=True)


# ── Announcement Schemas ──
class AnnouncementCreateIn(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    body: str = Field(..., min_length=5)
    type: AnnouncementType = AnnouncementType.GENERAL
    priority: AnnouncementPriority = AnnouncementPriority.NORMAL
    
    target_type: str = "COLLEGE"  # "COLLEGE", "DEPARTMENT", "MULTIPLE_DEPARTMENTS", "USER", "MULTIPLE_USERS"
    department_ids: Optional[List[int]] = []
    user_ids: Optional[List[int]] = []
    
    is_pinned: bool = False
    requires_acknowledgement: bool = False
    allow_replies: bool = True
    allow_reactions: bool = True
    allow_download: bool = True
    
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    attachments: Optional[List[CompleteAttachmentIn]] = []
    
    publish_now: bool = True
    idempotency_key: Optional[str] = None


class AnnouncementUpdateIn(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    body: Optional[str] = Field(None, min_length=5)
    type: Optional[AnnouncementType] = None
    priority: Optional[AnnouncementPriority] = None
    is_pinned: Optional[bool] = None
    requires_acknowledgement: Optional[bool] = None
    allow_replies: Optional[bool] = None
    allow_reactions: Optional[bool] = None
    allow_download: Optional[bool] = None
    is_locked: Optional[bool] = None
    revision_notes: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class AnnouncementListItemOut(BaseModel):
    id: int
    tenant_id: str
    title: str
    body_snippet: str
    type: str
    priority: str
    status: str
    target_summary: str
    is_pinned: bool
    requires_acknowledgement: bool
    allow_replies: bool
    allow_reactions: bool
    is_locked: bool
    version: int
    published_at: Optional[datetime] = None
    created_at: datetime
    
    created_by_id: Optional[int] = None
    author_name: str
    author_role: str
    department_name: Optional[str] = None
    
    attachment_count: int = 0
    attachments: List[AttachmentOut] = []
    reply_count: int = 0
    reactions_summary: List[Dict[str, Any]] = []
    
    is_read: bool = False
    is_acknowledged: bool = False
    
    can_delete: bool = False
    can_edit: bool = False
    
    model_config = ConfigDict(from_attributes=True)


class AnnouncementDetailOut(BaseModel):
    id: int
    tenant_id: str
    title: str
    body: str
    type: str
    priority: str
    status: str
    target_summary: str
    is_pinned: bool
    requires_acknowledgement: bool
    allow_replies: bool
    allow_reactions: bool
    allow_download: bool
    is_locked: bool
    version: int
    previous_version_id: Optional[int] = None
    revision_notes: Optional[str] = None
    published_at: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    created_by_id: Optional[int] = None
    author_name: str
    author_role: str
    department_name: Optional[str] = None
    
    targets: List[TargetOut] = []
    attachments: List[AttachmentOut] = []
    
    is_read: bool = False
    first_viewed_at: Optional[datetime] = None
    is_acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    
    can_edit: bool = False
    can_delete: bool = False
    can_reply: bool = False
    can_moderate: bool = False
    can_acknowledge: bool = False
    can_view_analytics: bool = False
    
    total_recipients: Optional[int] = None
    viewed_count: Optional[int] = None
    acknowledged_count: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


# ── Analytics Schemas ──
class RecipientStatItem(BaseModel):
    user_id: int
    name: str
    email: Optional[str] = None
    role: str
    department: Optional[str] = None
    has_viewed: bool
    first_viewed_at: Optional[datetime] = None
    has_acknowledged: bool
    acknowledged_at: Optional[datetime] = None


class AnnouncementAnalyticsOut(BaseModel):
    announcement_id: int
    title: str
    total_recipients: int
    viewed_count: int
    unread_count: int
    acknowledged_count: int
    pending_acknowledgement_count: int
    view_rate_pct: float
    acknowledgement_rate_pct: float
    requires_acknowledgement: bool
    published_at: Optional[datetime] = None
    recipients: List[RecipientStatItem] = []


# ── Recipient Candidate Selection ──
class CandidateFacultyItem(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    role: str


class CandidateDirectoryOut(BaseModel):
    departments: List[Dict[str, Any]]
    faculty: List[CandidateFacultyItem]

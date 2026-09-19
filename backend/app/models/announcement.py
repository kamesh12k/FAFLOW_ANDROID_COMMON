import enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, ForeignKey,
    DateTime, func, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.database import Base


class AnnouncementType(str, enum.Enum):
    GENERAL = "GENERAL"
    CIRCULAR = "CIRCULAR"
    NOTICE = "NOTICE"
    URGENT = "URGENT"
    ACADEMIC = "ACADEMIC"
    ADMINISTRATIVE = "ADMINISTRATIVE"
    EVENT = "EVENT"


class AnnouncementPriority(str, enum.Enum):
    NORMAL = "NORMAL"
    IMPORTANT = "IMPORTANT"
    HIGH = "HIGH"
    URGENT = "URGENT"


class AnnouncementStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    PUBLISHED = "PUBLISHED"
    EXPIRED = "EXPIRED"
    ARCHIVED = "ARCHIVED"
    DELETED = "DELETED"


class TargetType(str, enum.Enum):
    COLLEGE = "COLLEGE"
    DEPARTMENT = "DEPARTMENT"
    USER = "USER"


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), default="default", nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    type = Column(String(30), default=AnnouncementType.GENERAL.value, nullable=False, index=True)
    priority = Column(String(20), default=AnnouncementPriority.NORMAL.value, nullable=False, index=True)
    status = Column(String(20), default=AnnouncementStatus.DRAFT.value, nullable=False, index=True)

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)

    # Summary of audience targeting ("COLLEGE", "DEPARTMENT", "USER", "MULTIPLE_DEPARTMENTS", "MULTIPLE_USERS")
    target_summary = Column(String(50), default="COLLEGE", nullable=False)

    is_pinned = Column(Boolean, default=False, nullable=False, index=True)
    requires_acknowledgement = Column(Boolean, default=False, nullable=False, index=True)
    allow_replies = Column(Boolean, default=True, nullable=False)
    allow_reactions = Column(Boolean, default=True, nullable=False)
    allow_download = Column(Boolean, default=True, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)

    # Circular revision / versioning
    version = Column(Integer, default=1, nullable=False)
    previous_version_id = Column(Integer, ForeignKey("announcements.id", ondelete="SET NULL"), nullable=True)
    revision_notes = Column(Text, nullable=True)

    # Timestamps
    published_at = Column(DateTime(timezone=True), nullable=True, index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    author = relationship("User", foreign_keys=[created_by_id])
    department = relationship("Department", foreign_keys=[department_id])
    targets = relationship("AnnouncementTarget", back_populates="announcement", cascade="all, delete-orphan")
    attachments = relationship("AnnouncementAttachment", back_populates="announcement", cascade="all, delete-orphan")
    reads = relationship("AnnouncementRead", back_populates="announcement", cascade="all, delete-orphan")
    acknowledgements = relationship("AnnouncementAcknowledgement", back_populates="announcement", cascade="all, delete-orphan")
    messages = relationship("AnnouncementMessage", back_populates="announcement", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_announcements_feed", "tenant_id", "status", "published_at"),
    )


class AnnouncementTarget(Base):
    __tablename__ = "announcement_targets"

    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String(20), nullable=False, index=True)  # COLLEGE, DEPARTMENT, USER
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    announcement = relationship("Announcement", back_populates="targets")
    department = relationship("Department", foreign_keys=[department_id])
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index("idx_announcement_targets_lookup", "target_type", "department_id", "user_id"),
    )


class AnnouncementAttachment(Base):
    __tablename__ = "announcement_attachments"

    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    storage_key = Column(String(500), nullable=False)
    checksum_sha256 = Column(String(64), nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    announcement = relationship("Announcement", back_populates="attachments")
    uploader = relationship("User", foreign_keys=[uploaded_by_id])


class AnnouncementRead(Base):
    __tablename__ = "announcement_reads"

    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    first_viewed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_viewed_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    announcement = relationship("Announcement", back_populates="reads")
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint("announcement_id", "user_id", name="uq_announcement_user_read"),
    )


class AnnouncementAcknowledgement(Base):
    __tablename__ = "announcement_acknowledgements"

    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    acknowledged_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)

    announcement = relationship("Announcement", back_populates="acknowledgements")
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint("announcement_id", "user_id", name="uq_announcement_user_ack"),
    )


class AnnouncementMessage(Base):
    __tablename__ = "announcement_messages"

    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_message_id = Column(Integer, ForeignKey("announcement_messages.id", ondelete="CASCADE"), nullable=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    content = Column(Text, nullable=False)

    is_pinned = Column(Boolean, default=False, nullable=False, index=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    is_edited = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    announcement = relationship("Announcement", back_populates="messages")
    author = relationship("User", foreign_keys=[author_id])
    parent_message = relationship("AnnouncementMessage", remote_side=[id], backref="replies")
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")
    mentions = relationship("MessageMention", back_populates="message", cascade="all, delete-orphan")


class MessageReaction(Base):
    __tablename__ = "message_reactions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("announcement_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reaction = Column(String(20), nullable=False)  # emoji, e.g. 👍, ❤️, ✅, ❓, 👏
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    message = relationship("AnnouncementMessage", back_populates="reactions")
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint("message_id", "user_id", "reaction", name="uq_message_user_reaction"),
    )


class MessageMention(Base):
    __tablename__ = "message_mentions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("announcement_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    mentioned_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    mention_text = Column(String(100), nullable=False)  # e.g. "@Dr. Kumar"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    message = relationship("AnnouncementMessage", back_populates="mentions")
    mentioned_user = relationship("User", foreign_keys=[mentioned_user_id])

    __table_args__ = (
        UniqueConstraint("message_id", "mentioned_user_id", name="uq_message_user_mention"),
    )

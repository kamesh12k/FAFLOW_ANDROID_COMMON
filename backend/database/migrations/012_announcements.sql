-- ============================================================
-- Migration 012: Enterprise Announcements, Circulars & Conversations
-- ============================================================

-- ---------- 1. ANNOUNCEMENTS ----------
CREATE TABLE IF NOT EXISTS announcements (
    id                          SERIAL PRIMARY KEY,
    tenant_id                   VARCHAR(50) NOT NULL DEFAULT 'default',
    title                       VARCHAR(255) NOT NULL,
    body                        TEXT NOT NULL,
    type                        VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    priority                    VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    status                      VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,
    department_id               INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    target_summary              VARCHAR(50) NOT NULL DEFAULT 'COLLEGE',
    is_pinned                   BOOLEAN NOT NULL DEFAULT FALSE,
    requires_acknowledgement    BOOLEAN NOT NULL DEFAULT FALSE,
    allow_replies               BOOLEAN NOT NULL DEFAULT TRUE,
    allow_reactions             BOOLEAN NOT NULL DEFAULT TRUE,
    allow_download              BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked                   BOOLEAN NOT NULL DEFAULT FALSE,
    version                     INTEGER NOT NULL DEFAULT 1,
    previous_version_id         INTEGER REFERENCES announcements(id) ON DELETE SET NULL,
    revision_notes              TEXT,
    published_at                TIMESTAMPTZ,
    scheduled_at                TIMESTAMPTZ,
    expires_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_tenant_status ON announcements(tenant_id, status, published_at);
CREATE INDEX IF NOT EXISTS idx_announcements_dept ON announcements(department_id);
CREATE INDEX IF NOT EXISTS idx_announcements_author ON announcements(created_by_id);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(type);

-- ---------- 2. ANNOUNCEMENT TARGETS ----------
CREATE TABLE IF NOT EXISTS announcement_targets (
    id                  SERIAL PRIMARY KEY,
    announcement_id     INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    target_type         VARCHAR(20) NOT NULL,
    department_id       INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcement_targets_aid ON announcement_targets(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_targets_lookup ON announcement_targets(target_type, department_id, user_id);

-- ---------- 3. ANNOUNCEMENT ATTACHMENTS ----------
CREATE TABLE IF NOT EXISTS announcement_attachments (
    id                  SERIAL PRIMARY KEY,
    announcement_id     INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    file_name           VARCHAR(255) NOT NULL,
    file_type           VARCHAR(100) NOT NULL,
    file_size           INTEGER NOT NULL,
    storage_key         VARCHAR(500) NOT NULL,
    checksum_sha256     VARCHAR(64),
    uploaded_by_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcement_attachments_aid ON announcement_attachments(announcement_id);

-- ---------- 4. ANNOUNCEMENT READS ----------
CREATE TABLE IF NOT EXISTS announcement_reads (
    id                  SERIAL PRIMARY KEY,
    announcement_id     INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_viewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_viewed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_announcement_user_read UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_uid ON announcement_reads(user_id, announcement_id);

-- ---------- 5. ANNOUNCEMENT ACKNOWLEDGEMENTS ----------
CREATE TABLE IF NOT EXISTS announcement_acknowledgements (
    id                  SERIAL PRIMARY KEY,
    announcement_id     INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acknowledged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address          VARCHAR(50),
    user_agent          VARCHAR(255),
    CONSTRAINT uq_announcement_user_ack UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_acks_uid ON announcement_acknowledgements(user_id, announcement_id);

-- ---------- 6. ANNOUNCEMENT MESSAGES (CONVERSATION TREE) ----------
CREATE TABLE IF NOT EXISTS announcement_messages (
    id                  SERIAL PRIMARY KEY,
    announcement_id     INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    parent_message_id   INTEGER REFERENCES announcement_messages(id) ON DELETE CASCADE,
    author_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content             TEXT NOT NULL,
    is_pinned           BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    is_edited           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcement_msgs_aid ON announcement_messages(announcement_id, parent_message_id, created_at);
CREATE INDEX IF NOT EXISTS idx_announcement_msgs_author ON announcement_messages(author_id);

-- ---------- 7. MESSAGE REACTIONS ----------
CREATE TABLE IF NOT EXISTS message_reactions (
    id                  SERIAL PRIMARY KEY,
    message_id          INTEGER NOT NULL REFERENCES announcement_messages(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction            VARCHAR(20) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_message_user_reaction UNIQUE (message_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_mid ON message_reactions(message_id);

-- ---------- 8. MESSAGE MENTIONS ----------
CREATE TABLE IF NOT EXISTS message_mentions (
    id                  SERIAL PRIMARY KEY,
    message_id          INTEGER NOT NULL REFERENCES announcement_messages(id) ON DELETE CASCADE,
    mentioned_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mention_text        VARCHAR(100) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_message_user_mention UNIQUE (message_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_mentions_uid ON message_mentions(mentioned_user_id);

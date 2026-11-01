-- ==============================================================================
-- ShareLoop Database Schema (Flyway Migration V17)
-- ==============================================================================
-- Private chat image attachments.
-- 1. uploads registry (ownership, purpose, binding state)
-- 2. optional image reference on messages
-- 3. binding consistency guards
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UPLOADED FILES REGISTRY
-- ------------------------------------------------------------------------------
-- Tracks every image uploaded through POST /api/v1/files/upload so that chat
-- attachments can be bound to exactly one message and retrieved privately.
--
-- purpose:
--   GENERAL - generic upload (listing images, other future public consumers).
--   CHAT    - eligible for private chat attachment and orphan cleanup.
CREATE TABLE uploaded_files (
    id UUID PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content_type VARCHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL,
    purpose VARCHAR(16) NOT NULL DEFAULT 'GENERAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    bound_conversation_id UUID REFERENCES conversations (id) ON DELETE SET NULL,
    bound_message_id UUID REFERENCES messages (id) ON DELETE SET NULL,

    CONSTRAINT uq_uploaded_files_filename UNIQUE (filename),
    CONSTRAINT uq_uploaded_files_bound_message UNIQUE (bound_message_id),
    CONSTRAINT chk_uploaded_files_purpose CHECK (purpose IN ('GENERAL', 'CHAT')),
    CONSTRAINT chk_uploaded_files_size_positive CHECK (size_bytes > 0),
    CONSTRAINT chk_uploaded_files_binding_consistency CHECK (
        (bound_message_id IS NULL AND bound_conversation_id IS NULL)
        OR (bound_message_id IS NOT NULL AND bound_conversation_id IS NOT NULL)
    )
);

CREATE INDEX idx_uploaded_files_owner ON uploaded_files (owner_id);
CREATE INDEX idx_uploaded_files_cleanup
    ON uploaded_files (created_at)
    WHERE bound_message_id IS NULL AND purpose = 'CHAT';

COMMENT ON TABLE uploaded_files IS 'Registry of uploaded image files with ownership and chat binding state';
COMMENT ON COLUMN uploaded_files.purpose IS 'GENERAL uploads are never cleaned up; CHAT uploads are bound to a message or cleaned after TTL';
COMMENT ON COLUMN uploaded_files.bound_message_id IS 'The single chat message this upload is attached to; NULL while unbound';

-- ------------------------------------------------------------------------------
-- 2. MESSAGES: OPTIONAL IMAGE REFERENCE
-- ------------------------------------------------------------------------------
ALTER TABLE messages ADD COLUMN image_file_id UUID;

ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE messages DROP CONSTRAINT chk_messages_content_not_empty;

ALTER TABLE messages
    ADD CONSTRAINT chk_messages_content_or_image CHECK (
        image_file_id IS NOT NULL
        OR (content IS NOT NULL AND length(trim(content)) > 0)
    );

ALTER TABLE messages
    ADD CONSTRAINT fk_messages_image_file
    FOREIGN KEY (image_file_id) REFERENCES uploaded_files (id) ON DELETE RESTRICT;

CREATE INDEX idx_messages_image_file ON messages (image_file_id);

COMMENT ON COLUMN messages.content IS 'Trimmed text content; NULL only for image-only messages';
COMMENT ON COLUMN messages.image_file_id IS 'Optional single chat image attachment; private to conversation participants';

-- ------------------------------------------------------------------------------
-- 3. BINDING CONSISTENCY GUARDS
-- ------------------------------------------------------------------------------
-- Enforces, at commit time, that:
--   a) an attached upload is a CHAT upload owned by the message sender;
--   b) messages.image_file_id and uploaded_files.bound_message_id agree;
--   c) the bound conversation matches the message conversation.
-- Deferred so the message and the upload may be written in either order inside
-- the same transaction.
CREATE OR REPLACE FUNCTION validate_message_upload_binding()
RETURNS TRIGGER AS $$
DECLARE
    v_file RECORD;
    v_message RECORD;
BEGIN
    IF TG_TABLE_NAME = 'messages' THEN
        IF NEW.image_file_id IS NULL THEN
            RETURN NEW;
        END IF;

        SELECT id, owner_id, purpose, bound_conversation_id, bound_message_id
          INTO v_file
          FROM uploaded_files
         WHERE id = NEW.image_file_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Uploaded file % does not exist', NEW.image_file_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        IF v_file.purpose <> 'CHAT' THEN
            RAISE EXCEPTION 'Uploaded file % is not a chat attachment', NEW.image_file_id
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_file.owner_id <> NEW.sender_id THEN
            RAISE EXCEPTION 'Uploaded file % is not owned by message sender %',
                NEW.image_file_id, NEW.sender_id
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_file.bound_message_id IS DISTINCT FROM NEW.id
           OR v_file.bound_conversation_id IS DISTINCT FROM NEW.conversation_id THEN
            RAISE EXCEPTION 'Uploaded file % is not bound to message %',
                NEW.image_file_id, NEW.id
                USING ERRCODE = 'check_violation';
        END IF;
    ELSIF TG_TABLE_NAME = 'uploaded_files' THEN
        IF NEW.bound_message_id IS NULL THEN
            RETURN NEW;
        END IF;

        SELECT id, conversation_id, sender_id, image_file_id
          INTO v_message
          FROM messages
         WHERE id = NEW.bound_message_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Message % does not exist', NEW.bound_message_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        IF NEW.purpose <> 'CHAT' THEN
            RAISE EXCEPTION 'Uploaded file % is not a chat attachment', NEW.id
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_message.image_file_id IS DISTINCT FROM NEW.id
           OR v_message.conversation_id IS DISTINCT FROM NEW.bound_conversation_id THEN
            RAISE EXCEPTION 'Uploaded file % binding does not match message %',
                NEW.id, NEW.bound_message_id
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_message.sender_id IS DISTINCT FROM NEW.owner_id THEN
            RAISE EXCEPTION 'Uploaded file % is not owned by message sender %',
                NEW.id, v_message.sender_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_messages_validate_upload_binding
AFTER INSERT OR UPDATE ON messages
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_message_upload_binding();

CREATE CONSTRAINT TRIGGER trg_uploaded_files_validate_message_binding
AFTER INSERT OR UPDATE ON uploaded_files
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_message_upload_binding();

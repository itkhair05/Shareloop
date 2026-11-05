-- ==============================================================================
-- ShareLoop Database Schema (Flyway Migration V22)
-- ==============================================================================
-- Global File Binding & Upload Purpose Expansion
-- 1. Expand uploaded_files purpose check constraint to include REVIEW, REPORT, SUPPORT
-- 2. Create uploaded_file_bindings table with file_id PRIMARY KEY (guarantees exactly one binding per file)
-- 3. Backfill existing CHAT message bindings
-- 4. Triggers to synchronize Chat bound_message_id and enforce binding invariants
-- 5. Additional index for cleanup of unbound temporary uploads
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXPAND UPLOADED_FILES PURPOSE CONSTRAINT
-- ------------------------------------------------------------------------------
ALTER TABLE uploaded_files DROP CONSTRAINT IF EXISTS chk_uploaded_files_purpose;

ALTER TABLE uploaded_files ADD CONSTRAINT chk_uploaded_files_purpose
    CHECK (purpose IN ('GENERAL', 'CHAT', 'REVIEW', 'REPORT', 'SUPPORT'));

COMMENT ON COLUMN uploaded_files.purpose IS 'GENERAL (public listings/avatars), CHAT (private chat), REVIEW (review photos), REPORT (moderation evidence), SUPPORT (support screenshots)';

-- ------------------------------------------------------------------------------
-- 2. GLOBAL UPLOADED FILE BINDINGS TABLE
-- ------------------------------------------------------------------------------
-- Central registry of all active file bindings across domains.
-- file_id is the PRIMARY KEY, which guarantees at the database engine level
-- that a file can NEVER be bound to more than one domain record globally.
CREATE TABLE uploaded_file_bindings (
    file_id UUID PRIMARY KEY REFERENCES uploaded_files (id) ON DELETE CASCADE,
    bound_domain VARCHAR(32) NOT NULL,
    bound_entity_id UUID NOT NULL,
    bound_by_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_uploaded_file_bindings_domain CHECK (bound_domain IN ('CHAT', 'REVIEW', 'REPORT', 'SUPPORT'))
);

CREATE INDEX idx_uploaded_file_bindings_domain_entity
    ON uploaded_file_bindings (bound_domain, bound_entity_id);

CREATE INDEX idx_uploaded_file_bindings_bound_by
    ON uploaded_file_bindings (bound_by_id);

COMMENT ON TABLE uploaded_file_bindings IS 'Globally exclusive registry of uploaded file bindings across Chat, Reviews, Reports, and Support';
COMMENT ON COLUMN uploaded_file_bindings.file_id IS 'Primary key foreign key ensuring at most one binding per file globally';
COMMENT ON COLUMN uploaded_file_bindings.bound_domain IS 'Domain owning the attachment: CHAT, REVIEW, REPORT, SUPPORT';
COMMENT ON COLUMN uploaded_file_bindings.bound_entity_id IS 'ID of the parent entity in the bound domain';
COMMENT ON COLUMN uploaded_file_bindings.bound_by_id IS 'User who performed the binding; must match file owner_id';

-- ------------------------------------------------------------------------------
-- 3. BACKFILL EXISTING CHAT BINDINGS
-- ------------------------------------------------------------------------------
INSERT INTO uploaded_file_bindings (file_id, bound_domain, bound_entity_id, bound_by_id, created_at)
SELECT u.id, 'CHAT', u.bound_message_id, u.owner_id, u.created_at
FROM uploaded_files u
WHERE u.bound_message_id IS NOT NULL
ON CONFLICT (file_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. BINDING CONSISTENCY TRIGGERS
-- ------------------------------------------------------------------------------

-- Synchronizes Chat bound_message_id changes on uploaded_files into uploaded_file_bindings
CREATE OR REPLACE FUNCTION sync_uploaded_file_chat_binding()
RETURNS TRIGGER AS $$
BEGIN
    -- When bound_message_id is set or updated
    IF NEW.bound_message_id IS NOT NULL AND (OLD.bound_message_id IS NULL OR OLD.bound_message_id <> NEW.bound_message_id) THEN
        -- If already bound to another domain, reject
        IF EXISTS (
            SELECT 1 FROM uploaded_file_bindings 
            WHERE file_id = NEW.id AND (bound_domain <> 'CHAT' OR bound_entity_id <> NEW.bound_message_id)
        ) THEN
            RAISE EXCEPTION 'Uploaded file % is already bound to another domain record', NEW.id
                USING ERRCODE = 'check_violation';
        END IF;

        INSERT INTO uploaded_file_bindings (file_id, bound_domain, bound_entity_id, bound_by_id, created_at)
        VALUES (NEW.id, 'CHAT', NEW.bound_message_id, NEW.owner_id, CURRENT_TIMESTAMP)
        ON CONFLICT (file_id) DO UPDATE
            SET bound_domain = 'CHAT',
                bound_entity_id = EXCLUDED.bound_entity_id;
    -- When bound_message_id is cleared
    ELSIF NEW.bound_message_id IS NULL AND OLD.bound_message_id IS NOT NULL THEN
        DELETE FROM uploaded_file_bindings 
        WHERE file_id = NEW.id AND bound_domain = 'CHAT';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_uploaded_file_chat_binding ON uploaded_files;
CREATE TRIGGER trg_sync_uploaded_file_chat_binding
AFTER INSERT OR UPDATE OF bound_message_id ON uploaded_files
FOR EACH ROW
EXECUTE FUNCTION sync_uploaded_file_chat_binding();

-- Validates purpose, ownership, and exclusivity invariants on uploaded_file_bindings
CREATE OR REPLACE FUNCTION validate_uploaded_file_binding_invariants()
RETURNS TRIGGER AS $$
DECLARE
    v_file RECORD;
BEGIN
    SELECT id, owner_id, purpose, bound_message_id
      INTO v_file
      FROM uploaded_files
     WHERE id = NEW.file_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Uploaded file % does not exist', NEW.file_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- GENERAL uploads cannot be bound to domain records
    IF v_file.purpose = 'GENERAL' THEN
        RAISE EXCEPTION 'Uploaded file % with purpose GENERAL cannot be bound to domain %', NEW.file_id, NEW.bound_domain
            USING ERRCODE = 'check_violation';
    END IF;

    -- Purpose must match domain
    IF v_file.purpose <> NEW.bound_domain THEN
        RAISE EXCEPTION 'Uploaded file % with purpose % cannot be bound to domain %', NEW.file_id, v_file.purpose, NEW.bound_domain
            USING ERRCODE = 'check_violation';
    END IF;

    -- Caller must be file owner
    IF v_file.owner_id <> NEW.bound_by_id THEN
        RAISE EXCEPTION 'User % is not authorized to bind uploaded file % owned by %',
            NEW.bound_by_id, NEW.file_id, v_file.owner_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- If file has bound_message_id pointing to another message
    IF v_file.bound_message_id IS NOT NULL AND (NEW.bound_domain <> 'CHAT' OR v_file.bound_message_id <> NEW.bound_entity_id) THEN
        RAISE EXCEPTION 'Uploaded file % is already bound to chat message %',
            NEW.file_id, v_file.bound_message_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_uploaded_file_binding_invariants ON uploaded_file_bindings;
CREATE TRIGGER trg_validate_uploaded_file_binding_invariants
BEFORE INSERT OR UPDATE ON uploaded_file_bindings
FOR EACH ROW
EXECUTE FUNCTION validate_uploaded_file_binding_invariants();

-- ------------------------------------------------------------------------------
-- 5. EXTENDED CLEANUP INDEX
-- ------------------------------------------------------------------------------
CREATE INDEX idx_uploaded_files_cleanup_v2
    ON uploaded_files (created_at, purpose)
    WHERE bound_message_id IS NULL;


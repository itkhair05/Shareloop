-- ==============================================================================
-- ShareLoop Database Schema (Flyway Migration V23)
-- ==============================================================================
-- File binding lifecycle hardening.
-- 1. Explicit deletion lifecycle state for uploaded_files (ACTIVE / PENDING_DELETION)
-- 2. BEFORE trigger rejecting purpose, owner and chat-reference mutations that
--    would invalidate an existing binding
-- 3. Hardened binding invariants (deletion state + Chat legacy correspondence)
-- 4. Delete guards that protect evidence bindings and Chat legacy references
--
-- V22 is already applied and is not modified. Functions declared there are
-- replaced here with CREATE OR REPLACE, preserving their trigger bindings.
--
-- Trigger ordering (PostgreSQL fires same-timing triggers alphabetically):
--   uploaded_files BEFORE  : trg_protect_bound_uploaded_file_delete (DELETE only),
--                            trg_validate_uploaded_file_mutation
--   uploaded_files AFTER   : trg_sync_uploaded_file_chat_binding (V22, AFTER INSERT
--                            OR UPDATE OF bound_message_id) then the V18 deferred
--                            constraint trigger trg_uploaded_files_validate_message_binding
--   uploaded_file_bindings : trg_validate_uploaded_file_binding_invariants (BEFORE)
--                            and trg_protect_chat_binding_delete (BEFORE DELETE)
-- None of the new functions perform DML on a table that triggers another
-- function in the same table, so no recursive trigger execution is possible.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DELETION LIFECYCLE STATE
-- ------------------------------------------------------------------------------
-- ACTIVE            : file may be bound; cleanup may transition it to pending.
-- PENDING_DELETION  : file is no longer eligible for binding and the physical
--                     object is about to be removed. The row is finalized only
--                     after physical deletion succeeds.
ALTER TABLE uploaded_files
    ADD COLUMN deletion_state VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN pending_deletion_at TIMESTAMPTZ,
    ADD COLUMN deletion_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE uploaded_files
    ADD CONSTRAINT chk_uploaded_files_deletion_state
        CHECK (deletion_state IN ('ACTIVE', 'PENDING_DELETION'));

ALTER TABLE uploaded_files
    ADD CONSTRAINT chk_uploaded_files_deletion_metadata
        CHECK (
            (deletion_state = 'ACTIVE' AND pending_deletion_at IS NULL)
            OR (deletion_state = 'PENDING_DELETION' AND pending_deletion_at IS NOT NULL)
        );

ALTER TABLE uploaded_files
    ADD CONSTRAINT chk_uploaded_files_deletion_attempts_non_negative
        CHECK (deletion_attempts >= 0);

COMMENT ON COLUMN uploaded_files.deletion_state IS 'ACTIVE files may be bound; PENDING_DELETION files are unavailable for binding while physical deletion is pending';
COMMENT ON COLUMN uploaded_files.pending_deletion_at IS 'When the file entered PENDING_DELETION; NULL while ACTIVE';
COMMENT ON COLUMN uploaded_files.deletion_attempts IS 'Number of physical deletion attempts, for operational diagnostics of retries';

CREATE INDEX idx_uploaded_files_pending_deletion
    ON uploaded_files (pending_deletion_at)
    WHERE deletion_state = 'PENDING_DELETION';

CREATE INDEX idx_uploaded_files_cleanup_active
    ON uploaded_files (created_at, purpose)
    WHERE bound_message_id IS NULL AND deletion_state = 'ACTIVE';

-- ------------------------------------------------------------------------------
-- 2. UPLOADED FILE MUTATION GUARDS
-- ------------------------------------------------------------------------------
-- Rejects state transitions that would silently invalidate a binding:
--   a) a non-Chat file carrying a legacy Chat reference;
--   b) a pending-deletion file accepting a new Chat reference;
--   c) purpose mutation while a domain binding exists;
--   d) owner mutation while a domain binding exists.
--
-- This is defence in depth for direct SQL. Application authorization is still
-- enforced by the backend service; the database service account is shared and
-- cannot independently authenticate application users.
CREATE OR REPLACE FUNCTION validate_uploaded_file_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_has_binding BOOLEAN;
BEGIN
    IF NEW.bound_message_id IS NOT NULL AND NEW.purpose <> 'CHAT' THEN
        RAISE EXCEPTION 'Uploaded file % with purpose % cannot reference a chat message',
            NEW.id, NEW.purpose
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.deletion_state = 'PENDING_DELETION' AND NEW.bound_message_id IS NOT NULL THEN
        IF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'Uploaded file % is pending deletion and cannot be bound', NEW.id
                USING ERRCODE = 'check_violation';
        ELSIF OLD.bound_message_id IS DISTINCT FROM NEW.bound_message_id THEN
            RAISE EXCEPTION 'Uploaded file % is pending deletion and cannot be bound', NEW.id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        SELECT EXISTS (
            SELECT 1 FROM uploaded_file_bindings WHERE file_id = NEW.id
        ) INTO v_has_binding;

        IF v_has_binding AND NEW.purpose <> OLD.purpose THEN
            RAISE EXCEPTION 'Uploaded file % purpose cannot change while it is bound to a domain record', NEW.id
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_has_binding AND NEW.owner_id <> OLD.owner_id THEN
            RAISE EXCEPTION 'Uploaded file % owner cannot change while it is bound to a domain record', NEW.id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_uploaded_file_mutation ON uploaded_files;
CREATE TRIGGER trg_validate_uploaded_file_mutation
BEFORE INSERT OR UPDATE ON uploaded_files
FOR EACH ROW
EXECUTE FUNCTION validate_uploaded_file_mutation();

-- ------------------------------------------------------------------------------
-- 3. HARDENED BINDING INVARIANTS
-- ------------------------------------------------------------------------------
-- Replaces the V22 function. Adds:
--   a) pending-deletion files cannot receive any binding;
--   b) a Chat binding must correspond to uploaded_files.bound_message_id.
-- The remaining invariants (existence, non-GENERAL, purpose/domain match,
-- bound_by/owner match, no conflicting legacy reference) are unchanged.
CREATE OR REPLACE FUNCTION validate_uploaded_file_binding_invariants()
RETURNS TRIGGER AS $$
DECLARE
    v_file RECORD;
BEGIN
    SELECT id, owner_id, purpose, bound_message_id, deletion_state
      INTO v_file
      FROM uploaded_files
     WHERE id = NEW.file_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Uploaded file % does not exist', NEW.file_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_file.deletion_state <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Uploaded file % is pending deletion and cannot be bound', NEW.file_id
            USING ERRCODE = 'check_violation';
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

    -- Caller must be file owner (bound_by_id is supplied by the trusted backend)
    IF v_file.owner_id <> NEW.bound_by_id THEN
        RAISE EXCEPTION 'User % is not authorized to bind uploaded file % owned by %',
            NEW.bound_by_id, NEW.file_id, v_file.owner_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- A Chat binding must match the legacy Chat reference exactly
    IF NEW.bound_domain = 'CHAT'
       AND (v_file.bound_message_id IS NULL OR v_file.bound_message_id <> NEW.bound_entity_id) THEN
        RAISE EXCEPTION 'Chat binding for uploaded file % must match bound_message_id', NEW.file_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- If the file has a legacy Chat reference, the binding must be that Chat message
    IF v_file.bound_message_id IS NOT NULL
       AND (NEW.bound_domain <> 'CHAT' OR v_file.bound_message_id <> NEW.bound_entity_id) THEN
        RAISE EXCEPTION 'Uploaded file % is already bound to chat message %',
            NEW.file_id, v_file.bound_message_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 4. EVIDENCE DELETE GUARDS
-- ------------------------------------------------------------------------------

-- A Chat binding may only disappear after the legacy Chat reference is cleared.
-- The V22 synchronization trigger deletes the binding after bound_message_id has
-- already been set to NULL, so it still succeeds.
CREATE OR REPLACE FUNCTION protect_chat_binding_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_bound_message_id UUID;
BEGIN
    IF OLD.bound_domain = 'CHAT' THEN
        SELECT u.bound_message_id
          INTO v_bound_message_id
          FROM uploaded_files u
         WHERE u.id = OLD.file_id;

        IF FOUND AND v_bound_message_id IS NOT NULL THEN
            RAISE EXCEPTION 'Chat binding for uploaded file % cannot be deleted while message % still references it',
                OLD.file_id, v_bound_message_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_chat_binding_delete ON uploaded_file_bindings;
CREATE TRIGGER trg_protect_chat_binding_delete
BEFORE DELETE ON uploaded_file_bindings
FOR EACH ROW
EXECUTE FUNCTION protect_chat_binding_delete();

-- A bound file row (and its binding through ON DELETE CASCADE) must not be
-- removed implicitly. Evidence is released only through an explicit domain
-- decision in a later phase; cleanup only ever deletes unbound rows.
CREATE OR REPLACE FUNCTION protect_bound_uploaded_file_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM uploaded_file_bindings WHERE file_id = OLD.id) THEN
        RAISE EXCEPTION 'Uploaded file % is still bound to a domain record and cannot be deleted', OLD.id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_bound_uploaded_file_delete ON uploaded_files;
CREATE TRIGGER trg_protect_bound_uploaded_file_delete
BEFORE DELETE ON uploaded_files
FOR EACH ROW
EXECUTE FUNCTION protect_bound_uploaded_file_delete();

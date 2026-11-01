-- ==============================================================================
-- V18: SIMPLIFY CHAT UPLOAD BINDING
-- ==============================================================================
-- The bound conversation is derived from the bound message, so it is not stored
-- twice. Storing it twice made message deletion (which sets bound_message_id to
-- NULL through its foreign key) transiently violate the binding consistency
-- check. Binding correctness is still enforced by the deferred trigger below.
-- ==============================================================================

ALTER TABLE uploaded_files
    DROP CONSTRAINT IF EXISTS chk_uploaded_files_binding_consistency;

ALTER TABLE uploaded_files
    DROP COLUMN IF EXISTS bound_conversation_id;

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

        SELECT id, owner_id, purpose, bound_message_id
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

        IF v_file.bound_message_id IS DISTINCT FROM NEW.id THEN
            RAISE EXCEPTION 'Uploaded file % is not bound to message %',
                NEW.image_file_id, NEW.id
                USING ERRCODE = 'check_violation';
        END IF;
    ELSIF TG_TABLE_NAME = 'uploaded_files' THEN
        IF NEW.bound_message_id IS NULL THEN
            RETURN NEW;
        END IF;

        SELECT id, sender_id, image_file_id
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

        IF v_message.image_file_id IS DISTINCT FROM NEW.id THEN
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

COMMENT ON TABLE uploaded_files IS 'Registry of uploaded image files with ownership and chat binding state';
COMMENT ON COLUMN uploaded_files.bound_message_id IS 'The single chat message this upload is attached to; NULL while unbound; conversation derived from the message';

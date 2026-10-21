-- ==============================================================================
-- ShareLoop Database Schema (Flyway Migration V3)
-- ==============================================================================
-- 7. CONVERSATIONS
-- 8. MESSAGES
-- Invariant triggers and indexes for private member messaging.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 7. CONVERSATIONS
-- ------------------------------------------------------------------------------
-- Private communication channels between a listing owner and a prospective requester
-- regarding a specific listing.
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE RESTRICT,
    owner_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    requester_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    listing_request_id UUID REFERENCES listing_requests (id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_conversations_distinct_parties CHECK (owner_id <> requester_id),
    CONSTRAINT uq_conversations_listing_requester UNIQUE (listing_id, requester_id)
);

CREATE INDEX idx_conversations_owner ON conversations (owner_id);
CREATE INDEX idx_conversations_requester ON conversations (requester_id);
CREATE INDEX idx_conversations_listing ON conversations (listing_id);
CREATE INDEX idx_conversations_last_message_at ON conversations (last_message_at DESC NULLS LAST, created_at DESC, id DESC);

CREATE TRIGGER trg_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Invariant trigger: Validate conversation integrity against listing and listing_request
CREATE OR REPLACE FUNCTION validate_conversation_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_listing_owner_id UUID;
    v_req RECORD;
BEGIN
    -- 1. Ensure conversation owner_id matches listing.owner_id
    SELECT owner_id INTO v_listing_owner_id FROM listings WHERE id = NEW.listing_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing % does not exist', NEW.listing_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF NEW.owner_id <> v_listing_owner_id THEN
        RAISE EXCEPTION 'Conversation owner_id (%) does not match listing owner_id (%)',
            NEW.owner_id, v_listing_owner_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- 2. If listing_request_id is provided, verify it belongs to the same listing and requester
    IF NEW.listing_request_id IS NOT NULL THEN
        SELECT listing_id, requester_id INTO v_req FROM listing_requests WHERE id = NEW.listing_request_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Listing request % does not exist', NEW.listing_request_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        IF v_req.listing_id <> NEW.listing_id THEN
            RAISE EXCEPTION 'Conversation listing_request listing_id (%) does not match conversation listing_id (%)',
                v_req.listing_id, NEW.listing_id
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_req.requester_id <> NEW.requester_id THEN
            RAISE EXCEPTION 'Conversation listing_request requester_id (%) does not match conversation requester_id (%)',
                v_req.requester_id, NEW.requester_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_conversation_integrity
BEFORE INSERT OR UPDATE OF listing_id, owner_id, requester_id, listing_request_id ON conversations
FOR EACH ROW EXECUTE FUNCTION validate_conversation_integrity();

COMMENT ON TABLE conversations IS 'Private messaging channels between listing owner and inquiring requester';
COMMENT ON COLUMN conversations.last_message_at IS 'Timestamp of the latest message in this conversation; NULL if empty';

-- ------------------------------------------------------------------------------
-- 8. MESSAGES
-- ------------------------------------------------------------------------------
-- Individual chat messages within a conversation.
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_messages_content_not_empty CHECK (length(trim(content)) > 0)
);

CREATE INDEX idx_messages_conversation_created ON messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX idx_messages_sender ON messages (sender_id);

-- Invariant trigger: Validate that sender is an actual participant of the conversation
CREATE OR REPLACE FUNCTION validate_message_sender_is_participant()
RETURNS TRIGGER AS $$
DECLARE
    v_conv RECORD;
BEGIN
    SELECT owner_id, requester_id INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation % does not exist', NEW.conversation_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF NEW.sender_id <> v_conv.owner_id AND NEW.sender_id <> v_conv.requester_id THEN
        RAISE EXCEPTION 'Sender % is not a participant in conversation %',
            NEW.sender_id, NEW.conversation_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_message_sender_is_participant
BEFORE INSERT OR UPDATE OF conversation_id, sender_id ON messages
FOR EACH ROW EXECUTE FUNCTION validate_message_sender_is_participant();

COMMENT ON TABLE messages IS 'Itemized chat messages belonging to a conversation thread';
COMMENT ON COLUMN messages.content IS 'Trimmed non-empty text message content';

-- ------------------------------------------------------------------------------
-- 9. CROSS-TABLE INVARIANT GUARDS
-- ------------------------------------------------------------------------------
-- Invariant trigger: Prevent reassigning listing owner if conversations already exist
CREATE OR REPLACE FUNCTION prevent_listing_owner_change_if_conversations_exist()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.owner_id <> OLD.owner_id THEN
        IF EXISTS (SELECT 1 FROM conversations WHERE listing_id = OLD.id) THEN
            RAISE EXCEPTION 'Cannot change owner of listing % because conversations exist for it', OLD.id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_listing_owner_conversations
BEFORE UPDATE OF owner_id ON listings
FOR EACH ROW EXECUTE FUNCTION prevent_listing_owner_change_if_conversations_exist();

-- Invariant trigger: Prevent modifying listing or requester on a request linked to a conversation
CREATE OR REPLACE FUNCTION prevent_linked_request_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.listing_id <> OLD.listing_id OR NEW.requester_id <> OLD.requester_id THEN
        IF EXISTS (SELECT 1 FROM conversations WHERE listing_request_id = OLD.id) THEN
            RAISE EXCEPTION 'Cannot change listing or requester on listing request % because a conversation is linked to it', OLD.id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_linked_request_mutation
BEFORE UPDATE OF listing_id, requester_id ON listing_requests
FOR EACH ROW EXECUTE FUNCTION prevent_linked_request_mutation();


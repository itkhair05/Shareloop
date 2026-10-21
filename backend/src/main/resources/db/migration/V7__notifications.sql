-- ==============================================================================
-- ShareLoop Database Schema (Flyway Migration V7)
-- ==============================================================================
-- 11. NOTIFICATIONS
-- In-app notifications for listing requests, chat messages, and transaction events.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    reference_type VARCHAR(50),
    reference_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Title length and non-blank check
    CONSTRAINT chk_notifications_title_not_blank CHECK (
        length(trim(title)) > 0 AND length(title) <= 255
    ),

    -- Message length and non-blank check
    CONSTRAINT chk_notifications_message_not_blank CHECK (
        length(trim(message)) > 0 AND length(message) <= 1000
    ),

    -- Read-state metadata consistency:
    -- If is_read is false, read_at must be NULL.
    -- If is_read is true, read_at must be NOT NULL.
    CONSTRAINT chk_notifications_read_consistency CHECK (
        (is_read = FALSE AND read_at IS NULL) OR (is_read = TRUE AND read_at IS NOT NULL)
    )
);

-- Indexes:
-- 1. Recipient feed: newest notifications first (deterministic ordering)
CREATE INDEX idx_notifications_recipient_created ON notifications (recipient_id, created_at DESC, id DESC);

-- 2. Unread count query: fast count of unread notifications for a recipient
CREATE INDEX idx_notifications_recipient_unread ON notifications (recipient_id) WHERE is_read = FALSE;

-- 3. Navigation by related reference
CREATE INDEX idx_notifications_reference ON notifications (reference_type, reference_id);

-- ------------------------------------------------------------------------------
-- 2. TRIGGERS
-- ------------------------------------------------------------------------------

-- Generic updated_at trigger (reuses set_updated_at from V1)
CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE notifications IS 'In-app user notifications for circular exchange domain events';
COMMENT ON COLUMN notifications.type IS 'Event type such as REQUEST_RECEIVED, REQUEST_ACCEPTED, REQUEST_REJECTED, CHAT_MESSAGE, TRANSACTION_COMPLETED';
COMMENT ON COLUMN notifications.is_read IS 'Read state boolean flag';
COMMENT ON COLUMN notifications.read_at IS 'Timestamp when notification was marked as read';

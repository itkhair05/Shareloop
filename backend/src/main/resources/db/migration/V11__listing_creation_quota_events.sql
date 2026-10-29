-- ==============================================================================
-- V11: LISTING CREATION QUOTA EVENTS
-- Tracks listing creation events independently of the listing lifecycle
-- to enforce a rolling 24-hour quota of at most 10 listings per user.
-- ==============================================================================

CREATE TABLE listing_creation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_listing_creation_events_user_time ON listing_creation_events (user_id, created_at DESC);
CREATE INDEX idx_listing_creation_events_created_at ON listing_creation_events (created_at);

COMMENT ON TABLE listing_creation_events IS 'Audit records of successful listing creations for rolling quota enforcement';
COMMENT ON COLUMN listing_creation_events.user_id IS 'User who created the listing; cascaded on test cleanup';
COMMENT ON COLUMN listing_creation_events.created_at IS 'Timestamp of the creation event';

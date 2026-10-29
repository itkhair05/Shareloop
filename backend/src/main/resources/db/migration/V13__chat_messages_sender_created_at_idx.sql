-- ==============================================================================
-- V13: CHAT MESSAGES SENDER CREATED AT INDEX
-- Optimizes query performance for sender-scoped rolling window chat rate limiting
-- ==============================================================================

CREATE INDEX idx_messages_sender_created_at ON messages (sender_id, created_at DESC);

-- ==============================================================================
-- V14: PASSWORD RESET TOKENS AND RATE LIMITING ATTEMPTS
-- ==============================================================================

-- 1. Password Reset Tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id, created_at DESC);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens (expires_at) WHERE used_at IS NULL;

COMMENT ON TABLE password_reset_tokens IS 'Stores hashed single-use tokens for password reset operations';
COMMENT ON COLUMN password_reset_tokens.token_hash IS 'SHA-256 hex hash of the raw token';

-- 2. Forgot Password Rate Limiting Attempts
CREATE TABLE forgot_password_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    email_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_forgot_password_attempts_ip_time ON forgot_password_attempts (ip_address, created_at DESC);
CREATE INDEX idx_forgot_password_attempts_email_time ON forgot_password_attempts (email_hash, created_at DESC);
CREATE INDEX idx_forgot_password_attempts_created_at ON forgot_password_attempts (created_at);

COMMENT ON TABLE forgot_password_attempts IS 'Audit log of forgot password requests for rate limiting without storing plaintext emails';
COMMENT ON COLUMN forgot_password_attempts.email_hash IS 'Keyed HMAC-SHA256 of normalized target email';

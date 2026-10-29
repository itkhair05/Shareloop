-- ==============================================================================
-- V12: LOGIN ATTEMPTS
-- Tracks IP-based login attempts for rolling 1-minute rate limiting
-- ==============================================================================

CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_attempts_ip_time ON login_attempts (ip_address, created_at DESC);
CREATE INDEX idx_login_attempts_created_at ON login_attempts (created_at);

COMMENT ON TABLE login_attempts IS 'Audit log of login attempts for IP-based rate limiting';
COMMENT ON COLUMN login_attempts.ip_address IS 'Client IP address (IPv4 or IPv6)';
COMMENT ON COLUMN login_attempts.created_at IS 'Timestamp of the login attempt';

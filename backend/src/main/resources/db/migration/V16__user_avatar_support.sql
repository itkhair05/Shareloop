-- ==============================================================================
-- V16: USER AVATAR SUPPORT
-- ==============================================================================

-- 1. Add avatar columns to users table
ALTER TABLE users
    ADD COLUMN avatar_url VARCHAR(1024) DEFAULT NULL,
    ADD COLUMN google_avatar_url VARCHAR(1024) DEFAULT NULL,
    ADD COLUMN avatar_updated_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN users.avatar_url IS 'Relative or absolute URL of user-uploaded custom avatar';
COMMENT ON COLUMN users.google_avatar_url IS 'External profile image URL provided by Google OAuth identity';
COMMENT ON COLUMN users.avatar_updated_at IS 'Timestamp when custom avatar was last uploaded, updated, or removed';

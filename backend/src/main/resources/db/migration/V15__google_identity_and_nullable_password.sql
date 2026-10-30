-- ==============================================================================
-- V15: GOOGLE IDENTITY MODEL AND NULLABLE USER PASSWORD HASH
-- ==============================================================================

-- 1. Allow password_hash to be NULL for OAuth/Google-only users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

COMMENT ON COLUMN users.password_hash IS 'BCrypt hashed password; nullable for OAuth2/Google federated accounts';

-- 2. User Identities table for external authentication providers (e.g. Google)
CREATE TABLE user_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_identities_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_user_identities_provider CHECK (provider IN ('GOOGLE')),
    CONSTRAINT uq_user_identities_provider_subject UNIQUE (provider, provider_subject),
    CONSTRAINT uq_user_identities_user_provider UNIQUE (user_id, provider)
);

CREATE TRIGGER trg_user_identities_updated_at
BEFORE UPDATE ON user_identities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE user_identities IS 'External identity provider accounts linked to ShareLoop user profiles';
COMMENT ON COLUMN user_identities.user_id IS 'Foreign key referencing the parent users record; deleted via CASCADE when user is removed';
COMMENT ON COLUMN user_identities.provider IS 'Identity provider name (e.g. GOOGLE)';
COMMENT ON COLUMN user_identities.provider_subject IS 'Stable unique subject identifier issued by provider (e.g. sub)';
COMMENT ON COLUMN user_identities.provider_email IS 'Verified email address associated with the provider account';

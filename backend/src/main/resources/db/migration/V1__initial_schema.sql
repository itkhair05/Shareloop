-- ==============================================================================
-- ShareLoop Initial Database Schema (Flyway Migration V1)
-- ==============================================================================
-- Portfolio-quality schema for community item sharing, second-hand trading,
-- and wanted-item requests.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Helper Functions & Triggers
-- ------------------------------------------------------------------------------

-- Generic function to automatically update updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. USERS
-- ------------------------------------------------------------------------------
-- Manages platform member identity, roles, and security credentials.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_email_lowercase CHECK (email = LOWER(email)),
    CONSTRAINT chk_users_phone_format CHECK (phone_number IS NULL OR phone_number ~ '^\+?[1-9]\d{1,14}$'),
    CONSTRAINT chk_users_role CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED'))
);

CREATE INDEX idx_users_status ON users (status);
CREATE INDEX idx_users_role ON users (role);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE users IS 'Registered community members with roles and security credentials';
COMMENT ON COLUMN users.password_hash IS 'BCrypt/Argon2 hashed password; plaintext passwords must never be stored';
COMMENT ON COLUMN users.email IS 'Normalized, lowercase unique email address';

-- ------------------------------------------------------------------------------
-- 2. CATEGORIES
-- ------------------------------------------------------------------------------
-- Taxonomical categorization for item discovery (e.g., Tools, Electronics, Books).
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_categories_slug UNIQUE (slug),
    CONSTRAINT chk_categories_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX idx_categories_is_active ON categories (is_active);

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE categories IS 'Categories for classifying community listings';
COMMENT ON COLUMN categories.slug IS 'URL-friendly unique kebab-case identifier';

-- ------------------------------------------------------------------------------
-- 3. LISTINGS
-- ------------------------------------------------------------------------------
-- Core marketplace entries: giveaways, second-hand sales, and wanted requests.
CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    listing_type VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10, 2),
    currency VARCHAR(3),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    neighborhood VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL DEFAULT 'US',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,

    CONSTRAINT chk_listings_type CHECK (listing_type IN ('GIVEAWAY', 'SALE', 'WANTED')),
    CONSTRAINT chk_listings_status CHECK (status IN ('DRAFT', 'ACTIVE', 'RESERVED', 'COMPLETED', 'CANCELLED', 'REMOVED')),
    CONSTRAINT chk_listings_price_rules CHECK (
        (listing_type = 'GIVEAWAY' AND price IS NULL) OR
        (listing_type = 'SALE' AND price IS NOT NULL AND price > 0) OR
        (listing_type = 'WANTED' AND (price IS NULL OR price > 0))
    ),
    CONSTRAINT chk_listings_currency_rules CHECK (
        (price IS NULL AND currency IS NULL) OR
        (price IS NOT NULL AND currency IS NOT NULL AND LENGTH(currency) = 3)
    ),
    CONSTRAINT chk_listings_expiration CHECK (
        expires_at IS NULL OR expires_at > created_at
    )
);

CREATE INDEX idx_listings_owner_id ON listings (owner_id);
CREATE INDEX idx_listings_category_id ON listings (category_id);
CREATE INDEX idx_listings_type_status ON listings (listing_type, status);
CREATE INDEX idx_listings_city_status ON listings (city, status);
CREATE INDEX idx_listings_created_at ON listings (created_at DESC);

CREATE TRIGGER trg_listings_updated_at
BEFORE UPDATE ON listings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE listings IS 'Community posts including giveaways, second-hand sale items, and wanted requests';
COMMENT ON COLUMN listings.neighborhood IS 'General neighborhood or locality without exposing private residential addresses';
COMMENT ON COLUMN listings.price IS 'Mandatory positive price for SALE, forbidden for GIVEAWAY, optional positive budget for WANTED';

-- ------------------------------------------------------------------------------
-- 4. LISTING_IMAGES
-- ------------------------------------------------------------------------------
-- Visual assets attached to listings with ordered presentation.
CREATE TABLE listing_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
    image_url VARCHAR(1024) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_listing_images_sort_order CHECK (sort_order >= 0)
);

CREATE INDEX idx_listing_images_listing_sort ON listing_images (listing_id, sort_order ASC);

COMMENT ON TABLE listing_images IS 'Uploaded images associated with a listing; cascades on listing deletion';

-- ------------------------------------------------------------------------------
-- 5. LISTING_REQUESTS
-- ------------------------------------------------------------------------------
-- Expressions of interest or fulfillment offers between community members.
-- For GIVEAWAY and SALE listings: a request from a member to obtain/buy the item.
-- For WANTED listings: an offer from a member to supply/fulfill the requested item.
CREATE TABLE listing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE RESTRICT,
    requester_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_listing_requests_status CHECK (
        status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'CANCELLED')
    )
);

-- Indexing foreign keys and statuses
CREATE INDEX idx_listing_requests_listing_id ON listing_requests (listing_id);
CREATE INDEX idx_listing_requests_requester_id ON listing_requests (requester_id);
CREATE INDEX idx_listing_requests_status ON listing_requests (status);

-- Prevent duplicate active pending requests from the same user for the same listing
CREATE UNIQUE INDEX uq_listing_requests_pending_requester
ON listing_requests (listing_id, requester_id)
WHERE status = 'PENDING';

-- Invariant trigger: Prevent users from requesting or offering on their own listings
CREATE OR REPLACE FUNCTION check_listing_request_not_self()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT owner_id INTO v_owner_id FROM listings WHERE id = NEW.listing_id;
    IF v_owner_id = NEW.requester_id THEN
        RAISE EXCEPTION 'Users cannot request or make offers on their own listings (listing_id: %, requester_id: %)',
            NEW.listing_id, NEW.requester_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_listing_request_not_self
BEFORE INSERT OR UPDATE ON listing_requests
FOR EACH ROW EXECUTE FUNCTION check_listing_request_not_self();

CREATE TRIGGER trg_listing_requests_updated_at
BEFORE UPDATE ON listing_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE listing_requests IS 'Inquiries and exchange requests; represents fulfillment offers on WANTED listings';
COMMENT ON COLUMN listing_requests.status IS 'Lifecycle: PENDING -> ACCEPTED / REJECTED / WITHDRAWN / CANCELLED';

-- ------------------------------------------------------------------------------
-- 6. TRANSACTIONS
-- ------------------------------------------------------------------------------
-- Mutual completion ledger once a listing request has been accepted.
-- A transaction represents the agreed exchange contract.
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_request_id UUID NOT NULL REFERENCES listing_requests (id) ON DELETE RESTRICT,
    listing_id UUID NOT NULL REFERENCES listings (id) ON DELETE RESTRICT,
    owner_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    requester_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    owner_completed BOOLEAN NOT NULL DEFAULT FALSE,
    requester_completed BOOLEAN NOT NULL DEFAULT FALSE,
    owner_completed_at TIMESTAMPTZ,
    requester_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_transactions_request UNIQUE (listing_request_id),
    CONSTRAINT chk_transactions_distinct_parties CHECK (owner_id <> requester_id),
    CONSTRAINT chk_transactions_status CHECK (
        status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
    ),
    CONSTRAINT chk_transactions_completed_status CHECK (
        (status <> 'COMPLETED') OR (owner_completed = TRUE AND requester_completed = TRUE)
    ),
    CONSTRAINT chk_transactions_owner_confirm_timestamp CHECK (
        (owner_completed = FALSE AND owner_completed_at IS NULL) OR
        (owner_completed = TRUE AND owner_completed_at IS NOT NULL)
    ),
    CONSTRAINT chk_transactions_requester_confirm_timestamp CHECK (
        (requester_completed = FALSE AND requester_completed_at IS NULL) OR
        (requester_completed = TRUE AND requester_completed_at IS NOT NULL)
    )
);

CREATE INDEX idx_transactions_listing_id ON transactions (listing_id);
CREATE INDEX idx_transactions_owner_id ON transactions (owner_id);
CREATE INDEX idx_transactions_requester_id ON transactions (requester_id);
CREATE INDEX idx_transactions_status ON transactions (status);

-- Ensure a listing has at most one non-cancelled transaction in flight or finished
CREATE UNIQUE INDEX uq_transactions_active_or_completed_listing
ON transactions (listing_id)
WHERE status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED');

CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE transactions IS 'Official exchange lifecycle ledger tracking mutual owner and requester confirmations';
COMMENT ON COLUMN transactions.status IS 'Requires mutual confirmation (owner_completed and requester_completed) to reach COMPLETED';

-- Reporting queries filter by creation timestamp within a date range.
-- listings(created_at DESC) already exists from V1.
CREATE INDEX idx_users_created_at ON users (created_at);

CREATE INDEX idx_listing_requests_created_at ON listing_requests (created_at);

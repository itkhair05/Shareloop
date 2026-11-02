-- Phase 3.1 reporting queries filter by created_at and aggregate by current status/category.
-- Existing indexes lead with requester/reporter/reviewee/status/category or are partial,
-- so none can efficiently serve an unfiltered created_at range scan.

CREATE INDEX idx_transactions_created_at ON transactions (created_at);
CREATE INDEX idx_reports_created_at ON reports (created_at);
CREATE INDEX idx_reviews_created_at ON reviews (created_at);
CREATE INDEX idx_support_requests_created_at ON support_requests (created_at);

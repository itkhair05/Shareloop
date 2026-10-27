-- ==============================================================================
-- ShareLoop Database Schema (Flyway Migration V10)
-- ==============================================================================
-- Phase 2A: Support Requests & Violation Reports
-- 1. Support Requests table (contact admin, transaction support, user inquiries)
-- 2. Violation Reports table (moderation reporting for users, listings, transactions, reviews)
-- 3. Invariant check constraints, partial unique index, and triggers
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SUPPORT REQUESTS
-- ------------------------------------------------------------------------------
CREATE TABLE support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    transaction_id UUID REFERENCES transactions (id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    admin_response VARCHAR(2000),
    admin_notes VARCHAR(2000),
    resolved_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Category validity check
    CONSTRAINT chk_support_requests_category CHECK (
        category IN ('TRANSACTION_ISSUE', 'ACCOUNT_ISSUE', 'SAFETY_CONCERN', 'OTHER')
    ),

    -- Status lifecycle check
    CONSTRAINT chk_support_requests_status CHECK (
        status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')
    ),

    -- Subject length and non-blank check
    CONSTRAINT chk_support_requests_subject_not_blank CHECK (
        length(trim(subject)) > 0 AND length(subject) <= 200
    ),

    -- Description length and non-blank check
    CONSTRAINT chk_support_requests_description_not_blank CHECK (
        length(trim(description)) > 0 AND length(description) <= 2000
    )
);

CREATE INDEX idx_support_requests_requester ON support_requests (requester_id, created_at DESC);
CREATE INDEX idx_support_requests_status ON support_requests (status, created_at DESC);
CREATE INDEX idx_support_requests_category ON support_requests (category, created_at DESC);
CREATE INDEX idx_support_requests_transaction ON support_requests (transaction_id);

CREATE TRIGGER trg_support_requests_updated_at
BEFORE UPDATE ON support_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE support_requests IS 'User-submitted support inquiries and transaction assistance requests';
COMMENT ON COLUMN support_requests.category IS 'Inquiry category: TRANSACTION_ISSUE, ACCOUNT_ISSUE, SAFETY_CONCERN, OTHER';
COMMENT ON COLUMN support_requests.status IS 'Lifecycle status: PENDING, IN_PROGRESS, RESOLVED, CLOSED';
COMMENT ON COLUMN support_requests.admin_response IS 'Public resolution message visible to the requester';
COMMENT ON COLUMN support_requests.admin_notes IS 'Internal administrative notes restricted to platform staff';

-- ------------------------------------------------------------------------------
-- 2. VIOLATION REPORTS
-- ------------------------------------------------------------------------------
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    resolution_notes VARCHAR(2000),
    resolved_by_id UUID REFERENCES users (id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Target type validity check
    CONSTRAINT chk_reports_target_type CHECK (
        target_type IN ('USER', 'LISTING', 'TRANSACTION', 'REVIEW')
    ),

    -- Category validity check
    CONSTRAINT chk_reports_category CHECK (
        category IN ('FRAUD_OR_SCAM', 'HARASSMENT', 'ITEM_MISREPRESENTED', 'NO_SHOW_OR_UNRESPONSIVE', 'PROHIBITED_ITEM', 'OTHER')
    ),

    -- Status lifecycle check
    CONSTRAINT chk_reports_status CHECK (
        status IN ('PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')
    ),

    -- Description length and non-blank check
    CONSTRAINT chk_reports_description_not_blank CHECK (
        length(trim(description)) > 0 AND length(description) <= 2000
    ),

    -- Prevent self-reporting when target_type is USER
    CONSTRAINT chk_reports_no_self_user_report CHECK (
        target_type != 'USER' OR target_id != reporter_id
    )
);

-- Partial unique index: prevent duplicate concurrent active reports from the same reporter against the same target.
-- Allows legitimate future reports once an earlier report has been RESOLVED or DISMISSED.
CREATE UNIQUE INDEX idx_unique_active_report_per_target
    ON reports (reporter_id, target_type, target_id)
    WHERE status IN ('PENDING', 'INVESTIGATING');

CREATE INDEX idx_reports_reporter ON reports (reporter_id, created_at DESC);
CREATE INDEX idx_reports_status ON reports (status, created_at DESC);
CREATE INDEX idx_reports_target ON reports (target_type, target_id);

CREATE TRIGGER trg_reports_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE reports IS 'User-submitted reports for platform violations, fraud, and misconduct';
COMMENT ON COLUMN reports.target_type IS 'Domain entity type: USER, LISTING, TRANSACTION, REVIEW';
COMMENT ON COLUMN reports.category IS 'Violation category such as FRAUD_OR_SCAM, HARASSMENT, ITEM_MISREPRESENTED, etc.';
COMMENT ON COLUMN reports.status IS 'Lifecycle status: PENDING, INVESTIGATING, RESOLVED, DISMISSED';
COMMENT ON COLUMN reports.resolution_notes IS 'Administrative notes describing findings and disposition';

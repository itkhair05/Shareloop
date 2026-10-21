-- ==============================================================================
-- ShareLoop Database Schema (Flyway Migration V6)
-- ==============================================================================
-- 10. REVIEWS & RATINGS
-- Invariant triggers, check constraints, unique index, and foreign keys
-- for post-transaction community ratings and feedback.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REVIEWS TABLE
-- ------------------------------------------------------------------------------
-- Verified exchange reviews between transaction owner and requester.
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions (id) ON DELETE RESTRICT,
    reviewer_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    reviewee_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    rating INTEGER NOT NULL,
    comment VARCHAR(1000),
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    moderated_by UUID REFERENCES users (id) ON DELETE RESTRICT,
    moderated_at TIMESTAMPTZ,
    moderation_reason VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Distinct parties
    CONSTRAINT chk_reviews_distinct_parties CHECK (reviewer_id <> reviewee_id),

    -- Rating range: 1 to 5 stars
    CONSTRAINT chk_reviews_rating_range CHECK (rating >= 1 AND rating <= 5),

    -- Comment length and non-empty check
    CONSTRAINT chk_reviews_comment_length CHECK (
        comment IS NULL OR (length(trim(comment)) > 0 AND length(comment) <= 1000)
    ),

    -- Moderation reason length and non-empty check
    CONSTRAINT chk_reviews_moderation_reason_length CHECK (
        moderation_reason IS NULL OR (length(trim(moderation_reason)) > 0 AND length(moderation_reason) <= 500)
    ),

    -- Cardinality: At most one review per reviewer per transaction
    -- Serves as index on transaction_id (leading column)
    CONSTRAINT uq_reviews_transaction_reviewer UNIQUE (transaction_id, reviewer_id)
);

-- Indexes based on actual query patterns:
-- 1. Public retrieval of active reviews for a user: WHERE reviewee_id = :id AND is_hidden = FALSE ORDER BY created_at DESC
CREATE INDEX idx_reviews_reviewee_active_created ON reviews (reviewee_id, created_at DESC) WHERE is_hidden = FALSE;

-- 2. Aggregation query for rating summary: WHERE reviewee_id = :id AND is_hidden = FALSE GROUP BY rating
CREATE INDEX idx_reviews_reviewee_active_rating ON reviews (reviewee_id, rating) WHERE is_hidden = FALSE;

-- 3. Reviewer history lookup: WHERE reviewer_id = :id
CREATE INDEX idx_reviews_reviewer ON reviews (reviewer_id);

-- 4. Admin moderation lookup: WHERE is_hidden = TRUE OR moderated_by = :id
CREATE INDEX idx_reviews_moderated_by ON reviews (moderated_by);

-- ------------------------------------------------------------------------------
-- 2. TRIGGERS
-- ------------------------------------------------------------------------------

-- Generic updated_at trigger (reuses set_updated_at from V1)
CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Moderation consistency trigger:
-- Ensures that:
--   a) When is_hidden = TRUE: moderated_by and moderated_at are NOT NULL
--   b) When is_hidden = FALSE: moderated_by, moderated_at, and moderation_reason are NULL
CREATE OR REPLACE FUNCTION validate_review_moderation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_hidden = TRUE THEN
        IF NEW.moderated_by IS NULL THEN
            RAISE EXCEPTION 'moderated_by must not be null for hidden reviews'
                USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.moderated_at IS NULL THEN
            RAISE EXCEPTION 'moderated_at must not be null for hidden reviews'
                USING ERRCODE = 'check_violation';
        END IF;
    ELSE
        IF NEW.moderated_by IS NOT NULL OR NEW.moderated_at IS NOT NULL OR NEW.moderation_reason IS NOT NULL THEN
            RAISE EXCEPTION 'Moderation metadata must be null for non-hidden reviews'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_review_moderation
BEFORE INSERT OR UPDATE OF is_hidden, moderated_by, moderated_at, moderation_reason ON reviews
FOR EACH ROW EXECUTE FUNCTION validate_review_moderation();

-- Review integrity trigger:
-- Ensures that:
--   a) Referenced transaction exists
--   b) Transaction status is strictly COMPLETED
--   c) Reviewer and reviewee match transaction owner and requester (in either direction)
CREATE OR REPLACE FUNCTION validate_review_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_tx RECORD;
BEGIN
    SELECT id, owner_id, requester_id, status
    INTO v_tx
    FROM transactions
    WHERE id = NEW.transaction_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % does not exist', NEW.transaction_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_tx.status <> 'COMPLETED' THEN
        RAISE EXCEPTION 'Cannot review transaction % because its status is % (expected COMPLETED)',
            NEW.transaction_id, v_tx.status
            USING ERRCODE = 'check_violation';
    END IF;

    IF NOT (
        (NEW.reviewer_id = v_tx.owner_id AND NEW.reviewee_id = v_tx.requester_id) OR
        (NEW.reviewer_id = v_tx.requester_id AND NEW.reviewee_id = v_tx.owner_id)
    ) THEN
        RAISE EXCEPTION 'Reviewer % and reviewee % do not match transaction % parties (owner: %, requester: %)',
            NEW.reviewer_id, NEW.reviewee_id, NEW.transaction_id, v_tx.owner_id, v_tx.requester_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_review_integrity
BEFORE INSERT OR UPDATE OF transaction_id, reviewer_id, reviewee_id ON reviews
FOR EACH ROW EXECUTE FUNCTION validate_review_integrity();

COMMENT ON TABLE reviews IS 'Post-transaction member ratings and reviews for circular exchange accountability';
COMMENT ON COLUMN reviews.rating IS 'Star rating between 1 and 5 inclusive';
COMMENT ON COLUMN reviews.is_hidden IS 'Soft moderation flag; hidden reviews are excluded from user rating averages and public lists';

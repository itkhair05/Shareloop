-- ==============================================================================
-- ShareLoop Database Schema (Flyway Migration V4)
-- ==============================================================================
-- Add transaction cancellation metadata: cancelled_by, cancelled_at, cancellation_reason
-- Enforce database-level invariant rules on cancellation metadata.
-- ==============================================================================

-- 1. Add cancellation metadata columns
ALTER TABLE transactions
    ADD COLUMN cancelled_by UUID REFERENCES users (id) ON DELETE RESTRICT,
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN cancellation_reason VARCHAR(500);

-- 2. Constraints and Indexes
ALTER TABLE transactions
    ADD CONSTRAINT chk_transactions_cancellation_reason_length
    CHECK (cancellation_reason IS NULL OR (length(trim(cancellation_reason)) > 0 AND length(cancellation_reason) <= 500));

CREATE INDEX idx_transactions_cancelled_by ON transactions (cancelled_by);
CREATE INDEX idx_transactions_cancelled_at ON transactions (cancelled_at);

-- 3. Invariant trigger: Validate cancellation metadata consistency
-- Ensures that:
--   a) Non-cancelled transactions have NULL cancellation metadata
--   b) Cancelled transactions have non-null cancelled_at and cancelled_by
--   c) If cancelled by an ADMIN, cancellation_reason is mandatory and non-empty
CREATE OR REPLACE FUNCTION validate_transaction_cancellation()
RETURNS TRIGGER AS $$
DECLARE
    v_user_role VARCHAR(20);
BEGIN
    IF NEW.status = 'CANCELLED' THEN
        IF NEW.cancelled_at IS NULL THEN
            RAISE EXCEPTION 'cancelled_at must not be null when transaction is cancelled'
                USING ERRCODE = 'check_violation';
        END IF;

        IF NEW.cancelled_by IS NULL THEN
            RAISE EXCEPTION 'cancelled_by must not be null when transaction is cancelled'
                USING ERRCODE = 'check_violation';
        END IF;

        -- Verify if cancelled_by is an ADMIN, requiring non-empty cancellation_reason
        SELECT role INTO v_user_role FROM users WHERE id = NEW.cancelled_by;
        IF v_user_role = 'ADMIN' THEN
            IF NEW.cancellation_reason IS NULL OR trim(NEW.cancellation_reason) = '' THEN
                RAISE EXCEPTION 'cancellation_reason is mandatory for administrator cancellation'
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;
    ELSE
        IF NEW.cancelled_at IS NOT NULL OR NEW.cancelled_by IS NOT NULL OR NEW.cancellation_reason IS NOT NULL THEN
            RAISE EXCEPTION 'Cancellation metadata must be null for non-cancelled transactions'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_transaction_cancellation
BEFORE INSERT OR UPDATE OF status, cancelled_by, cancelled_at, cancellation_reason ON transactions
FOR EACH ROW EXECUTE FUNCTION validate_transaction_cancellation();

COMMENT ON COLUMN transactions.cancelled_by IS 'User who cancelled the transaction (participant or admin)';
COMMENT ON COLUMN transactions.cancelled_at IS 'Timestamp when the transaction was cancelled';
COMMENT ON COLUMN transactions.cancellation_reason IS 'Reason for cancellation; optional for participants, mandatory for admins';

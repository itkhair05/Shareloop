-- ==============================================================================
-- ShareLoop Database Fixes & Referential Integrity (Flyway Migration V2)
-- ==============================================================================
-- 1. Update listings country default to 'VN' for Vietnam MVP launch.
-- 2. Enforce strict referential consistency between transactions and listing_requests.
-- 3. Enforce that transactions can only be created for ACCEPTED listing requests.
-- 4. Prevent mutating or reverting accepted requests that have linked transactions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Country Default Update
-- ------------------------------------------------------------------------------
ALTER TABLE listings ALTER COLUMN country SET DEFAULT 'VN';

COMMENT ON COLUMN listings.country IS 'Country code or name for the listing; defaults to VN for initial Vietnam launch';

-- ------------------------------------------------------------------------------
-- 2. Transaction Referential Integrity & Accepted Request Enforcement
-- ------------------------------------------------------------------------------
-- Ensures that every transaction:
--   a) References a listing_request with status = 'ACCEPTED'
--   b) Has listing_id matching the referenced request's listing_id
--   c) Has requester_id matching the referenced request's requester_id
--   d) Has owner_id matching the referenced listing's owner_id
CREATE OR REPLACE FUNCTION validate_transaction_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_request RECORD;
    v_listing_owner_id UUID;
BEGIN
    -- 1. Fetch the referenced listing_request
    SELECT listing_id, requester_id, status
    INTO v_request
    FROM listing_requests
    WHERE id = NEW.listing_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing request % does not exist', NEW.listing_request_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- 2. Verify that the referenced request has status ACCEPTED
    IF v_request.status <> 'ACCEPTED' THEN
        RAISE EXCEPTION 'Cannot create transaction for listing request % because its status is % (expected ACCEPTED)',
            NEW.listing_request_id, v_request.status
            USING ERRCODE = 'check_violation';
    END IF;

    -- 3. Verify that transaction listing_id matches the request's listing_id
    IF NEW.listing_id <> v_request.listing_id THEN
        RAISE EXCEPTION 'Transaction listing_id (%) does not match listing_request listing_id (%)',
            NEW.listing_id, v_request.listing_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- 4. Verify that transaction requester_id matches the request's requester_id
    IF NEW.requester_id <> v_request.requester_id THEN
        RAISE EXCEPTION 'Transaction requester_id (%) does not match listing_request requester_id (%)',
            NEW.requester_id, v_request.requester_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- 5. Fetch the listing owner and verify that transaction owner_id matches
    SELECT owner_id INTO v_listing_owner_id
    FROM listings
    WHERE id = NEW.listing_id;

    IF NEW.owner_id <> v_listing_owner_id THEN
        RAISE EXCEPTION 'Transaction owner_id (%) does not match listing owner_id (%)',
            NEW.owner_id, v_listing_owner_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_transaction_integrity
BEFORE INSERT OR UPDATE OF listing_request_id, listing_id, owner_id, requester_id
ON transactions
FOR EACH ROW
EXECUTE FUNCTION validate_transaction_integrity();

-- ------------------------------------------------------------------------------
-- 3. Guard Accepted Request Mutation
-- ------------------------------------------------------------------------------
-- Prevents reassigning listing or requester on an accepted request, and prevents
-- altering status of an accepted request if an active/completed transaction is linked.
CREATE OR REPLACE FUNCTION prevent_accepted_request_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'ACCEPTED' AND (NEW.listing_id <> OLD.listing_id OR NEW.requester_id <> OLD.requester_id) THEN
        RAISE EXCEPTION 'Cannot change listing or requester on an accepted listing request (request_id: %)', OLD.id
            USING ERRCODE = 'check_violation';
    END IF;

    IF OLD.status = 'ACCEPTED' AND NEW.status <> 'ACCEPTED' THEN
        IF EXISTS (
            SELECT 1 FROM transactions
            WHERE listing_request_id = OLD.id
              AND status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')
        ) THEN
            RAISE EXCEPTION 'Cannot change status of listing request % because an active or completed transaction references it',
                OLD.id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_accepted_request_mutation
BEFORE UPDATE OF listing_id, requester_id, status
ON listing_requests
FOR EACH ROW
EXECUTE FUNCTION prevent_accepted_request_mutation();

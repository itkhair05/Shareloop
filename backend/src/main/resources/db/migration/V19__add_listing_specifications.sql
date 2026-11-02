-- ==============================================================================
-- V19: OPTIONAL LISTING SPECIFICATIONS
-- ==============================================================================
-- Size, condition, and quantity are optional user-provided attributes. Existing
-- listings remain valid with NULL values; no backfill or inferred defaults.
-- ==============================================================================

ALTER TABLE listings
    ADD COLUMN item_size VARCHAR(30);

ALTER TABLE listings
    ADD COLUMN item_condition VARCHAR(20);

ALTER TABLE listings
    ADD COLUMN quantity INTEGER;

ALTER TABLE listings
    ADD CONSTRAINT chk_listings_item_condition
        CHECK (item_condition IS NULL OR item_condition IN ('NEW', 'USED'));

ALTER TABLE listings
    ADD CONSTRAINT chk_listings_quantity_positive
        CHECK (quantity IS NULL OR quantity > 0);

COMMENT ON COLUMN listings.item_size IS 'Optional free-form size label supplied by the owner';
COMMENT ON COLUMN listings.item_condition IS 'Optional item condition: NEW or USED';
COMMENT ON COLUMN listings.quantity IS 'Optional positive quantity; NULL means unspecified, not 1';

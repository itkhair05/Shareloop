-- ==============================================================================
-- ShareLoop Database Schema (Flyway Migration V9)
-- ==============================================================================
-- Update phone number format constraint to Vietnamese domestic mobile standard:
-- Exactly 10 ASCII digits starting with '0' (e.g. 0912345678).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Drop existing legacy check constraint first so data can be migrated
-- ------------------------------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_phone_format;

-- ------------------------------------------------------------------------------
-- 2. Safely migrate existing legacy phone numbers
-- ------------------------------------------------------------------------------
-- Convert unambiguous legacy formats:
-- a) '+84' followed by 9 digits (e.g. '+84912345678' -> '0912345678')
UPDATE users
SET phone_number = '0' || SUBSTRING(phone_number FROM 4)
WHERE phone_number ~ '^\+84[0-9]{9}$';

-- b) '84' followed by 9 digits without '+' (e.g. '84912345678' -> '0912345678')
UPDATE users
SET phone_number = '0' || SUBSTRING(phone_number FROM 3)
WHERE phone_number ~ '^84[0-9]{9}$';

-- c) Exactly 9 digits without leading 0 (e.g. '965033762' -> '0965033762')
UPDATE users
SET phone_number = '0' || phone_number
WHERE phone_number ~ '^[1-9][0-9]{8}$';

-- ------------------------------------------------------------------------------
-- 3. Add new check constraint on users table
-- ------------------------------------------------------------------------------
ALTER TABLE users ADD CONSTRAINT chk_users_phone_format
    CHECK (phone_number IS NULL OR phone_number ~ '^0[0-9]{9}$');

COMMENT ON CONSTRAINT chk_users_phone_format ON users IS 'Enforces Vietnamese domestic phone format: NULL or exactly 10 digits starting with 0';

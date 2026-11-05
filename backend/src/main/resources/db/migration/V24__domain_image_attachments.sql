-- ==============================================================================
-- ShareLoop Database Schema (Flyway Migration V24)
-- ==============================================================================
-- Domain image attachments for Reviews, Moderation Reports, and Support Requests.
--
-- Design:
--   * One row per attached file. file_id is the primary key so a file can have
--     at most one domain attachment record, matching the globally exclusive
--     uploaded_file_bindings registry (one binding per file).
--   * display_order preserves the caller-supplied image order; it is unique per
--     parent and bounded by the product limits (Review 3, Report 5, Support 5).
--   * Parent foreign keys use ON DELETE RESTRICT so evidence rows can never be
--     removed implicitly by deleting a review, report, or support request.
--   * uploaded_files references use ON DELETE RESTRICT. The existing Phase B.2
--     delete guard already prevents deleting a file that still has a binding.
--   * A BEFORE INSERT/UPDATE trigger requires the matching global binding to
--     exist with the same domain and parent ID, and requires the uploaded file
--     purpose to match the domain. This complements, and does not replace, the
--     application transaction that binds files before creating attachment rows.
--
-- V22/V23 are not modified. This migration only adds new tables and triggers.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REVIEW IMAGES (maximum 3)
-- ------------------------------------------------------------------------------
CREATE TABLE review_images (
    file_id UUID PRIMARY KEY REFERENCES uploaded_files (id) ON DELETE RESTRICT,
    review_id UUID NOT NULL REFERENCES reviews (id) ON DELETE RESTRICT,
    display_order SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_review_images_display_order CHECK (display_order >= 0 AND display_order < 3),
    CONSTRAINT uq_review_images_review_order UNIQUE (review_id, display_order)
);

COMMENT ON TABLE review_images IS 'Optional images attached to a review; ordered and globally bound to the review';
COMMENT ON COLUMN review_images.file_id IS 'Uploaded file; also the global binding key (one attachment per file)';
COMMENT ON COLUMN review_images.display_order IS 'Zero-based caller-supplied order, 0..2';

-- ------------------------------------------------------------------------------
-- 2. REPORT ATTACHMENTS (maximum 5)
-- ------------------------------------------------------------------------------
CREATE TABLE report_attachments (
    file_id UUID PRIMARY KEY REFERENCES uploaded_files (id) ON DELETE RESTRICT,
    report_id UUID NOT NULL REFERENCES reports (id) ON DELETE RESTRICT,
    display_order SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_report_attachments_display_order CHECK (display_order >= 0 AND display_order < 5),
    CONSTRAINT uq_report_attachments_report_order UNIQUE (report_id, display_order)
);

COMMENT ON TABLE report_attachments IS 'Private evidence images attached to a moderation report; ordered and globally bound';
COMMENT ON COLUMN report_attachments.display_order IS 'Zero-based caller-supplied order, 0..4';

-- ------------------------------------------------------------------------------
-- 3. SUPPORT REQUEST ATTACHMENTS (maximum 5)
-- ------------------------------------------------------------------------------
CREATE TABLE support_request_attachments (
    file_id UUID PRIMARY KEY REFERENCES uploaded_files (id) ON DELETE RESTRICT,
    support_request_id UUID NOT NULL REFERENCES support_requests (id) ON DELETE RESTRICT,
    display_order SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_support_request_attachments_display_order CHECK (display_order >= 0 AND display_order < 5),
    CONSTRAINT uq_support_request_attachments_order UNIQUE (support_request_id, display_order)
);

COMMENT ON TABLE support_request_attachments IS 'Private images attached to a support request; ordered and globally bound';
COMMENT ON COLUMN support_request_attachments.display_order IS 'Zero-based caller-supplied order, 0..4';

-- ------------------------------------------------------------------------------
-- 4. ATTACHMENT -> GLOBAL BINDING CONSISTENCY
-- ------------------------------------------------------------------------------
-- Enforces at the database level that an attachment row cannot exist without
-- the corresponding globally exclusive binding in uploaded_file_bindings.
-- The application still owns the atomic transaction ordering:
--   bind files -> create attachment rows -> commit.
-- Updates are validated too, so an attachment cannot be moved to another parent
-- or file without a matching binding.
CREATE OR REPLACE FUNCTION validate_domain_attachment_binding()
RETURNS TRIGGER AS $$
DECLARE
    v_domain VARCHAR(16);
    v_parent UUID;
    v_purpose VARCHAR(16);
BEGIN
    IF TG_TABLE_NAME = 'review_images' THEN
        v_domain := 'REVIEW';
        v_parent := NEW.review_id;
    ELSIF TG_TABLE_NAME = 'report_attachments' THEN
        v_domain := 'REPORT';
        v_parent := NEW.report_id;
    ELSIF TG_TABLE_NAME = 'support_request_attachments' THEN
        v_domain := 'SUPPORT';
        v_parent := NEW.support_request_id;
    ELSE
        RAISE EXCEPTION 'validate_domain_attachment_binding cannot handle table %', TG_TABLE_NAME
            USING ERRCODE = 'check_violation';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM uploaded_file_bindings b
         WHERE b.file_id = NEW.file_id
           AND b.bound_domain = v_domain
           AND b.bound_entity_id = v_parent
    ) THEN
        RAISE EXCEPTION 'Uploaded file % is not bound to % %', NEW.file_id, v_domain, v_parent
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT purpose INTO v_purpose
      FROM uploaded_files
     WHERE id = NEW.file_id;

    IF v_purpose IS DISTINCT FROM v_domain THEN
        RAISE EXCEPTION 'Uploaded file % purpose % does not match domain %', NEW.file_id, v_purpose, v_domain
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_images_validate_binding
BEFORE INSERT OR UPDATE ON review_images
FOR EACH ROW
EXECUTE FUNCTION validate_domain_attachment_binding();

CREATE TRIGGER trg_report_attachments_validate_binding
BEFORE INSERT OR UPDATE ON report_attachments
FOR EACH ROW
EXECUTE FUNCTION validate_domain_attachment_binding();

CREATE TRIGGER trg_support_request_attachments_validate_binding
BEFORE INSERT OR UPDATE ON support_request_attachments
FOR EACH ROW
EXECUTE FUNCTION validate_domain_attachment_binding();

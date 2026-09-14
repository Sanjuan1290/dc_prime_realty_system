-- 2026-08-14 — Enforce unique Document Library names.
-- Keeps the original SPA Authorization document and merges/removes the accidental duplicate.
-- Document codes remain unique stable identifiers; document names are now unique human-facing labels.

SET @canonical_document_id := (
  SELECT document_id
  FROM documents
  WHERE document_code = 'DOC-SPA-AUTHORIZATION-TO-SIGN-FOR-REPRESENTATIVE'
  LIMIT 1
);

SET @duplicate_document_id := (
  SELECT document_id
  FROM documents
  WHERE document_code = 'DOC-SPA-AUTHORIZATION-TO-SIGN-FOR-REPRESENTATIVES'
  LIMIT 1
);

-- Templates: remove duplicate relationship rows before re-pointing remaining rows.
DELETE duplicate_row
FROM template_document_list duplicate_row
INNER JOIN template_document_list canonical_row
  ON canonical_row.template_id = duplicate_row.template_id
 AND canonical_row.document_id = @canonical_document_id
WHERE duplicate_row.document_id = @duplicate_document_id;

UPDATE template_document_list
SET document_id = @canonical_document_id
WHERE document_id = @duplicate_document_id
  AND @canonical_document_id IS NOT NULL
  AND @duplicate_document_id IS NOT NULL;

-- Project defaults.
DELETE duplicate_row
FROM lot_project_default_documents duplicate_row
INNER JOIN lot_project_default_documents canonical_row
  ON canonical_row.lot_project_id = duplicate_row.lot_project_id
 AND canonical_row.document_id = @canonical_document_id
WHERE duplicate_row.document_id = @duplicate_document_id;

UPDATE lot_project_default_documents
SET document_id = @canonical_document_id
WHERE document_id = @duplicate_document_id
  AND @canonical_document_id IS NOT NULL
  AND @duplicate_document_id IS NOT NULL;

-- Listing requirements.
DELETE duplicate_row
FROM lot_project_listing_documents duplicate_row
INNER JOIN lot_project_listing_documents canonical_row
  ON canonical_row.lot_project_listing_id = duplicate_row.lot_project_listing_id
 AND canonical_row.document_id = @canonical_document_id
WHERE duplicate_row.document_id = @duplicate_document_id;

UPDATE lot_project_listing_documents
SET document_id = @canonical_document_id
WHERE document_id = @duplicate_document_id
  AND @canonical_document_id IS NOT NULL
  AND @duplicate_document_id IS NOT NULL;

-- Buyer/client documents need extra care because uploaded file rows point at the
-- client-document row instead of directly at documents.
UPDATE lot_project_client_document_files file_row
INNER JOIN lot_project_client_documents duplicate_client_document
  ON duplicate_client_document.lot_project_client_document_id = file_row.lot_project_client_document_id
INNER JOIN lot_project_client_documents canonical_client_document
  ON canonical_client_document.lot_project_client_profile_id = duplicate_client_document.lot_project_client_profile_id
 AND canonical_client_document.document_id = @canonical_document_id
SET file_row.lot_project_client_document_id = canonical_client_document.lot_project_client_document_id
WHERE duplicate_client_document.document_id = @duplicate_document_id;

UPDATE lot_project_client_documents canonical_client_document
INNER JOIN lot_project_client_documents duplicate_client_document
  ON duplicate_client_document.lot_project_client_profile_id = canonical_client_document.lot_project_client_profile_id
 AND duplicate_client_document.document_id = @duplicate_document_id
SET
  canonical_client_document.lot_project_account_id =
    COALESCE(canonical_client_document.lot_project_account_id, duplicate_client_document.lot_project_account_id),
  canonical_client_document.lot_project_client_document_file_name =
    COALESCE(canonical_client_document.lot_project_client_document_file_name, duplicate_client_document.lot_project_client_document_file_name),
  canonical_client_document.lot_project_client_document_file_url =
    COALESCE(canonical_client_document.lot_project_client_document_file_url, duplicate_client_document.lot_project_client_document_file_url),
  canonical_client_document.lot_project_client_document_status =
    CASE
      WHEN canonical_client_document.lot_project_client_document_status = 'Missing'
        THEN duplicate_client_document.lot_project_client_document_status
      ELSE canonical_client_document.lot_project_client_document_status
    END,
  canonical_client_document.lot_project_client_document_uploaded_at =
    COALESCE(canonical_client_document.lot_project_client_document_uploaded_at, duplicate_client_document.lot_project_client_document_uploaded_at),
  canonical_client_document.lot_project_client_document_approved_at =
    COALESCE(canonical_client_document.lot_project_client_document_approved_at, duplicate_client_document.lot_project_client_document_approved_at),
  canonical_client_document.lot_project_client_document_approved_by_user_id =
    COALESCE(canonical_client_document.lot_project_client_document_approved_by_user_id, duplicate_client_document.lot_project_client_document_approved_by_user_id)
WHERE canonical_client_document.document_id = @canonical_document_id;

DELETE duplicate_client_document
FROM lot_project_client_documents duplicate_client_document
INNER JOIN lot_project_client_documents canonical_client_document
  ON canonical_client_document.lot_project_client_profile_id = duplicate_client_document.lot_project_client_profile_id
 AND canonical_client_document.document_id = @canonical_document_id
WHERE duplicate_client_document.document_id = @duplicate_document_id;

UPDATE lot_project_client_documents
SET document_id = @canonical_document_id
WHERE document_id = @duplicate_document_id
  AND @canonical_document_id IS NOT NULL
  AND @duplicate_document_id IS NOT NULL;

DELETE FROM documents
WHERE document_id = @duplicate_document_id
  AND @canonical_document_id IS NOT NULL
  AND @duplicate_document_id IS NOT NULL
  AND @canonical_document_id <> @duplicate_document_id;

-- With the known duplicate removed, the database becomes the final concurrency-safe
-- guard against future duplicate names. The documents table uses a case-insensitive
-- utf8mb4 collation, so case-only duplicates are rejected too.
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_document_name
  ON documents (document_name);

-- Read-only verification.
SELECT document_id, document_name, document_code
FROM documents
ORDER BY document_name, document_id;

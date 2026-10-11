-- 2026-08-09 — Document Library items are always reusable.
-- The application no longer exposes a reusable Yes/No choice.
-- Keep the existing column for backward compatibility, but enforce the invariant in stored data.

UPDATE documents
SET document_is_reusable = 1
WHERE document_is_reusable <> 1;

ALTER TABLE documents
  MODIFY COLUMN document_is_reusable TINYINT(1) NOT NULL DEFAULT 1;


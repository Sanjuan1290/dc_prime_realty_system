-- 2026-08-16 — Document responsibility / action ownership.
-- Separates Required/Optional from who is expected to provide the document.
-- Existing rows default to client to preserve the previous notification behavior
-- until an administrator explicitly classifies each document.

USE `dc_prime_realty_system_db`;

ALTER TABLE documents
  ADD COLUMN document_responsible_party ENUM('client','internal','seller') NOT NULL DEFAULT 'client'
  AFTER document_is_required;

ALTER TABLE template_document_list
  ADD COLUMN template_document_list_responsible_party ENUM('client','internal','seller') NOT NULL DEFAULT 'client'
  AFTER template_document_list_is_required;

ALTER TABLE lot_project_default_documents
  ADD COLUMN lot_project_default_document_responsible_party ENUM('client','internal','seller') NOT NULL DEFAULT 'client'
  AFTER lot_project_default_document_is_required;

ALTER TABLE lot_project_listing_documents
  ADD COLUMN lot_project_listing_document_responsible_party ENUM('client','internal','seller') NOT NULL DEFAULT 'client'
  AFTER lot_project_listing_document_is_required;

-- Seed existing template/project/listing rows from the current Document Library
-- default so newly classified library documents can be propagated deliberately.
UPDATE template_document_list tdl
INNER JOIN documents d ON d.document_id = tdl.document_id
SET tdl.template_document_list_responsible_party = d.document_responsible_party;

UPDATE lot_project_default_documents project_document
INNER JOIN documents d ON d.document_id = project_document.document_id
SET project_document.lot_project_default_document_responsible_party = d.document_responsible_party;

UPDATE lot_project_listing_documents listing_document
INNER JOIN documents d ON d.document_id = listing_document.document_id
SET listing_document.lot_project_listing_document_responsible_party = d.document_responsible_party;

SELECT
  document_responsible_party,
  COUNT(*) AS document_count
FROM documents
GROUP BY document_responsible_party
ORDER BY document_responsible_party;

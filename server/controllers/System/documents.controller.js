import { db } from '../../db/connect.js';
import { validateDocumentCode } from '../../services/storageCodes.service.js';
import { normalizeDocumentResponsibleParty } from '../../utils/documentRequirement.js';
import { writeAuditLog } from './auditLogs.controller.js';

const getErrorMessage = (error) => {
  if (String(error?.code || '').startsWith('ER_') || error?.sqlMessage || error?.sql) return 'Database operation failed. Please try again.';
  return error?.message || 'Something went wrong.';
};

const normalizeDocumentName = (value) => String(value ?? '').trim();

const isDuplicateDocumentNameError = (error) => {
  const text = `${error?.message || ''} ${error?.sqlMessage || ''} ${error?.constraint || ''}`;
  return String(error?.code || '') === 'ER_DUP_ENTRY'
    && /uq_documents_document_name|document_name/i.test(text);
};

const duplicateDocumentNameMessage = (documentName) =>
  `A document named "${documentName}" already exists. Document names must be unique.`;

const tableExists = async (connection, tableName) => {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName]
  );

  return Number(rows[0]?.total || 0) > 0;
};


const countDocumentUsage = async (connection, tableName, documentId) => {
  if (!(await tableExists(connection, tableName))) return 0;
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total FROM ${tableName} WHERE document_id = ?`,
    [documentId]
  );
  return Number(rows[0]?.total || 0);
};

const countDocumentFileUsage = async (connection, documentId) => {
  if (!(await tableExists(connection, 'lot_project_client_document_files'))
      || !(await tableExists(connection, 'lot_project_client_documents'))) return 0;
  const [rows] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM lot_project_client_document_files file_row
    INNER JOIN lot_project_client_documents client_document
      ON client_document.lot_project_client_document_id = file_row.lot_project_client_document_id
    WHERE client_document.document_id = ?
  `, [documentId]);
  return Number(rows[0]?.total || 0);
};

const getDocumentUsageSummary = async (connection, documentId) => {
  const [templateLinks, projectDefaults, listingRequirements, clientDocuments, clientDocumentFiles] = await Promise.all([
    countDocumentUsage(connection, 'template_document_list', documentId),
    countDocumentUsage(connection, 'lot_project_default_documents', documentId),
    countDocumentUsage(connection, 'lot_project_listing_documents', documentId),
    countDocumentUsage(connection, 'lot_project_client_documents', documentId),
    countDocumentFileUsage(connection, documentId),
  ]);
  const total = templateLinks + projectDefaults + listingRequirements + clientDocuments + clientDocumentFiles;
  return {
    inUse: total > 0,
    total,
    template_document_list: templateLinks,
    lot_project_default_documents: projectDefaults,
    lot_project_listing_documents: listingRequirements,
    lot_project_client_documents: clientDocuments,
    lot_project_client_document_files: clientDocumentFiles,
  };
};

const safeDeleteByColumn = async (connection, tableName, columnName, value) => {
  const allowedTables = new Set([
    'template_document_list',
    'lot_project_default_documents',
    'lot_project_listing_documents',
    'lot_project_client_documents',
    'project_bailen_default_documents',
  ]);

  const allowedColumns = new Set([
    'document_id',
    'template_id',
  ]);

  if (!allowedTables.has(tableName) || !allowedColumns.has(columnName)) {
    throw new Error('Unsafe delete operation blocked.');
  }

  const exists = await tableExists(connection, tableName);

  if (!exists) return;

  await connection.query(
    `DELETE FROM ${tableName} WHERE ${columnName} = ?`,
    [value]
  );
};


const normalizeRequiredValue = (value, fallback = true) => {
  if (value === false || value === 0 || value === '0') return 0;
  if (value === true || value === 1 || value === '1') return 1;

  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'optional' || normalized === 'false') return 0;
  if (normalized === 'required' || normalized === 'true') return 1;

  return fallback ? 1 : 0;
};

const getTemplateDocumentRows = async (connection, documentIds = [], templateDocuments = []) => {
  const explicitRows = Array.isArray(templateDocuments)
    ? templateDocuments
        .map((document) => ({
          document_id: Number(document.document_id || document.id),
          is_required: normalizeRequiredValue(
            document.is_required ??
              document.requirement ??
              document.template_document_list_is_required ??
              document.document_is_required,
            true
          ),
          responsible_party: (
            document.responsibleParty ??
            document.responsible_party ??
            document.template_document_list_responsible_party ??
            document.document_responsible_party
          ) == null
            ? null
            : normalizeDocumentResponsibleParty(
                document.responsibleParty ??
                  document.responsible_party ??
                  document.template_document_list_responsible_party ??
                  document.document_responsible_party,
                'client'
              ),
        }))
        .filter((document) => document.document_id)
    : [];

  const requestedIds = [
    ...new Set([
      ...documentIds.map(Number).filter(Boolean),
      ...explicitRows.map((document) => document.document_id),
    ]),
  ];

  if (requestedIds.length === 0) return [];

  const [libraryRows] = await connection.query(
    `
      SELECT document_id, document_is_required, document_responsible_party
      FROM documents
      WHERE document_id IN (${requestedIds.map(() => '?').join(', ')})
    `,
    requestedIds
  );

  const libraryRequirement = new Map(
    libraryRows.map((document) => [
      Number(document.document_id),
      normalizeRequiredValue(document.document_is_required, true),
    ])
  );
  const libraryResponsibleParty = new Map(
    libraryRows.map((document) => [
      Number(document.document_id),
      normalizeDocumentResponsibleParty(document.document_responsible_party, 'client'),
    ])
  );
  const explicitRequirement = new Map(
    explicitRows.map((document) => [document.document_id, document.is_required])
  );
  const explicitResponsibleParty = new Map(
    explicitRows.filter((document) => document.responsible_party).map((document) => [document.document_id, document.responsible_party])
  );

  return requestedIds
    .filter((documentId) => libraryRequirement.has(documentId))
    .map((documentId) => ({
      document_id: documentId,
      is_required: explicitRequirement.has(documentId)
        ? explicitRequirement.get(documentId)
        : libraryRequirement.get(documentId),
      responsible_party: explicitResponsibleParty.has(documentId)
        ? explicitResponsibleParty.get(documentId)
        : libraryResponsibleParty.get(documentId),
    }));
};

export const getDocuments = async (req, res) => {
  try {
    const [documents] = await db.query(`
      SELECT
        document_id,
        document_name,
        document_code,
        document_description,
        document_is_reusable,
        document_status,
        document_is_required,
        document_responsible_party,
        document_created_at,
        document_updated_at
      FROM documents
      ORDER BY document_created_at DESC, document_id DESC
    `);

    return res.json({ documents });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getTemplates = async (req, res) => {
  try {
    const [templates] = await db.query(`
      SELECT
        template_id,
        template_name,
        template_description,
        template_status,
        template_created_at,
        template_updated_at
      FROM document_templates
      ORDER BY template_created_at DESC, template_id DESC
    `);

    const [templateDocuments] = await db.query(`
      SELECT
        tdl.template_document_list_id,
        tdl.template_id,
        tdl.document_id,
        d.document_name,
        d.document_code,
        d.document_description,
        d.document_is_reusable,
        tdl.template_document_list_is_required,
        tdl.template_document_list_is_required AS document_is_required,
        d.document_is_required AS library_document_is_required,
        tdl.template_document_list_responsible_party,
        tdl.template_document_list_responsible_party AS document_responsible_party,
        d.document_responsible_party AS library_document_responsible_party,
        d.document_status,
        tdl.template_document_list_created_at AS template_document_created_at,
        tdl.template_document_list_updated_at AS template_document_updated_at
      FROM template_document_list tdl
      INNER JOIN documents d ON d.document_id = tdl.document_id
      ORDER BY tdl.template_id ASC, d.document_name ASC
    `);

    return res.json({
      success: true,
      templates,
      template_documents: templateDocuments,
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const addDocument = async (req, res) => {
  try {
    const {
      document_name,
      document_code,
      document_description,
      document_status = 'active',
      document_is_required = true,
      document_responsible_party = 'client',
    } = req.body;

    const normalizedDocumentName = normalizeDocumentName(document_name);
    if (!normalizedDocumentName) {
      return res.status(400).json({ message: 'Document name is required.' });
    }

    const [existingNameRows] = await db.query(
      `SELECT document_id FROM documents WHERE TRIM(document_name) = ? LIMIT 1`,
      [normalizedDocumentName]
    );
    if (existingNameRows.length) {
      return res.status(409).json({ message: duplicateDocumentNameMessage(normalizedDocumentName) });
    }

    const documentCodeValidation = validateDocumentCode(document_code);
    if (!documentCodeValidation.valid) {
      return res.status(400).json({ message: documentCodeValidation.message });
    }
    const normalizedDocumentCode = documentCodeValidation.code;
    const [existingCodeRows] = await db.query(
      `SELECT document_id FROM documents WHERE document_code = ? LIMIT 1`,
      [normalizedDocumentCode]
    );
    if (existingCodeRows.length) {
      return res.status(409).json({ message: `Document code ${normalizedDocumentCode} is already in use.` });
    }

    const [result] = await db.query(
      `
        INSERT INTO documents (
          document_name,
          document_code,
          document_description,
          document_is_reusable,
          document_status,
          document_is_required,
          document_responsible_party
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        normalizedDocumentName,
        normalizedDocumentCode,
        document_description?.trim() || null,
        1,
        document_status,
        Boolean(document_is_required) ? 1 : 0,
        normalizeDocumentResponsibleParty(document_responsible_party, 'client'),
      ]
    );

    await writeAuditLog(db, req, {
      action: 'create',
      module: 'Documents',
      entityType: 'document',
      entityId: String(result.insertId),
      entityLabel: normalizedDocumentName,
      title: 'Added document library item',
      description: `Added ${normalizedDocumentName} to the document library.`,
      metadata: {
        before: null,
        after: {
          documentId: Number(result.insertId),
          name: normalizedDocumentName,
          code: normalizedDocumentCode,
          description: document_description?.trim() || null,
          status: document_status,
          isRequired: Boolean(document_is_required),
          responsibleParty: normalizeDocumentResponsibleParty(document_responsible_party, 'client'),
          isReusable: true,
        },
      },
    });

    return res.status(201).json({
      message: 'Document added successfully.',
      document_id: result.insertId,
      document_code: normalizedDocumentCode,
    });
  } catch (error) {
    if (isDuplicateDocumentNameError(error)) {
      return res.status(409).json({ message: duplicateDocumentNameMessage(normalizeDocumentName(req.body?.document_name)) });
    }
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const addTemplate = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      template_name,
      template_description,
      template_status = 'active',
      document_ids = [],
      template_documents = [],
    } = req.body;

    if (!template_name?.trim()) {
      return res.status(400).json({ message: 'Template name is required.' });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO document_templates (
          template_name,
          template_description,
          template_status
        ) VALUES (?, ?, ?)
      `,
      [template_name.trim(), template_description?.trim() || null, template_status]
    );

    const templateId = result.insertId;
    const templateDocumentRows = await getTemplateDocumentRows(
      connection,
      document_ids,
      template_documents
    );

    if (templateDocumentRows.length > 0) {
      await connection.query(
        `
          INSERT INTO template_document_list (
            template_id,
            document_id,
            template_document_list_is_required,
            template_document_list_responsible_party
          )
          VALUES ${templateDocumentRows.map(() => '(?, ?, ?, ?)').join(', ')}
        `,
        templateDocumentRows.flatMap((document) => [
          templateId,
          document.document_id,
          document.is_required,
          document.responsible_party,
        ])
      );
    }

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Documents',
      entityType: 'document_template',
      entityId: String(templateId),
      entityLabel: template_name.trim(),
      title: 'Created document template',
      description: `Created document template ${template_name.trim()}.`,
      metadata: {
        before: null,
        after: {
          templateId,
          name: template_name.trim(),
          description: template_description?.trim() || null,
          status: template_status,
          documents: templateDocumentRows,
        },
      },
    });

    await connection.commit();

    return res.status(201).json({
      message: 'Template created successfully.',
      template_id: templateId,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getDocumentUsage = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const documentId = Number(req.params.id);
    if (!documentId) return res.status(400).json({ message: 'Invalid document id.' });
    const [rows] = await connection.query(
      'SELECT document_id, document_name, document_status FROM documents WHERE document_id = ? LIMIT 1',
      [documentId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Document not found.' });
    const usage = await getDocumentUsageSummary(connection, documentId);
    return res.json({ success: true, document: rows[0], usage, data: usage });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateDocumentStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const documentId = Number(req.params.id);
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!documentId) return res.status(400).json({ message: 'Invalid document id.' });
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Document status must be Active or Inactive.' });
    }
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM documents WHERE document_id = ? LIMIT 1 FOR UPDATE', [documentId]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Document not found.' });
    }
    await connection.query('UPDATE documents SET document_status = ? WHERE document_id = ?', [status, documentId]);
    const usage = await getDocumentUsageSummary(connection, documentId);
    await writeAuditLog(connection, req, {
      action: 'update', module: 'Documents', entityType: 'document', entityId: String(documentId),
      entityLabel: rows[0].document_name || `Document ${documentId}`,
      title: status === 'active' ? 'Reactivated document library item' : 'Deactivated document library item',
      description: `${status === 'active' ? 'Reactivated' : 'Deactivated'} ${rows[0].document_name || `document ${documentId}`}. Existing project, listing, buyer, and file usage was preserved.`,
      metadata: { before: rows[0], after: { ...rows[0], document_status: status }, usage, preservedExistingUsage: true },
    });
    await connection.commit();
    return res.json({
      success: true,
      status,
      usage,
      preservedExistingUsage: true,
      message: status === 'active' ? 'Document reactivated successfully.' : 'Document deactivated successfully. Existing usage was preserved.',
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const deleteDocument = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const documentId = Number(req.params.id);
    if (!documentId) return res.status(400).json({ message: 'Invalid document id.' });

    await connection.beginTransaction();
    const [documentRows] = await connection.query(
      'SELECT * FROM documents WHERE document_id = ? LIMIT 1 FOR UPDATE',
      [documentId]
    );
    if (!documentRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Document not found.' });
    }

    const usage = await getDocumentUsageSummary(connection, documentId);
    if (usage.inUse) {
      await connection.rollback();
      return res.status(409).json({
        code: 'DOCUMENT_IN_USE',
        message: 'This document is already in use. Deactivate it instead so existing project, listing, buyer, and historical file usage stays intact.',
        usage,
      });
    }

    await connection.query('DELETE FROM documents WHERE document_id = ?', [documentId]);
    await writeAuditLog(connection, req, {
      action: 'delete', module: 'Documents', entityType: 'document', entityId: String(documentId),
      entityLabel: documentRows[0]?.document_name || `Document ${documentId}`,
      title: 'Permanently deleted unused document',
      description: `Permanently deleted unused document ${documentRows[0]?.document_name || documentId}.`,
      metadata: { before: documentRows[0], after: null, usage },
    });
    await connection.commit();
    return res.json({ success: true, message: 'Unused document permanently deleted successfully.' });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const deleteTemplate = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const templateId = Number(req.params.id);

    if (!templateId) {
      return res.status(400).json({ message: 'Invalid template id.' });
    }

    await connection.beginTransaction();

    const [templateRows] = await connection.query(
      `
        SELECT *
        FROM document_templates
        WHERE template_id = ?
        LIMIT 1
      `,
      [templateId]
    );

    if (templateRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Template not found.' });
    }

    await safeDeleteByColumn(connection, 'template_document_list', 'template_id', templateId);

    await connection.query(
      `
        DELETE FROM document_templates
        WHERE template_id = ?
      `,
      [templateId]
    );

    await writeAuditLog(connection, req, {
      action: 'delete',
      module: 'Documents',
      entityType: 'document_template',
      entityId: String(templateId),
      entityLabel: templateRows[0]?.template_name || `Template ${templateId}`,
      title: 'Deleted document template',
      description: `Permanently deleted document template ${templateRows[0]?.template_name || templateId}.`,
      metadata: { before: templateRows[0], after: null },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: 'Template permanently deleted successfully.',
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const editDocument = async (req, res) => {
  try {
    const documentId = Number(req.params.id);
    if (!documentId) return res.status(400).json({ message: 'Invalid document id.' });

    const {
      document_name,
      document_description,
      document_status = 'active',
      document_is_required = true,
      document_responsible_party = 'client',
    } = req.body;

    const normalizedDocumentName = normalizeDocumentName(document_name);
    if (!normalizedDocumentName) {
      return res.status(400).json({ message: 'Document name is required.' });
    }

    const [beforeRows] = await db.query(`SELECT * FROM documents WHERE document_id = ? LIMIT 1`, [documentId]);
    if (!beforeRows.length) return res.status(404).json({ message: 'Document not found.' });

    const [existingNameRows] = await db.query(
      `SELECT document_id FROM documents WHERE TRIM(document_name) = ? AND document_id <> ? LIMIT 1`,
      [normalizedDocumentName, documentId]
    );
    if (existingNameRows.length) {
      return res.status(409).json({ message: duplicateDocumentNameMessage(normalizedDocumentName) });
    }

    await db.query(
      `
        UPDATE documents
        SET
          document_name = ?,
          document_description = ?,
          document_is_reusable = ?,
          document_status = ?,
          document_is_required = ?,
          document_responsible_party = ?
        WHERE document_id = ?
      `,
      [
        normalizedDocumentName,
        document_description?.trim() || null,
        1,
        document_status,
        Boolean(document_is_required) ? 1 : 0,
        normalizeDocumentResponsibleParty(document_responsible_party, 'client'),
        documentId,
      ]
    );

    await writeAuditLog(db, req, {
      action: 'update',
      module: 'Documents',
      entityType: 'document',
      entityId: String(documentId),
      entityLabel: normalizedDocumentName,
      title: 'Updated document library item',
      description: `Updated ${normalizedDocumentName} in the document library.`,
      metadata: {
        before: beforeRows[0],
        after: {
          documentId,
          name: normalizedDocumentName,
          description: document_description?.trim() || null,
          status: document_status,
          isRequired: Boolean(document_is_required),
          responsibleParty: normalizeDocumentResponsibleParty(document_responsible_party, 'client'),
          isReusable: true,
        },
      },
    });

    return res.json({ message: 'Document updated successfully.' });
  } catch (error) {
    if (isDuplicateDocumentNameError(error)) {
      return res.status(409).json({ message: duplicateDocumentNameMessage(normalizeDocumentName(req.body?.document_name)) });
    }
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const editTemplate = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const templateId = Number(req.params.id);
    if (!templateId) return res.status(400).json({ message: 'Invalid template id.' });

    const {
      template_name,
      template_description,
      template_status = 'active',
      document_ids = [],
      template_documents = [],
    } = req.body;

    if (!template_name?.trim()) {
      return res.status(400).json({ message: 'Template name is required.' });
    }

    await connection.beginTransaction();

    const [beforeTemplateRows] = await connection.query(`SELECT * FROM document_templates WHERE template_id = ? LIMIT 1 FOR UPDATE`, [templateId]);
    if (!beforeTemplateRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Template not found.' });
    }
    const [beforeTemplateDocuments] = await connection.query(`SELECT * FROM template_document_list WHERE template_id = ? ORDER BY template_document_list_id`, [templateId]);

    await connection.query(
      `
        UPDATE document_templates
        SET template_name = ?, template_description = ?, template_status = ?
        WHERE template_id = ?
      `,
      [template_name.trim(), template_description?.trim() || null, template_status, templateId]
    );

    await connection.query(`DELETE FROM template_document_list WHERE template_id = ?`, [templateId]);

    const templateDocumentRows = await getTemplateDocumentRows(
      connection,
      document_ids,
      template_documents
    );

    if (templateDocumentRows.length > 0) {
      await connection.query(
        `
          INSERT INTO template_document_list (
            template_id,
            document_id,
            template_document_list_is_required,
            template_document_list_responsible_party
          )
          VALUES ${templateDocumentRows.map(() => '(?, ?, ?, ?)').join(', ')}
        `,
        templateDocumentRows.flatMap((document) => [
          templateId,
          document.document_id,
          document.is_required,
          document.responsible_party,
        ])
      );
    }

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Documents',
      entityType: 'document_template',
      entityId: String(templateId),
      entityLabel: template_name.trim(),
      title: 'Updated document template',
      description: `Updated document template ${template_name.trim()}.`,
      metadata: {
        before: { ...beforeTemplateRows[0], documents: beforeTemplateDocuments },
        after: {
          templateId,
          name: template_name.trim(),
          description: template_description?.trim() || null,
          status: template_status,
          documents: templateDocumentRows,
        },
      },
    });

    await connection.commit();

    return res.json({ message: 'Template updated successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


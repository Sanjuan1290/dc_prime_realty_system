import { db } from '../../db/connect.js';

const getErrorMessage = (error) => {
  if (String(error?.code || '').startsWith('ER_') || error?.sqlMessage || error?.sql) return 'Database operation failed. Please try again.';
  return error?.message || 'Something went wrong.';
};

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

export const getDocuments = async (req, res) => {
  try {
    const [documents] = await db.query(`
      SELECT
        document_id,
        document_name,
        document_description,
        document_is_reusable,
        document_status,
        document_is_required,
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
        d.document_description,
        d.document_is_reusable,
        d.document_is_required,
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
      document_description,
      document_is_reusable = true,
      document_status = 'active',
      document_is_required = true,
    } = req.body;

    if (!document_name?.trim()) {
      return res.status(400).json({ message: 'Document name is required.' });
    }

    const [result] = await db.query(
      `
        INSERT INTO documents (
          document_name,
          document_description,
          document_is_reusable,
          document_status,
          document_is_required
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        document_name.trim(),
        document_description?.trim() || null,
        Boolean(document_is_reusable) ? 1 : 0,
        document_status,
        Boolean(document_is_required) ? 1 : 0,
      ]
    );

    return res.status(201).json({
      message: 'Document added successfully.',
      document_id: result.insertId,
    });
  } catch (error) {
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
    const uniqueDocumentIds = [...new Set(document_ids.map(Number).filter(Boolean))];

    if (uniqueDocumentIds.length > 0) {
      await connection.query(
        `
          INSERT INTO template_document_list (template_id, document_id)
          VALUES ${uniqueDocumentIds.map(() => '(?, ?)').join(', ')}
        `,
        uniqueDocumentIds.flatMap((documentId) => [templateId, documentId])
      );
    }

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

export const deleteDocument = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const documentId = Number(req.params.id);

    if (!documentId) {
      return res.status(400).json({ message: 'Invalid document id.' });
    }

    await connection.beginTransaction();

    const [documentRows] = await connection.query(
      `
        SELECT document_id
        FROM documents
        WHERE document_id = ?
        LIMIT 1
      `,
      [documentId]
    );

    if (documentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Document not found.' });
    }

    await safeDeleteByColumn(connection, 'template_document_list', 'document_id', documentId);
    await safeDeleteByColumn(connection, 'lot_project_default_documents', 'document_id', documentId);
    await safeDeleteByColumn(connection, 'lot_project_listing_documents', 'document_id', documentId);
    await safeDeleteByColumn(connection, 'lot_project_client_documents', 'document_id', documentId);
    await safeDeleteByColumn(connection, 'project_bailen_default_documents', 'document_id', documentId);

    await connection.query(
      `
        DELETE FROM documents
        WHERE document_id = ?
      `,
      [documentId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: 'Document permanently deleted successfully.',
    });
  } catch (error) {
    await connection.rollback();
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
        SELECT template_id
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
      document_is_reusable = true,
      document_status = 'active',
      document_is_required = true,
    } = req.body;

    if (!document_name?.trim()) {
      return res.status(400).json({ message: 'Document name is required.' });
    }

    await db.query(
      `
        UPDATE documents
        SET
          document_name = ?,
          document_description = ?,
          document_is_reusable = ?,
          document_status = ?,
          document_is_required = ?
        WHERE document_id = ?
      `,
      [
        document_name.trim(),
        document_description?.trim() || null,
        Boolean(document_is_reusable) ? 1 : 0,
        document_status,
        Boolean(document_is_required) ? 1 : 0,
        documentId,
      ]
    );

    return res.json({ message: 'Document updated successfully.' });
  } catch (error) {
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
    } = req.body;

    if (!template_name?.trim()) {
      return res.status(400).json({ message: 'Template name is required.' });
    }

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE document_templates
        SET template_name = ?, template_description = ?, template_status = ?
        WHERE template_id = ?
      `,
      [template_name.trim(), template_description?.trim() || null, template_status, templateId]
    );

    await connection.query(`DELETE FROM template_document_list WHERE template_id = ?`, [templateId]);

    const uniqueDocumentIds = [...new Set(document_ids.map(Number).filter(Boolean))];

    if (uniqueDocumentIds.length > 0) {
      await connection.query(
        `
          INSERT INTO template_document_list (template_id, document_id)
          VALUES ${uniqueDocumentIds.map(() => '(?, ?)').join(', ')}
        `,
        uniqueDocumentIds.flatMap((documentId) => [templateId, documentId])
      );
    }

    await connection.commit();

    return res.json({ message: 'Template updated successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


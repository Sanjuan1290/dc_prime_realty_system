import { db } from '../../db/connect.js';

const getErrorMessage = (error) => error?.message || 'Something went wrong.';

const allowedDocumentStatuses = ['active', 'inactive'];
const allowedTemplateStatuses = ['active', 'inactive'];

const toBooleanNumber = (value) => {
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'yes' || value === 'required') {
    return 1;
  }

  return 0;
};

const normalizeStatus = (value, allowedStatuses, fallback = 'active') => {
  if (allowedStatuses.includes(value)) return value;
  return fallback;
};

const getUniqueDocumentIds = (documentIds = []) => {
  if (!Array.isArray(documentIds)) return [];

  return [...new Set(documentIds.map(Number).filter(Boolean))];
};

const getTemplateDocumentsPayload = (body) => {
  if (Array.isArray(body.documents)) {
    return body.documents
      .map((item) => ({
        document_id: Number(item.document_id || item.id),
        is_required: toBooleanNumber(item.is_required ?? item.document_is_required ?? true),
      }))
      .filter((item) => item.document_id);
  }

  return getUniqueDocumentIds(body.document_ids).map((documentId) => ({
    document_id: documentId,
    is_required: 1,
  }));
};

export const getDocuments = async (req, res) => {
  try {
    const [documents] = await db.query(`
      SELECT
        document_id,
        document_name,
        document_description,
        document_is_reusable,
        document_is_required,
        document_status,
        document_created_at,
        document_updated_at
      FROM documents
      ORDER BY document_created_at DESC, document_id DESC
    `);

    return res.json({
      success: true,
      documents,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
    });
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
        tdl.template_document_list_is_required AS document_is_required,
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
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const addDocument = async (req, res) => {
  try {
    const {
      document_name,
      document_description,
      document_is_reusable = true,
      document_is_required = true,
      document_status = 'active',
    } = req.body;

    const cleanName = String(document_name || '').trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Document name is required.',
      });
    }

    const cleanStatus = normalizeStatus(
      document_status,
      allowedDocumentStatuses,
      'active'
    );

    const [existing] = await db.query(
      `
        SELECT document_id
        FROM documents
        WHERE LOWER(document_name) = LOWER(?)
        LIMIT 1
      `,
      [cleanName]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Document name already exists.',
      });
    }

    const [result] = await db.query(
      `
        INSERT INTO documents (
          document_name,
          document_description,
          document_is_reusable,
          document_is_required,
          document_status
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        cleanName,
        String(document_description || '').trim() || null,
        toBooleanNumber(document_is_reusable),
        toBooleanNumber(document_is_required),
        cleanStatus,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Document added successfully.',
      document_id: result.insertId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const editDocument = async (req, res) => {
  try {
    const documentId = Number(req.params.id);

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document id.',
      });
    }

    const {
      document_name,
      document_description,
      document_is_reusable = true,
      document_is_required = true,
      document_status = 'active',
    } = req.body;

    const cleanName = String(document_name || '').trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Document name is required.',
      });
    }

    const [existing] = await db.query(
      `
        SELECT document_id
        FROM documents
        WHERE LOWER(document_name) = LOWER(?)
          AND document_id <> ?
        LIMIT 1
      `,
      [cleanName, documentId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Another document already uses this name.',
      });
    }

    const [result] = await db.query(
      `
        UPDATE documents
        SET
          document_name = ?,
          document_description = ?,
          document_is_reusable = ?,
          document_is_required = ?,
          document_status = ?
        WHERE document_id = ?
      `,
      [
        cleanName,
        String(document_description || '').trim() || null,
        toBooleanNumber(document_is_reusable),
        toBooleanNumber(document_is_required),
        normalizeStatus(document_status, allowedDocumentStatuses, 'active'),
        documentId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Document updated successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const documentId = Number(req.params.id);

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document id.',
      });
    }

    const [result] = await db.query(
      `
        UPDATE documents
        SET document_status = 'inactive'
        WHERE document_id = ?
      `,
      [documentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Document moved to inactive successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const addTemplate = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      template_name,
      template_description,
      template_status = 'active',
    } = req.body;

    const cleanName = String(template_name || '').trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Template name is required.',
      });
    }

    const selectedDocuments = getTemplateDocumentsPayload(req.body);

    await connection.beginTransaction();

    const [existing] = await connection.query(
      `
        SELECT template_id
        FROM document_templates
        WHERE LOWER(template_name) = LOWER(?)
        LIMIT 1
      `,
      [cleanName]
    );

    if (existing.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: 'Template name already exists.',
      });
    }

    const [templateResult] = await connection.query(
      `
        INSERT INTO document_templates (
          template_name,
          template_description,
          template_status
        ) VALUES (?, ?, ?)
      `,
      [
        cleanName,
        String(template_description || '').trim() || null,
        normalizeStatus(template_status, allowedTemplateStatuses, 'active'),
      ]
    );

    const templateId = templateResult.insertId;

    if (selectedDocuments.length > 0) {
      await connection.query(
        `
          INSERT INTO template_document_list (
            template_id,
            document_id,
            template_document_list_is_required
          )
          VALUES ${selectedDocuments.map(() => '(?, ?, ?)').join(', ')}
        `,
        selectedDocuments.flatMap((item) => [
          templateId,
          item.document_id,
          item.is_required,
        ])
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Template created successfully.',
      template_id: templateId,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
    });
  } finally {
    connection.release();
  }
};

export const editTemplate = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const templateId = Number(req.params.id);

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template id.',
      });
    }

    const {
      template_name,
      template_description,
      template_status = 'active',
    } = req.body;

    const cleanName = String(template_name || '').trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: 'Template name is required.',
      });
    }

    const selectedDocuments = getTemplateDocumentsPayload(req.body);

    await connection.beginTransaction();

    const [existing] = await connection.query(
      `
        SELECT template_id
        FROM document_templates
        WHERE LOWER(template_name) = LOWER(?)
          AND template_id <> ?
        LIMIT 1
      `,
      [cleanName, templateId]
    );

    if (existing.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: 'Another template already uses this name.',
      });
    }

    const [templateResult] = await connection.query(
      `
        UPDATE document_templates
        SET
          template_name = ?,
          template_description = ?,
          template_status = ?
        WHERE template_id = ?
      `,
      [
        cleanName,
        String(template_description || '').trim() || null,
        normalizeStatus(template_status, allowedTemplateStatuses, 'active'),
        templateId,
      ]
    );

    if (templateResult.affectedRows === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Template not found.',
      });
    }

    await connection.query(
      `
        DELETE FROM template_document_list
        WHERE template_id = ?
      `,
      [templateId]
    );

    if (selectedDocuments.length > 0) {
      await connection.query(
        `
          INSERT INTO template_document_list (
            template_id,
            document_id,
            template_document_list_is_required
          )
          VALUES ${selectedDocuments.map(() => '(?, ?, ?)').join(', ')}
        `,
        selectedDocuments.flatMap((item) => [
          templateId,
          item.document_id,
          item.is_required,
        ])
      );
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'Template updated successfully.',
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
    });
  } finally {
    connection.release();
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const templateId = Number(req.params.id);

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template id.',
      });
    }

    const [result] = await db.query(
      `
        UPDATE document_templates
        SET template_status = 'inactive'
        WHERE template_id = ?
      `,
      [templateId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found.',
      });
    }

    return res.json({
      success: true,
      message: 'Template moved to inactive successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
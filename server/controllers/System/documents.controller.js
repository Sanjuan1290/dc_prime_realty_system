import { db } from "../../db/connect.js";

export const getDocuments = async (req, res) => {
  try {
    const [rows] = await db.query(`
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
      ORDER BY document_created_at DESC
    `)

    return res.status(200).json({
      message: rows.length ? 'Documents fetched.' : 'No document.',
      documents: rows,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal Error' })
  }
}

export const getTemplates = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        template_id,
        template_name,
        template_description,
        template_status,
        template_created_at,
        template_updated_at
      FROM document_templates
      ORDER BY template_created_at DESC
    `)

    return res.status(200).json({
      message: rows.length ? 'Templates fetched.' : 'No template.',
      templates: rows,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal Error' })
  }
}

export const addDocument = async(req, res) => {
    
}

export const addTemplate = async(req, res) => {
    
}

export const deleteDocument = async(req, res) => {
    
}
export const deleteTemplate = async(req, res) => {
    
}

export const editDocument = async(req, res) => {
    
}
export const editTemplate = async(req, res) => {
    
}
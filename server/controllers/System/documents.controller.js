import { db } from '../../db/connect.js'


export const getDocuments = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                document_id,
                document_name,
                document_description,
                document_is_reusable,
                document_status,
                document_created_at,
                document_updated_at
            FROM documents
            ORDER BY document_created_at DESC
        `);

        if (!rows || rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No documents found",
                documents: [],
            });
        }

        return res.status(200).json({
            success: true,
            documents: rows,
        });
    } catch (error) {
        console.error("Get documents error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch documents",
        });
    }
};

export const getTemplates = async (req, res) => {
    try {
        const [template_rows] = await db.query(`
            SELECT
                t.template_id,
                t.template_name,
                t.template_description,
                t.template_status,
                t.template_created_at,
                t.template_updated_at
            FROM templates t
        `);

        const [template_document_rows] = await db.query(`
            SELECT 
                dtl.document_template_list_id,
                t.template_id,
                d.document_id,
                d.document_is_required
            FROM templates t
            RIGHT JOIN document_template_list dtl
            ON dtl.template_id = t.template_id
            RIGHT JOIN documents d
            ON dtl.document_id = d.document_id
        `)  

        if (!template_rows || template_rows.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No TEMPLATE found",
                templates: [],
                template_document_rows: []
            });
        }

        return res.status(200).json({
            success: true,
            templates: template_rows,
            template_documents: template_document_rows
        });
        
    } catch (error) {
        console.error("Get templates error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch templates",
        });
    }
};

export const addDocument = async (req, res) => {

}
export const addTemplate = async (req, res) => {

}

export const editDocument = async (req, res) => {

}
export const editTemplate = async (req, res) => {

}

export const deleteDocument = async (req, res) => {

}
export const deleteTemplate = async (req, res) => {

}
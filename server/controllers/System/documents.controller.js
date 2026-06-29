import { db } from "../../db/connect.js";

const isValidStatus = (status) => ["active", "inactive"].includes(status);

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
        `);

        return res.status(200).json({
            success: true,
            documents: rows || [],
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
            ORDER BY t.template_created_at DESC
        `);

        const [template_document_rows] = await db.query(`
            SELECT 
                dtl.document_template_list_id,
                dtl.template_id,
                dtl.document_id,

                d.document_name,
                d.document_description,
                d.document_is_reusable,
                d.document_status,
                d.document_is_required,
                d.document_created_at,
                d.document_updated_at
            FROM document_template_list dtl
            LEFT JOIN documents d
                ON dtl.document_id = d.document_id
            ORDER BY dtl.document_template_list_id DESC
        `);

        return res.status(200).json({
            success: true,
            templates: template_rows || [],
            template_documents: template_document_rows || [],
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
    try {
        const {
            document_name,
            document_description,
            document_is_reusable = true,
            document_status = "active",
            document_is_required = true,
        } = req.body;

        if (!document_name || !document_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Document name is required",
            });
        }

        if (!isValidStatus(document_status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid document status",
            });
        }

        const [existing] = await db.query(
            `
                SELECT document_id
                FROM documents
                WHERE LOWER(document_name) = LOWER(?)
                LIMIT 1
            `,
            [document_name.trim()]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Document already exists",
            });
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
                Boolean(document_is_reusable),
                document_status,
                Boolean(document_is_required),
            ]
        );

        const [rows] = await db.query(
            `
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
                WHERE document_id = ?
            `,
            [result.insertId]
        );

        return res.status(201).json({
            success: true,
            message: "Document added successfully",
            document: rows[0],
        });
    } catch (error) {
        console.error("Add document error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add document",
        });
    }
};


export const addTemplate = async (req, res) => {
    try {
        const {
            template_name,
            template_description,
            template_status = "active",
            document_ids = [],
        } = req.body;

        if (!template_name || !template_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Template name is required",
            });
        }

        if (!isValidStatus(template_status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid template status",
            });
        }

        const cleanDocumentIds = [...new Set(
            document_ids
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];

        const [existing] = await db.query(
            `
                SELECT template_id
                FROM templates
                WHERE LOWER(template_name) = LOWER(?)
                LIMIT 1
            `,
            [template_name.trim()]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Template already exists",
            });
        }

        const [result] = await db.query(
            `
                INSERT INTO templates (
                    template_name,
                    template_description,
                    template_status
                ) VALUES (?, ?, ?)
            `,
            [
                template_name.trim(),
                template_description?.trim() || null,
                template_status,
            ]
        );

        const template_id = result.insertId;

        if (cleanDocumentIds.length > 0) {
            const values = cleanDocumentIds.map((document_id) => [
                template_id,
                document_id,
            ]);

            await db.query(
                `
                    INSERT INTO document_template_list (
                        template_id,
                        document_id
                    ) VALUES ?
                `,
                [values]
            );
        }

        return res.status(201).json({
            success: true,
            message: "Template added successfully",
            template_id,
        });
    } catch (error) {
        console.error("Add template error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add template",
        });
    }
};

export const editDocument = async (req, res) => {
    try {
        const { document_id } = req.params;

        const {
            document_name,
            document_description,
            document_is_reusable,
            document_status,
            document_is_required,
        } = req.body;

        if (!document_id) {
            return res.status(400).json({
                success: false,
                message: "Document ID is required",
            });
        }

        if (!document_name || !document_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Document name is required",
            });
        }

        if (!isValidStatus(document_status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid document status",
            });
        }

        const [existing] = await db.query(
            `
                SELECT document_id
                FROM documents
                WHERE document_id = ?
                LIMIT 1
            `,
            [document_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Document not found",
            });
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
                Boolean(document_is_reusable),
                document_status,
                Boolean(document_is_required),
                document_id,
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Document updated successfully",
        });
    } catch (error) {
        console.error("Edit document error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update document",
        });
    }
};

export const editTemplate = async (req, res) => {
    try {
        const { template_id } = req.params;

        const {
            template_name,
            template_description,
            template_status,
            document_ids,
        } = req.body;

        if (!template_id) {
            return res.status(400).json({
                success: false,
                message: "Template ID is required",
            });
        }

        if (!template_name || !template_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Template name is required",
            });
        }

        if (!isValidStatus(template_status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid template status",
            });
        }

        const [existing] = await db.query(
            `
                SELECT template_id
                FROM templates
                WHERE template_id = ?
                LIMIT 1
            `,
            [template_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
            });
        }

        await db.query(
            `
                UPDATE templates
                SET
                    template_name = ?,
                    template_description = ?,
                    template_status = ?
                WHERE template_id = ?
            `,
            [
                template_name.trim(),
                template_description?.trim() || null,
                template_status,
                template_id,
            ]
        );

        if (Array.isArray(document_ids)) {
            const cleanDocumentIds = [...new Set(
                document_ids
                    .map((id) => Number(id))
                    .filter((id) => Number.isInteger(id) && id > 0)
            )];

            await db.query(
                `
                    DELETE FROM document_template_list
                    WHERE template_id = ?
                `,
                [template_id]
            );

            if (cleanDocumentIds.length > 0) {
                const values = cleanDocumentIds.map((document_id) => [
                    Number(template_id),
                    document_id,
                ]);

                await db.query(
                    `
                        INSERT INTO document_template_list (
                            template_id,
                            document_id
                        ) VALUES ?
                    `,
                    [values]
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: "Template updated successfully",
        });
    } catch (error) {
        console.error("Edit template error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update template",
        });
    }
};

export const deleteDocument = async (req, res) => {
    try {
        const { document_id } = req.params;

        if (!document_id) {
            return res.status(400).json({
                success: false,
                message: "Document ID is required",
            });
        }

        const [existing] = await db.query(
            `
                SELECT document_id
                FROM documents
                WHERE document_id = ?
                LIMIT 1
            `,
            [document_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Document not found",
            });
        }

        await db.query(
            `
                DELETE FROM document_template_list
                WHERE document_id = ?
            `,
            [document_id]
        );

        await db.query(
            `
                DELETE FROM documents
                WHERE document_id = ?
            `,
            [document_id]
        );

        return res.status(200).json({
            success: true,
            message: "Document deleted successfully",
        });
    } catch (error) {
        console.error("Delete document error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete document",
        });
    }
};

export const deleteTemplate = async (req, res) => {
    try {
        const { template_id } = req.params;

        if (!template_id) {
            return res.status(400).json({
                success: false,
                message: "Template ID is required",
            });
        }

        const [existing] = await db.query(
            `
                SELECT template_id
                FROM templates
                WHERE template_id = ?
                LIMIT 1
            `,
            [template_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Template not found",
            });
        }

        await db.query(
            `
                DELETE FROM document_template_list
                WHERE template_id = ?
            `,
            [template_id]
        );

        await db.query(
            `
                DELETE FROM templates
                WHERE template_id = ?
            `,
            [template_id]
        );

        return res.status(200).json({
            success: true,
            message: "Template deleted successfully",
        });
    } catch (error) {
        console.error("Delete template error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete template",
        });
    }
};
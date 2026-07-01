import { db } from "../../db/connect.js";


export const getBailenProject = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT  
                project_bailen_id,
                project_bailen_name,
                project_bailen_location,
                project_bailen_location_code,
                project_bailen_administrator_name,
                project_bailen_tax_declaration_no,
                project_bailen_pin,
                project_bailen_status,
                project_bailen_created_at,
                project_bailen_updated_at
            FROM project_bailen
        `);

        return res.status(200).json({
            success: true,
            data: rows[0],
        });
    } catch (error) {
        console.error("Get Bailen project error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch Bailen project.",
        });
    }
};

export const getBailenCadastralLotNumbers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT  
                bailen_cadastral_lot_number_id,
                project_bailen_id,
                bailen_cadastral_lot_number,
                bailen_cadastral_lot_number_created_at,
                bailen_cadastral_lot_number_updated_at
            FROM bailen_cadastral_lot_numbers
            ORDER BY bailen_cadastral_lot_number_created_at DESC
        `);

        return res.status(200).json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("Get Bailen cadastral lot numbers error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch Bailen cadastral lot numbers.",
        });
    }
};

export const getBailenDocuments = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT  
                bdd.default_document_id,
                bdd.project_bailen_id,
                bdd.document_id,

                d.document_name,
                d.document_description,
                d.document_is_reusable,
                d.document_status,
                d.document_is_required
            FROM bailen_default_documents bdd
                LEFT JOIN documents d
                    ON bdd.document_id = d.document_id
            ORDER BY bdd.default_document_id DESC
        `);

        return res.status(200).json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("Get Bailen documents error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch Bailen documents.",
        });
    }
};

export const editBailenProject = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const {
            project_bailen_id,
            project_bailen_name,
            project_bailen_location,
            project_bailen_location_code,
            project_bailen_administrator_name,
            project_bailen_tax_declaration_no,
            project_bailen_pin,
            project_bailen_status,
            document_ids,
            default_document_ids,
        } = req.body;

        const projectId = Number(project_bailen_id);
        const selectedDocumentIds = Array.isArray(document_ids)
            ? document_ids
            : Array.isArray(default_document_ids)
                ? default_document_ids
                : [];

        const cleanDocumentIds = [
            ...new Set(
                selectedDocumentIds
                    .map((id) => Number(id))
                    .filter((id) => Number.isInteger(id) && id > 0)
            ),
        ];

        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: "Project ID is required.",
            });
        }

        if (!project_bailen_name || !project_bailen_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Project name is required.",
            });
        }

        if (!project_bailen_location || !project_bailen_location.trim()) {
            return res.status(400).json({
                success: false,
                message: "Project location is required.",
            });
        }

        if (!project_bailen_location_code || !project_bailen_location_code.trim()) {
            return res.status(400).json({
                success: false,
                message: "Location code is required.",
            });
        }

        if (
            !project_bailen_status ||
            !["active", "inactive"].includes(project_bailen_status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid project status.",
            });
        }

        await connection.beginTransaction();

        const [projectRows] = await connection.query(
            `
                SELECT project_bailen_id
                FROM project_bailen
                WHERE project_bailen_id = ?
                LIMIT 1
            `,
            [projectId]
        );

        if (projectRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Bailen project not found.",
            });
        }

        const [duplicateNameRows] = await connection.query(
            `
                SELECT project_bailen_id
                FROM project_bailen
                WHERE LOWER(project_bailen_name) = LOWER(?)
                    AND project_bailen_id != ?
                LIMIT 1
            `,
            [project_bailen_name.trim(), projectId]
        );

        if (duplicateNameRows.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Project name already exists.",
            });
        }

        const [duplicateCodeRows] = await connection.query(
            `
                SELECT project_bailen_id
                FROM project_bailen
                WHERE LOWER(project_bailen_location_code) = LOWER(?)
                    AND project_bailen_id != ?
                LIMIT 1
            `,
            [project_bailen_location_code.trim(), projectId]
        );

        if (duplicateCodeRows.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Location code already exists.",
            });
        }

        if (cleanDocumentIds.length > 0) {
            const placeholders = cleanDocumentIds.map(() => "?").join(",");

            const [existingDocuments] = await connection.query(
                `
                    SELECT document_id
                    FROM documents
                    WHERE document_id IN (${placeholders})
                `,
                cleanDocumentIds
            );

            if (existingDocuments.length !== cleanDocumentIds.length) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "One or more selected documents do not exist.",
                });
            }
        }

        await connection.query(
            `
                UPDATE project_bailen
                SET
                    project_bailen_name = ?,
                    project_bailen_location = ?,
                    project_bailen_location_code = ?,
                    project_bailen_administrator_name = ?,
                    project_bailen_tax_declaration_no = ?,
                    project_bailen_pin = ?,
                    project_bailen_status = ?
                WHERE project_bailen_id = ?
            `,
            [
                project_bailen_name.trim(),
                project_bailen_location.trim(),
                project_bailen_location_code.trim().toUpperCase(),
                project_bailen_administrator_name?.trim() || "",
                project_bailen_tax_declaration_no?.trim() || "",
                project_bailen_pin?.trim() || "",
                project_bailen_status,
                projectId,
            ]
        );

        await connection.query(
            `
                DELETE FROM bailen_default_documents
                WHERE project_bailen_id = ?
            `,
            [projectId]
        );

        if (cleanDocumentIds.length > 0) {
            await connection.query(
                `
                    INSERT INTO bailen_default_documents
                        (project_bailen_id, document_id)
                    VALUES ?
                `,
                [cleanDocumentIds.map((documentId) => [projectId, documentId])]
            );
        }

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: "Bailen project updated successfully.",
        });
    } catch (error) {
        await connection.rollback();

        console.error("Edit Bailen project error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update Bailen project.",
        });
    } finally {
        connection.release();
    }
};
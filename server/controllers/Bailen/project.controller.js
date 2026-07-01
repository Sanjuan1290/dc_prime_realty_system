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
    
}
import { db } from '../../../db/connect.js';
import { getActorId } from '../../../utils/bailenHelpers.js';
const getError = (error) => error?.message || 'Something went wrong.';

export const uploadDocument = async (req, res) => {
  try {
    const { requirementId } = req.params;
    const { uploaded_file_url, uploaded_file_name, uploaded_public_id } = req.body;
    if (!uploaded_file_url) return res.status(400).json({ message: 'Uploaded file URL is required.' });
    await db.query(`
      UPDATE bailen_listing_document_requirements
      SET uploaded_file_url = ?, uploaded_file_name = ?, uploaded_public_id = ?, uploaded_at = NOW(), document_review_status = 'submitted'
      WHERE listing_document_requirement_id = ?
    `, [uploaded_file_url, uploaded_file_name || null, uploaded_public_id || null, requirementId]);
    return res.json({ message: 'Document uploaded successfully.' });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};

export const approveDocument = async (req, res) => {
  try {
    await db.query(`
      UPDATE bailen_listing_document_requirements
      SET document_review_status = 'approved', reviewed_at = NOW(), reviewed_by_user_id = ?
      WHERE listing_document_requirement_id = ? AND uploaded_file_url IS NOT NULL
    `, [getActorId(req), req.params.requirementId]);
    return res.json({ message: 'Document approved successfully.' });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};

export const deleteDocumentUpload = async (req, res) => {
  try {
    await db.query(`
      UPDATE bailen_listing_document_requirements
      SET uploaded_file_url = NULL, uploaded_file_name = NULL, uploaded_public_id = NULL, uploaded_at = NULL, reviewed_at = NULL, reviewed_by_user_id = NULL, document_review_status = 'missing'
      WHERE listing_document_requirement_id = ?
    `, [req.params.requirementId]);
    return res.json({ message: 'Document upload deleted successfully.' });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};

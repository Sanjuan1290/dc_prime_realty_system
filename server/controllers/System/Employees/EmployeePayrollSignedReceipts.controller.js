import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import {
  createAuthenticatedSignedCopyUploadSignature,
  getPerceptionPointQuotaState,
  getCloudinaryMalwareScanState,
  validateDocumentUploadRequest,
  verifyAuthenticatedCloudinaryAsset,
  sendAuthenticatedAssetContent,
} from '../../../services/secureCloudinary.service.js';
import { buildSignedCopyStoredFileName, deriveStoredFileNameFromPublicId, getFileExtension } from '../../../services/storageCodes.service.js';

export const MAX_SIGNED_PAYROLL_FILES = 5;
const clean = (v) => String(v ?? '').trim();
const positiveId = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const sendError = (res, error) => res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Unable to process signed salary receipt.' });

// Folder paths use immutable IDs, not names, salary amounts, or changeable job details.
export const payrollReceiptFolder = (employeeId, payrollId, root = process.env.CLOUDINARY_UPLOAD_FOLDER || 'dc_prime') => {
  if (!positiveId(employeeId) || !positiveId(payrollId)) throw fail('Invalid employee payroll record.');
  const safeRoot = clean(root).replace(/[^a-zA-Z0-9_-]/g, '_') || 'dc_prime';
  return `${safeRoot}/protected/employee-payroll/EMP-${String(employeeId).padStart(6, '0')}/PAYROLL-${String(payrollId).padStart(8, '0')}/fund-release/signed`;
};

const queryPayroll = async (connection, payrollId, lock = false) => {
  const [rows] = await connection.query(`SELECT employee_payroll_id, employee_id, payroll_status, finalized_snapshot FROM employee_payrolls WHERE employee_payroll_id = ? ${lock ? 'FOR UPDATE' : ''}`, [payrollId]);
  const record = rows[0];
  if (!record) throw fail('Salary record not found.', 404);
  if (record.payroll_status !== 'released') throw fail('Signed receipts may only be attached after the salary has been marked Released.', 409);
  if (!record.finalized_snapshot) throw fail('A finalized salary record is required before signed receipts can be uploaded.', 409);
  return record;
};
const activeFiles = async (connection, payrollId) => {
  const [rows] = await connection.query(`SELECT id, employee_payroll_id, original_file_name, mime_type, file_size_bytes, malware_scan_status, created_at FROM employee_payroll_signed_receipts WHERE employee_payroll_id = ? AND status = 'active' ORDER BY id ASC`, [payrollId]);
  return rows;
};
const fileUrl = (payrollId, id) => `/employee-payroll/payrolls/${payrollId}/signed-receipts/${id}/content`;
const mapped = (row) => ({
  id: Number(row.id), name: row.original_file_name, type: row.mime_type, size: Number(row.file_size_bytes),
  scanStatus: row.malware_scan_status, uploadedAt: row.created_at,
  contentPath: fileUrl(row.employee_payroll_id, row.id),
});
const getIds = (req) => {
  const payrollId = positiveId(req.params.employeePayrollId);
  if (!payrollId) throw fail('Select a valid payroll record.');
  return payrollId;
};

export const listPayrollSignedReceipts = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const payrollId = getIds(req);
    await queryPayroll(conn, payrollId);
    const rows = await activeFiles(conn, payrollId);
    return res.json({ success: true, data: { maxFiles: MAX_SIGNED_PAYROLL_FILES, files: rows.map(mapped) } });
  } catch (error) { return sendError(res, error); }
  finally { conn.release(); }
};

export const signPayrollReceiptUpload = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const payrollId = getIds(req);
    const payroll = await queryPayroll(conn, payrollId);
    const existing = await activeFiles(conn, payrollId);
    if (existing.length >= MAX_SIGNED_PAYROLL_FILES) throw fail('Five signed receipts are already attached. Archive an incorrect copy before uploading another.', 409);
    const file = validateDocumentUploadRequest(req.body || {});
    const quota = await getPerceptionPointQuotaState({ requiredScans: 1 });
    if (!quota.configured || (quota.known && quota.insufficient)) throw fail('Security scanning is unavailable. Contact the administrator before uploading a signed salary receipt.', 503);
    const storedFileName = buildSignedCopyStoredFileName({ prefix: `PAYROLL-${payrollId}-RECEIPT-${existing.length + 1}`, version: Date.now(), extension: getFileExtension(file) });
    const signature = createAuthenticatedSignedCopyUploadSignature({
      folder: payrollReceiptFolder(payroll.employee_id, payrollId),
      accountId: payrollId,
      parentType: 'employee_payroll',
      parentId: payrollId,
      storedFileName,
      scanRequested: true,
    });
    return res.json({ success: true, data: signature });
  } catch (error) { return sendError(res, error); }
  finally { conn.release(); }
};

export const savePayrollSignedReceipt = async (req, res) => {
  const conn = await db.getConnection(); let started = false;
  try {
    const payrollId = getIds(req);
    const body = req.body?.file || {};
    const file = validateDocumentUploadRequest({ fileName: body.fileName, fileType: body.fileType, fileSize: body.fileSize });
    if (!clean(body.cloudinaryPublicId)) throw fail('Cloudinary asset reference is missing.');
    // Verify the uploaded asset against Cloudinary, not user-submitted metadata.
    const preliminary = await queryPayroll(conn, payrollId);
    const folder = payrollReceiptFolder(preliminary.employee_id, payrollId);
    const asset = await verifyAuthenticatedCloudinaryAsset({ publicId: body.cloudinaryPublicId, resourceType: body.cloudinaryResourceType, expectedFolder: folder });
    const context = asset.context?.custom || asset.context || {};
    if (clean(context.parent_type) !== 'employee_payroll' || Number(context.parent_id) !== payrollId || Number(context.account_id) !== payrollId) {
      throw fail('Uploaded receipt does not belong to this payroll record.', 409);
    }
    const scan = getCloudinaryMalwareScanState(asset);
    if (scan.status === 'rejected' || scan.status === 'not_scanned') throw fail('Upload rejected: this receipt did not pass the required security-scan setup.', 422);
    await conn.beginTransaction(); started = true;
    const payroll = await queryPayroll(conn, payrollId, true);
    if (payroll.employee_id !== preliminary.employee_id) throw fail('Payroll record changed during upload.', 409);
    const [countRows] = await conn.query(`SELECT COUNT(*) AS total FROM employee_payroll_signed_receipts WHERE employee_payroll_id = ? AND status = 'active'`, [payrollId]);
    if (Number(countRows[0]?.total || 0) >= MAX_SIGNED_PAYROLL_FILES) throw fail('Only five active signed receipts are allowed.', 409);
    const [insert] = await conn.query(`INSERT INTO employee_payroll_signed_receipts (employee_payroll_id,employee_id,original_file_name,stored_file_name,mime_type,file_size_bytes,cloudinary_asset_id,cloudinary_public_id,cloudinary_resource_type,cloudinary_delivery_type,cloudinary_asset_folder,cloudinary_format,malware_scan_status,malware_scan_provider,malware_scan_reason,malware_scanned_at,uploaded_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      payrollId, payroll.employee_id, file.fileName, deriveStoredFileNameFromPublicId(asset.public_id, getFileExtension(file)) || file.fileName,
      file.fileType, Number(asset.bytes || file.fileSize), asset.asset_id || null, asset.public_id, asset.resource_type || 'image', asset.type,
      folder, asset.format || null, scan.status, scan.provider || null, scan.reason || null, scan.status === 'approved' ? new Date() : null, req.authUser?.id || null,
    ]);
    await writeAuditLog(conn, req, { actor:req.authUser, action:'create', module:'Employee Salary', entityType:'employee_payroll_signed_receipt', entityId:String(insert.insertId), entityLabel:`Payroll #${payrollId}`, title:'Signed salary receipt uploaded', description:`Uploaded signed receipt for payroll #${payrollId}.`, metadata:{ payrollId, employeeId:payroll.employee_id, signedFileId:insert.insertId, fileName:file.fileName } });
    await conn.commit(); started = false;
    return res.status(201).json({ success: true, message: 'Signed receipt uploaded.', data: { id:Number(insert.insertId) } });
  } catch (error) { if (started) await conn.rollback().catch(()=>{}); return sendError(res,error); }
  finally { conn.release(); }
};

export const getPayrollSignedReceiptContent = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const payrollId = getIds(req);
    await queryPayroll(conn, payrollId);
    const fileId = positiveId(req.params.fileId);
    if (!fileId) throw fail('Invalid receipt file.', 400);
    const [rows] = await conn.query(`SELECT * FROM employee_payroll_signed_receipts WHERE id = ? AND employee_payroll_id = ? AND status = 'active' LIMIT 1`, [fileId, payrollId]);
    const file = rows[0]; if (!file) throw fail('Signed receipt not found.', 404);
    if (file.malware_scan_status !== 'approved') throw fail('This signed receipt cannot be opened until its security scan is approved.', 423);
    return await sendAuthenticatedAssetContent(res, { publicId:file.cloudinary_public_id, format:file.cloudinary_format, resourceType:file.cloudinary_resource_type, fileName:file.original_file_name, fileMimeType:file.mime_type });
  } catch (error) { return sendError(res,error); }
  finally { conn.release(); }
};

export const archivePayrollSignedReceipt = async (req, res) => {
  const conn = await db.getConnection(); let started=false;
  try {
    const payrollId = getIds(req), fileId=positiveId(req.params.fileId);
    if (!fileId) throw fail('Invalid receipt file.');
    await conn.beginTransaction();started=true;
    await queryPayroll(conn,payrollId,true);
    const [updated]=await conn.query(`UPDATE employee_payroll_signed_receipts SET status='archived', archived_at=NOW(), archived_by_user_id=? WHERE id=? AND employee_payroll_id=? AND status='active'`,[req.authUser?.id||null,fileId,payrollId]);
    if (updated.affectedRows!==1) throw fail('This receipt is already archived or unavailable.',409);
    await writeAuditLog(conn,req,{actor:req.authUser,action:'update',module:'Employee Salary',entityType:'employee_payroll_signed_receipt',entityId:String(fileId),entityLabel:`Payroll #${payrollId}`,title:'Signed salary receipt archived',description:'Archived signed salary receipt; the stored file and audit history are retained.',metadata:{payrollId,fileId}});
    await conn.commit();started=false;
    return res.json({success:true,message:'Signed receipt archived. You can upload a replacement.'});
  } catch(error) {if(started)await conn.rollback().catch(()=>{});return sendError(res,error);}
  finally {conn.release();}
};

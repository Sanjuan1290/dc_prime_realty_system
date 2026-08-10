import crypto from 'node:crypto';

import { db, getErrorMessage } from '../Lot_Projects/_shared/lotProject.shared.js';

const clean = (value) => String(value ?? '').trim();
const MAX_WEBHOOK_AGE_SECONDS = 2 * 60 * 60;

const getWebhookSecret = () =>
  clean(process.env.CLOUDINARY_WEBHOOK_API_SECRET) ||
  clean(process.env.CLOUDINARY_API_SECRET);

const safeEqualHex = (left, right) => {
  const a = Buffer.from(clean(left).toLowerCase(), 'utf8');
  const b = Buffer.from(clean(right).toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const buildNotificationSignature = (rawBody, timestamp, secret, algorithm) =>
  crypto.createHash(algorithm).update(`${rawBody}${timestamp}${secret}`).digest('hex');

const verifyCloudinaryNotification = (req) => {
  const signature = clean(req.get('X-Cld-Signature'));
  const timestampText = clean(req.get('X-Cld-Timestamp'));
  const timestamp = Number(timestampText);
  const secret = getWebhookSecret();
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : '';

  if (!secret || !signature || !timestampText || !Number.isFinite(timestamp) || !rawBody) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > MAX_WEBHOOK_AGE_SECONDS) return false;

  const sha1 = buildNotificationSignature(rawBody, timestampText, secret, 'sha1');
  const sha256 = buildNotificationSignature(rawBody, timestampText, secret, 'sha256');
  return safeEqualHex(signature, sha1) || safeEqualHex(signature, sha256);
};

const normalizeModerationStatus = (body = {}) => {
  const status = clean(
    body.moderation_status ||
    body.moderation?.status ||
    body.status
  ).toLowerCase();
  return ['approved', 'rejected'].includes(status) ? status : '';
};

const isPerceptionPointNotification = (body = {}) => {
  const kind = clean(
    body.moderation_kind ||
    body.moderation?.kind ||
    body.moderation?.type ||
    body.moderation?.provider
  ).toLowerCase();

  // Perception Point notifications normally include moderation_kind. If an
  // older payload omits it, accept only the moderation-specific callback shape.
  if (!kind) return Boolean(body.moderation_status && body.public_id);
  return kind === 'perception_point' || kind.includes('perception');
};

const updateClientDocumentSnapshots = async (connection, publicId, scanState) => {
  const [rows] = await connection.query(
    `
      SELECT DISTINCT
        file_row.lot_project_client_document_id,
        client_document.lot_project_client_document_file_url
      FROM lot_project_client_document_files file_row
      INNER JOIN lot_project_client_documents client_document
        ON client_document.lot_project_client_document_id = file_row.lot_project_client_document_id
      WHERE file_row.cloudinary_public_id = ?
    `,
    [publicId]
  );

  for (const row of rows) {
    let entries;
    try {
      entries = JSON.parse(row.lot_project_client_document_file_url || '[]');
    } catch {
      entries = [];
    }
    if (!Array.isArray(entries)) continue;

    let changed = false;
    const nextEntries = entries.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const entryPublicId = clean(entry.cloudinaryPublicId || entry.cloudinary_public_id || entry.public_id);
      if (entryPublicId !== publicId) return entry;
      changed = true;
      return {
        ...entry,
        malwareScanStatus: scanState.status,
        malwareScanProvider: 'perception_point',
        malwareScanReason: scanState.reason,
        malwareScannedAt: scanState.scannedAt,
      };
    });

    if (changed) {
      await connection.query(
        `
          UPDATE lot_project_client_documents
          SET lot_project_client_document_file_url = ?,
              lot_project_client_document_updated_at = NOW()
          WHERE lot_project_client_document_id = ?
        `,
        [JSON.stringify(nextEntries), row.lot_project_client_document_id]
      );
    }
  }
};

export const handleCloudinaryMalwareWebhook = async (req, res) => {
  if (!verifyCloudinaryNotification(req)) {
    return res.status(401).json({ success: false, message: 'Invalid Cloudinary webhook signature.' });
  }

  const publicId = clean(req.body?.public_id);
  const moderationStatus = normalizeModerationStatus(req.body || {});

  if (!publicId || !moderationStatus || !isPerceptionPointNotification(req.body || {})) {
    return res.status(200).json({ success: true, ignored: true });
  }

  const connection = await db.getConnection();
  try {
    const scanState = {
      status: moderationStatus,
      reason: moderationStatus === 'rejected' ? 'malware_detected' : null,
      scannedAt: new Date().toISOString(),
    };

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE lot_project_client_document_files
        SET malware_scan_status = ?,
            malware_scan_provider = 'perception_point',
            malware_scan_reason = ?,
            malware_scanned_at = NOW()
        WHERE cloudinary_public_id = ?
      `,
      [scanState.status, scanState.reason, publicId]
    );

    await connection.query(
      `
        UPDATE lot_project_payment_proofs
        SET malware_scan_status = ?,
            malware_scan_provider = 'perception_point',
            malware_scan_reason = ?,
            malware_scanned_at = NOW(),
            updated_at = NOW()
        WHERE cloudinary_public_id = ?
      `,
      [scanState.status, scanState.reason, publicId]
    );

    await updateClientDocumentSnapshots(connection, publicId, scanState);
    await connection.commit();

    return res.status(200).json({ success: true });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    console.error('Cloudinary malware webhook failed:', error);
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

import {
  tableExists,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';
import {
  buildBuyerDocumentFolder,
  buildCommissionReceiptSignedCopyFolder,
  buildPaymentAcknowledgementSignedCopyFolder,
  buildPaymentProofFolder,
  moveAuthenticatedAssetFolder,
} from './secureCloudinary.service.js';
import {
  resolvePaymentStorageCode,
  resolveProjectStorageCode,
} from './storageCodes.service.js';

const clean = (value) => String(value ?? '').trim();

const getAccountStorageContext = async (connection, accountId) => {
  const [rows] = await connection.query(
    `
      SELECT
        account.lot_project_account_id,
        account.account_reference,
        account.lot_project_id,
        project.lot_project_storage_code,
        project.lot_project_location_code
      FROM lot_project_accounts account
      INNER JOIN lot_projects project
        ON project.lot_project_id = account.lot_project_id
      WHERE account.lot_project_account_id = ?
      LIMIT 1
    `,
    [Number(accountId)]
  );
  const context = rows[0] || null;
  if (!context || !clean(context.account_reference)) {
    const error = new Error('Buyer account storage identity is missing.');
    error.statusCode = 409;
    throw error;
  }
  return context;
};

const moveRows = async ({ connection, rows, tableName, idColumn, buildTargetFolder, summary, kind, dryRun = false }) => {
  for (const row of rows) {
    const targetFolder = buildTargetFolder(row);
    let result;
    try {
      result = await moveAuthenticatedAssetFolder({
        publicId: row.cloudinary_public_id,
        resourceType: row.cloudinary_resource_type,
        deliveryType: row.cloudinary_delivery_type,
        currentFolder: row.cloudinary_asset_folder,
        targetFolder,
        dryRun,
      });
    } catch (cause) {
      const originalMessage = clean(cause?.message || cause?.error?.message) || 'Cloudinary protected-file storage reconciliation failed.';
      const error = new Error(`${kind} file #${row[idColumn]} could not be reconciled to the buyer account folder. ${originalMessage}`);
      error.statusCode = Number(cause?.statusCode || 0) || 502;
      error.code = cause?.code || 'PROTECTED_STORAGE_RECONCILIATION_FAILED';
      error.fileKind = kind;
      error.fileId = Number(row[idColumn] || 0) || null;
      throw error;
    }

    if (!dryRun) {
      await connection.query(
        `UPDATE ${tableName} SET cloudinary_asset_folder = ? WHERE ${idColumn} = ?`,
        [targetFolder, row[idColumn]]
      );
    }
    summary.checked += 1;
    summary[kind] += 1;
    if (result.moved) summary.moved += 1;
    else summary.alreadyCanonical += 1;
  }
};

/**
 * Moves the account's protected Cloudinary assets to the V4 account-owned tree.
 * Public IDs, file IDs, upload timestamps, malware state, and filenames remain
 * unchanged. Only Cloudinary's dynamic Media Library folder + stored folder
 * metadata are reconciled.
 */
export const reconcileAccountProtectedStorage = async (connection, { accountId, dryRun = false }) => {
  const context = await getAccountStorageContext(connection, accountId);
  const accountReference = clean(context.account_reference);
  const projectStorageCode = resolveProjectStorageCode(context);
  const common = {
    projectStorageCode,
    projectId: context.lot_project_id,
    projectLocationCode: context.lot_project_location_code,
    accountReference,
  };
  const summary = {
    checked: 0,
    moved: 0,
    alreadyCanonical: 0,
    buyerDocuments: 0,
    paymentProofs: 0,
    acknowledgementCopies: 0,
    commissionReceiptCopies: 0,
  };

  if (await tableExists(connection, 'lot_project_client_document_files')) {
    const [rows] = await connection.query(
      `
        SELECT
          file_row.lot_project_client_document_file_id,
          file_row.cloudinary_public_id,
          file_row.cloudinary_resource_type,
          file_row.cloudinary_delivery_type,
          file_row.cloudinary_asset_folder,
          client_document.document_id,
          document_row.document_code
        FROM lot_project_client_document_files file_row
        INNER JOIN lot_project_client_documents client_document
          ON client_document.lot_project_client_document_id = file_row.lot_project_client_document_id
        LEFT JOIN documents document_row
          ON document_row.document_id = client_document.document_id
        WHERE file_row.lot_project_account_id = ?
          AND file_row.file_status <> 'removed'
          AND NULLIF(TRIM(file_row.cloudinary_public_id), '') IS NOT NULL
        ORDER BY file_row.lot_project_client_document_file_id
      `,
      [Number(accountId)]
    );
    await moveRows({
      connection,
      rows,
      tableName: 'lot_project_client_document_files',
      idColumn: 'lot_project_client_document_file_id',
      summary,
      kind: 'buyerDocuments',
      dryRun,
      buildTargetFolder: (row) => buildBuyerDocumentFolder({
        ...common,
        documentCode: row.document_code,
        documentId: row.document_id,
      }),
    });
  }

  if (await tableExists(connection, 'lot_project_payment_proofs')) {
    const [rows] = await connection.query(
      `
        SELECT
          proof.lot_project_payment_proof_id,
          proof.cloudinary_public_id,
          proof.cloudinary_resource_type,
          proof.cloudinary_delivery_type,
          proof.cloudinary_asset_folder,
          payment.lot_project_payment_id,
          payment.lot_project_payment_storage_code,
          payment.lot_project_payment_created_at
        FROM lot_project_payment_proofs proof
        INNER JOIN lot_project_payments payment
          ON payment.lot_project_payment_id = proof.lot_project_payment_id
        WHERE payment.lot_project_account_id = ?
          AND proof.proof_status = 'active'
          AND NULLIF(TRIM(proof.cloudinary_public_id), '') IS NOT NULL
        ORDER BY proof.lot_project_payment_proof_id
      `,
      [Number(accountId)]
    );
    await moveRows({
      connection,
      rows,
      tableName: 'lot_project_payment_proofs',
      idColumn: 'lot_project_payment_proof_id',
      summary,
      kind: 'paymentProofs',
      dryRun,
      buildTargetFolder: (row) => buildPaymentProofFolder({
        ...common,
        paymentStorageCode: resolvePaymentStorageCode(row),
        paymentId: row.lot_project_payment_id,
      }),
    });
  }

  if (await tableExists(connection, 'lot_project_payment_acknowledgement_files')) {
    const [rows] = await connection.query(
      `
        SELECT
          file_row.lot_project_payment_acknowledgement_file_id,
          file_row.cloudinary_public_id,
          file_row.cloudinary_resource_type,
          file_row.cloudinary_delivery_type,
          file_row.cloudinary_asset_folder,
          payment.lot_project_payment_id,
          payment.lot_project_payment_storage_code,
          payment.lot_project_payment_created_at
        FROM lot_project_payment_acknowledgement_files file_row
        INNER JOIN lot_project_payments payment
          ON payment.lot_project_payment_id = file_row.lot_project_payment_id
        WHERE payment.lot_project_account_id = ?
          AND file_row.file_status <> 'removed'
          AND NULLIF(TRIM(file_row.cloudinary_public_id), '') IS NOT NULL
        ORDER BY file_row.lot_project_payment_acknowledgement_file_id
      `,
      [Number(accountId)]
    );
    await moveRows({
      connection,
      rows,
      tableName: 'lot_project_payment_acknowledgement_files',
      idColumn: 'lot_project_payment_acknowledgement_file_id',
      summary,
      kind: 'acknowledgementCopies',
      dryRun,
      buildTargetFolder: (row) => buildPaymentAcknowledgementSignedCopyFolder({
        ...common,
        paymentStorageCode: resolvePaymentStorageCode(row),
        paymentId: row.lot_project_payment_id,
      }),
    });
  }

  if (await tableExists(connection, 'lot_project_commission_receipt_files')) {
    const [rows] = await connection.query(
      `
        SELECT
          file_row.lot_project_commission_receipt_file_id,
          file_row.lot_project_commission_receipt_id,
          file_row.cloudinary_public_id,
          file_row.cloudinary_resource_type,
          file_row.cloudinary_delivery_type,
          file_row.cloudinary_asset_folder
        FROM lot_project_commission_receipt_files file_row
        WHERE file_row.lot_project_account_id = ?
          AND file_row.file_status <> 'removed'
          AND NULLIF(TRIM(file_row.cloudinary_public_id), '') IS NOT NULL
        ORDER BY file_row.lot_project_commission_receipt_file_id
      `,
      [Number(accountId)]
    );
    await moveRows({
      connection,
      rows,
      tableName: 'lot_project_commission_receipt_files',
      idColumn: 'lot_project_commission_receipt_file_id',
      summary,
      kind: 'commissionReceiptCopies',
      dryRun,
      buildTargetFolder: (row) => buildCommissionReceiptSignedCopyFolder({
        ...common,
        receiptId: row.lot_project_commission_receipt_id,
      }),
    });
  }

  return { accountReference, projectStorageCode, ...summary };
};

/**
 * File metadata follows the account's current listing for operational lookup.
 * The Cloudinary folder does not change because V4 storage is listing-independent.
 */
export const retargetAccountProtectedFileMetadata = async (connection, { accountId, destinationListingId }) => {
  const result = { paymentProofs: 0, acknowledgementCopies: 0, commissionReceiptCopies: 0 };

  if (await tableExists(connection, 'lot_project_payment_proofs')) {
    const [update] = await connection.query(
      `UPDATE lot_project_payment_proofs proof
       INNER JOIN lot_project_payments payment
         ON payment.lot_project_payment_id = proof.lot_project_payment_id
       SET proof.lot_project_listing_id = ?,
           proof.lot_project_account_id = ?
       WHERE payment.lot_project_account_id = ?`,
      [Number(destinationListingId), Number(accountId), Number(accountId)]
    );
    result.paymentProofs = Number(update.affectedRows || 0);
  }

  if (await tableExists(connection, 'lot_project_payment_acknowledgement_files')) {
    const [update] = await connection.query(
      `UPDATE lot_project_payment_acknowledgement_files file_row
       INNER JOIN lot_project_payments payment
         ON payment.lot_project_payment_id = file_row.lot_project_payment_id
       SET file_row.lot_project_listing_id = ?,
           file_row.lot_project_account_id = ?
       WHERE payment.lot_project_account_id = ?`,
      [Number(destinationListingId), Number(accountId), Number(accountId)]
    );
    result.acknowledgementCopies = Number(update.affectedRows || 0);
  }

  if (await tableExists(connection, 'lot_project_commission_receipt_files')) {
    const [update] = await connection.query(
      `UPDATE lot_project_commission_receipt_files
       SET lot_project_listing_id = ?
       WHERE lot_project_account_id = ?`,
      [Number(destinationListingId), Number(accountId)]
    );
    result.commissionReceiptCopies = Number(update.affectedRows || 0);
  }

  return result;
};


import { v2 as cloudinary } from 'cloudinary';

import { db } from '../db/connect.js';
import {
  parseClientDocumentImages,
  tableExists,
  columnExists,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';
import {
  buildBuyerDocumentFolder,
  buildPaymentProofFolder,
  configureSecureCloudinary,
  verifyAuthenticatedCloudinaryAsset,
} from '../services/secureCloudinary.service.js';
import {
  createListingStorageCode,
  createProjectStorageCode,
  resolvePaymentStorageCode,
} from '../services/storageCodes.service.js';
import {
  getCloudinaryResourceType,
} from '../services/cloudinaryUnitFolder.service.js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const includeArchives = !args.has('--skip-archives');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1] || 0)) : null;

const clean = (value) => String(value ?? '').trim();
const log = (...values) => console.log('[cloudinary-storage-ids-v3]', ...values);

const summary = {
  documentFiles: 0,
  paymentProofs: 0,
  archiveAssets: 0,
  moved: 0,
  alreadyCorrect: 0,
  failed: 0,
};

const movedAssetKeys = new Set();

const moveAssetFolder = async ({
  publicId,
  resourceType = 'image',
  deliveryType = 'authenticated',
  currentFolder = '',
  targetFolder,
  label,
}) => {
  const safePublicId = clean(publicId);
  const safeResourceType = ['image', 'raw', 'video'].includes(clean(resourceType)) ? clean(resourceType) : 'image';
  const safeDeliveryType = clean(deliveryType) || 'authenticated';
  const safeTargetFolder = clean(targetFolder);
  const assetKey = `${safeResourceType}:${safeDeliveryType}:${safePublicId}`;

  if (!safePublicId || !safeTargetFolder) {
    summary.failed += 1;
    log('FAILED missing public ID or target folder:', label);
    return { ok: false, folder: clean(currentFolder) };
  }

  if (safeDeliveryType !== 'authenticated') {
    summary.failed += 1;
    log('FAILED asset is not authenticated. Run the existing protected-storage migration first:', label, safeDeliveryType, safePublicId);
    return { ok: false, folder: clean(currentFolder) };
  }

  if (movedAssetKeys.has(assetKey)) {
    return { ok: true, folder: safeTargetFolder, duplicate: true };
  }

  try {
    configureSecureCloudinary();
    const asset = await cloudinary.api.resource(safePublicId, {
      resource_type: safeResourceType,
      type: 'authenticated',
    });
    const actualFolder = clean(asset.asset_folder || asset.folder || currentFolder);

    if (actualFolder === safeTargetFolder) {
      movedAssetKeys.add(assetKey);
      summary.alreadyCorrect += 1;
      log('OK already correct:', label, '->', safeTargetFolder);
      return { ok: true, folder: safeTargetFolder, asset };
    }

    if (!apply) {
      log('DRY RUN move:', label, actualFolder || '(no folder)', '->', safeTargetFolder);
      return { ok: true, folder: safeTargetFolder, asset, dryRun: true };
    }

    // Dynamic-folder move only: keep the Cloudinary public ID and delivery URL identity unchanged.
    await cloudinary.uploader.explicit(safePublicId, {
      resource_type: safeResourceType,
      type: 'authenticated',
      asset_folder: safeTargetFolder,
    });

    const verified = await verifyAuthenticatedCloudinaryAsset({
      publicId: safePublicId,
      resourceType: safeResourceType,
      expectedFolder: safeTargetFolder,
    });

    movedAssetKeys.add(assetKey);
    summary.moved += 1;
    log('MOVED:', label, actualFolder || '(no folder)', '->', safeTargetFolder);
    return { ok: true, folder: safeTargetFolder, asset: verified };
  } catch (error) {
    summary.failed += 1;
    log('FAILED:', label, error?.message || error);
    return { ok: false, folder: clean(currentFolder), error };
  }
};

const migrateDocumentFiles = async (connection) => {
  if (!(await tableExists(connection, 'lot_project_client_document_files'))) return;

  const [rows] = await connection.query(
    `
      SELECT
        file_row.lot_project_client_document_file_id,
        file_row.cloudinary_public_id,
        file_row.cloudinary_resource_type,
        file_row.cloudinary_delivery_type,
        file_row.cloudinary_asset_folder,
        account.account_reference,
        account.lot_project_id,
        account.lot_project_listing_id,
        client_document.document_id,
        document_row.document_code
      FROM lot_project_client_document_files file_row
      INNER JOIN lot_project_accounts account
        ON account.lot_project_account_id = file_row.lot_project_account_id
      INNER JOIN lot_project_client_documents client_document
        ON client_document.lot_project_client_document_id = file_row.lot_project_client_document_id
      LEFT JOIN documents document_row
        ON document_row.document_id = client_document.document_id
      WHERE file_row.file_status <> 'removed'
      ORDER BY file_row.lot_project_client_document_file_id
      ${limit ? 'LIMIT ?' : ''}
    `,
    limit ? [limit] : []
  );

  for (const row of rows) {
    summary.documentFiles += 1;
    const targetFolder = buildBuyerDocumentFolder({
      projectStorageCode: createProjectStorageCode(row.lot_project_id),
      listingStorageCode: createListingStorageCode(row.lot_project_listing_id),
      accountReference: row.account_reference,
      documentCode: row.document_code,
      documentId: row.document_id,
    });
    const result = await moveAssetFolder({
      publicId: row.cloudinary_public_id,
      resourceType: row.cloudinary_resource_type,
      deliveryType: row.cloudinary_delivery_type,
      currentFolder: row.cloudinary_asset_folder,
      targetFolder,
      label: `document-file:${row.lot_project_client_document_file_id}`,
    });

    if (apply && result.ok && !result.duplicate) {
      await connection.query(
        `UPDATE lot_project_client_document_files SET cloudinary_asset_folder = ? WHERE lot_project_client_document_file_id = ?`,
        [targetFolder, row.lot_project_client_document_file_id]
      );
    }
  }
};

const migratePaymentProofs = async (connection) => {
  if (!(await tableExists(connection, 'lot_project_payment_proofs'))) return;

  const [rows] = await connection.query(
    `
      SELECT
        proof.lot_project_payment_proof_id,
        proof.lot_project_id,
        proof.lot_project_listing_id,
        proof.lot_project_account_id,
        proof.lot_project_payment_id,
        proof.cloudinary_public_id,
        proof.cloudinary_resource_type,
        proof.cloudinary_delivery_type,
        proof.cloudinary_asset_folder,
        payment.lot_project_payment_storage_code,
        payment.lot_project_payment_created_at,
        account.account_reference
      FROM lot_project_payment_proofs proof
      INNER JOIN lot_project_payments payment
        ON payment.lot_project_payment_id = proof.lot_project_payment_id
      LEFT JOIN lot_project_accounts account
        ON account.lot_project_account_id = proof.lot_project_account_id
      WHERE proof.proof_status = 'active'
      ORDER BY proof.lot_project_payment_proof_id
      ${limit ? 'LIMIT ?' : ''}
    `,
    limit ? [limit] : []
  );

  for (const row of rows) {
    summary.paymentProofs += 1;
    const targetFolder = buildPaymentProofFolder({
      projectStorageCode: createProjectStorageCode(row.lot_project_id),
      listingStorageCode: createListingStorageCode(row.lot_project_listing_id),
      accountReference: row.account_reference || `ACC-${String(Number(row.lot_project_account_id || 0)).padStart(6, '0')}`,
      paymentStorageCode: resolvePaymentStorageCode(row),
      paymentId: row.lot_project_payment_id,
    });
    const result = await moveAssetFolder({
      publicId: row.cloudinary_public_id,
      resourceType: row.cloudinary_resource_type,
      deliveryType: row.cloudinary_delivery_type,
      currentFolder: row.cloudinary_asset_folder,
      targetFolder,
      label: `payment-proof:${row.lot_project_payment_proof_id}`,
    });

    if (apply && result.ok && !result.duplicate) {
      await connection.query(
        `UPDATE lot_project_payment_proofs SET cloudinary_asset_folder = ? WHERE lot_project_payment_proof_id = ?`,
        [targetFolder, row.lot_project_payment_proof_id]
      );
    }
  }
};

const migrateArchiveOnlyAssets = async (connection) => {
  if (!includeArchives || !(await tableExists(connection, 'lot_project_cancelled_sale_archives'))) return;

  const [documentRows] = await connection.query('SELECT document_id, document_code FROM documents');
  const documentCodes = new Map(documentRows.map((row) => [Number(row.document_id), row.document_code]));
  const [archives] = await connection.query(
    `
      SELECT
        archive_row.lot_project_cancelled_sale_archive_id,
        archive_row.client_document_snapshot,
        account.account_reference,
        account.lot_project_id,
        account.lot_project_listing_id
      FROM lot_project_cancelled_sale_archives archive_row
      INNER JOIN lot_project_accounts account
        ON account.lot_project_account_id = archive_row.lot_project_account_id
      WHERE archive_row.client_document_snapshot IS NOT NULL
      ORDER BY archive_row.lot_project_cancelled_sale_archive_id
      ${limit ? 'LIMIT ?' : ''}
    `,
    limit ? [limit] : []
  );

  for (const archive of archives) {
    let documents = [];
    try {
      documents = Array.isArray(archive.client_document_snapshot)
        ? archive.client_document_snapshot
        : JSON.parse(archive.client_document_snapshot || '[]');
    } catch {
      log('SKIP invalid archive JSON:', archive.lot_project_cancelled_sale_archive_id);
      continue;
    }

    for (const documentRow of documents) {
      const documentId = Number(documentRow.document_id || 0);
      const entries = parseClientDocumentImages(
        documentRow.lot_project_client_document_file_url,
        documentRow.lot_project_client_document_file_name
      );

      for (const entry of entries) {
        // Canonical rows use fileId and are migrated above. This pass covers older
        // archive-only Cloudinary references that no longer have a canonical file row.
        if (Number(entry.fileId || entry.file_id || 0) > 0) continue;
        const publicId = clean(entry.cloudinaryPublicId || entry.cloudinary_public_id || entry.publicId || entry.public_id);
        if (!publicId) continue;

        summary.archiveAssets += 1;
        const targetFolder = buildBuyerDocumentFolder({
          projectStorageCode: createProjectStorageCode(archive.lot_project_id),
          listingStorageCode: createListingStorageCode(archive.lot_project_listing_id),
          accountReference: archive.account_reference,
          documentCode: documentCodes.get(documentId),
          documentId,
        });
        await moveAssetFolder({
          publicId,
          resourceType: getCloudinaryResourceType(entry),
          deliveryType: entry.cloudinaryDeliveryType || entry.cloudinary_delivery_type || entry.type || 'authenticated',
          currentFolder: entry.cloudinaryAssetFolder || entry.cloudinary_asset_folder || entry.asset_folder || '',
          targetFolder,
          label: `archive:${archive.lot_project_cancelled_sale_archive_id}/document:${documentId}`,
        });
      }
    }
  }
};

const updatePermanentStorageCodes = async (connection) => {
  if (!apply) return;

  await connection.beginTransaction();
  try {
    await connection.query(
      `UPDATE lot_projects
       SET lot_project_storage_code = CONCAT('PRJ-', lot_project_id)
       WHERE lot_project_storage_code IS NULL
          OR TRIM(lot_project_storage_code) <> CONCAT('PRJ-', lot_project_id)`
    );
    await connection.query(
      `UPDATE lot_project_listings
       SET lot_project_listing_storage_code = CONCAT('LST-', lot_project_listing_id)
       WHERE lot_project_listing_storage_code IS NULL
          OR TRIM(lot_project_listing_storage_code) <> CONCAT('LST-', lot_project_listing_id)`
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
};

const verifyRequiredSchema = async (connection) => {
  for (const [tableName, columnName] of [
    ['lot_projects', 'lot_project_storage_code'],
    ['lot_project_listings', 'lot_project_listing_storage_code'],
    ['lot_project_client_document_files', 'cloudinary_asset_folder'],
    ['lot_project_payment_proofs', 'cloudinary_asset_folder'],
  ]) {
    if (!(await tableExists(connection, tableName)) || !(await columnExists(connection, tableName, columnName))) {
      throw new Error(`Missing ${tableName}.${columnName}. Apply the existing storage/payment-proof migrations first.`);
    }
  }
};

const main = async () => {
  const connection = await db.getConnection();
  try {
    configureSecureCloudinary();
    await verifyRequiredSchema(connection);
    log(apply
      ? 'APPLY MODE: Cloudinary asset folders and permanent project/listing storage codes will change.'
      : 'DRY RUN: no Cloudinary assets or database rows will change.');

    await migrateDocumentFiles(connection);
    await migratePaymentProofs(connection);
    await migrateArchiveOnlyAssets(connection);

    if (summary.failed > 0) {
      throw new Error(`${summary.failed} Cloudinary asset(s) could not be moved. Project/listing storage codes were NOT changed. Fix the failures and rerun.`);
    }

    await updatePermanentStorageCodes(connection);
    log('Complete.', summary);
    if (!apply) {
      log('Review the dry-run output, enable maintenance mode, then run: npm run migrate:cloudinary-storage-ids -- --apply');
    }
  } finally {
    connection.release();
    await db.end();
  }
};

main().catch((error) => {
  console.error('[cloudinary-storage-ids-v3] FAILED:', error?.stack || error?.message || error);
  process.exitCode = 1;
});

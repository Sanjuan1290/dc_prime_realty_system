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
  getCloudinaryPublicIdFromUrl,
  getCloudinaryResourceType,
} from '../services/cloudinaryUnitFolder.service.js';
import {
  buildDocumentStoredFileName,
  buildPaymentProofStoredFileName,
  createReadableCloudinaryPublicId,
  getFileExtension,
  parseDocumentFileSequenceFromName,
  parseDocumentFileVersionFromName,
  parsePaymentProofSequenceFromName,
  resolveListingStorageCode,
  resolvePaymentStorageCode,
  resolveProjectStorageCode,
} from '../services/storageCodes.service.js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const includeArchives = !args.has('--skip-archives');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1] || 0)) : null;

const clean = (value) => String(value ?? '').trim();
const log = (...values) => console.log('[cloudinary-storage-code-migration]', ...values);

const deliveryTypeFromEntry = (entry = {}) => {
  const explicit = clean(
    entry.cloudinaryDeliveryType
      || entry.cloudinary_delivery_type
      || entry.deliveryType
      || entry.delivery_type
      || entry.type
  );
  if (explicit) return explicit;

  const url = clean(entry.url || entry.secure_url || entry.fileUrl || entry.file_url);
  if (url.includes('/authenticated/')) return 'authenticated';
  if (url.includes('/private/')) return 'private';
  return 'upload';
};

const formatFromEntry = (entry = {}, publicId = '') => {
  const explicit = clean(entry.format || entry.fileFormat || entry.file_format);
  if (explicit) return explicit.replace(/^\./, '').toLowerCase();
  const url = clean(entry.url || entry.secure_url || entry.fileUrl || entry.file_url);
  const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (match) return match[1].toLowerCase();
  const publicMatch = clean(publicId).match(/\.([a-zA-Z0-9]+)$/);
  return publicMatch ? publicMatch[1].toLowerCase() : '';
};

const mimeFromFormat = (format = '', resourceType = 'image') => {
  const value = clean(format).toLowerCase();
  if (value === 'pdf') return 'application/pdf';
  if (value === 'png') return 'image/png';
  if (value === 'jpg' || value === 'jpeg') return 'image/jpeg';
  if (resourceType === 'video') return `video/${value || 'mp4'}`;
  return value ? `application/${value}` : 'application/octet-stream';
};

const normalizedFileName = (entry = {}, index = 0) => clean(
  entry.fileName
    || entry.file_name
    || entry.originalFilename
    || entry.original_filename
    || `Document File ${index + 1}`
);

const getSourcePublicId = (entry = {}) => {
  const resourceType = getCloudinaryResourceType(entry);
  return clean(
    entry.cloudinaryPublicId
      || entry.cloudinary_public_id
      || entry.publicId
      || entry.public_id
  ) || getCloudinaryPublicIdFromUrl(
    entry.url || entry.secure_url || entry.fileUrl || entry.file_url,
    resourceType
  );
};

const migrateAsset = async ({ entry, folder, fileName, storedFileName, label, assetKind = 'buyer_document' }) => {
  const resourceType = getCloudinaryResourceType(entry);
  const sourcePublicId = getSourcePublicId(entry);
  const sourceDeliveryType = deliveryTypeFromEntry(entry);
  if (!sourcePublicId) {
    log('SKIP missing public ID:', label, fileName);
    return null;
  }

  const canonicalBase = clean(storedFileName).replace(/\.[^.]+$/, '');
  const publicLeaf = sourcePublicId.split('/').filter(Boolean).at(-1) || '';
  const alreadyProtected = sourceDeliveryType === 'authenticated'
    && clean(entry.cloudinaryAssetFolder || entry.cloudinary_asset_folder || entry.asset_folder) === folder
    && Boolean(canonicalBase)
    && publicLeaf.startsWith(`${canonicalBase}__`);

  if (!apply) {
    log('DRY RUN', alreadyProtected ? 'verify' : 'migrate', `${sourceDeliveryType}:${resourceType}:${sourcePublicId}`, '->', folder);
    return {
      dryRun: true,
      sourcePublicId,
      publicId: sourcePublicId,
      resourceType,
      deliveryType: sourceDeliveryType,
      assetFolder: folder,
      format: formatFromEntry(entry, sourcePublicId),
      bytes: Number(entry.fileSize || entry.file_size || entry.bytes || 0),
      assetId: clean(entry.cloudinaryAssetId || entry.cloudinary_asset_id || entry.asset_id) || null,
      version: Number(entry.cloudinaryVersion || entry.cloudinary_version || entry.version || 0) || null,
    };
  }

  let targetPublicId = sourcePublicId;
  let asset;

  if (!alreadyProtected) {
    targetPublicId = createReadableCloudinaryPublicId(storedFileName);
    const renameResult = await cloudinary.uploader.rename(sourcePublicId, targetPublicId, {
      resource_type: resourceType,
      type: sourceDeliveryType,
      to_type: 'authenticated',
      overwrite: false,
      invalidate: true,
    });

    await cloudinary.uploader.explicit(renameResult.public_id || targetPublicId, {
      resource_type: resourceType,
      type: 'authenticated',
      asset_folder: folder,
      tags: ['dc_prime', assetKind, 'authenticated', 'migrated'],
      context: `migration=storage_codes_v2|stored_name=${encodeURIComponent(clean(storedFileName).slice(0, 180))}`,
    });
    targetPublicId = renameResult.public_id || targetPublicId;
  }

  asset = await verifyAuthenticatedCloudinaryAsset({
    publicId: targetPublicId,
    resourceType,
    expectedFolder: folder,
  });

  log('MIGRATED', label, fileName, '->', `${asset.type}:${asset.resource_type}:${asset.public_id}`);
  return {
    sourcePublicId,
    publicId: asset.public_id,
    resourceType: asset.resource_type || resourceType,
    deliveryType: asset.type || 'authenticated',
    assetFolder: asset.asset_folder || folder,
    format: asset.format || formatFromEntry(entry, targetPublicId),
    bytes: Number(asset.bytes || entry.fileSize || entry.file_size || 0),
    assetId: asset.asset_id || null,
    version: Number(asset.version || 0) || null,
  };
};

const buildProtectedEntry = ({ migration, fileId = null, fileName, storedFileName, fileVersion = 1, fileSequence = 1, originalEntry = {} }) => ({
  url: fileId ? `protected://document-file/${fileId}` : `protected://cloudinary/${migration.publicId}`,
  fileId: fileId || undefined,
  accessPath: fileId ? `/document-files/${fileId}/access-url` : undefined,
  fileName,
  storedFileName,
  fileVersion,
  fileSequence,
  fileSize: migration.bytes,
  fileType: mimeFromFormat(migration.format, migration.resourceType),
  format: migration.format || null,
  cloudinaryAssetId: migration.assetId,
  cloudinaryPublicId: migration.publicId,
  cloudinaryResourceType: migration.resourceType,
  cloudinaryDeliveryType: 'authenticated',
  cloudinaryVersion: migration.version,
  cloudinaryAssetFolder: migration.assetFolder,
  protected: true,
  migratedAt: new Date().toISOString(),
  uploadedAt: originalEntry.uploadedAt || originalEntry.uploaded_at || null,
});

const migrateLiveDocuments = async (connection) => {
  const [rows] = await connection.query(
    `
      SELECT
        client_document.lot_project_client_document_id,
        client_document.lot_project_account_id,
        client_document.lot_project_client_document_file_name,
        client_document.lot_project_client_document_file_url,
        account.account_reference,
        account.buyer_name_snapshot,
        project.lot_project_id,
        project.lot_project_storage_code,
        project.lot_project_location_code,
        listing.lot_project_listing_id,
        listing.lot_project_listing_storage_code,
        profile.buyer_full_name,
        document_row.document_id,
        document_row.document_code,
        document_row.document_name
      FROM lot_project_client_documents client_document
      INNER JOIN lot_project_accounts account
        ON account.lot_project_account_id = client_document.lot_project_account_id
      INNER JOIN lot_projects project
        ON project.lot_project_id = account.lot_project_id
      INNER JOIN lot_project_listings listing
        ON listing.lot_project_listing_id = account.lot_project_listing_id
      LEFT JOIN lot_project_client_profiles profile
        ON profile.lot_project_client_profile_id = account.lot_project_client_profile_id
      LEFT JOIN documents document_row
        ON document_row.document_id = client_document.document_id
      WHERE client_document.lot_project_client_document_file_url IS NOT NULL
        AND TRIM(client_document.lot_project_client_document_file_url) <> ''
      ORDER BY client_document.lot_project_client_document_id
      ${limit ? 'LIMIT ?' : ''}
    `,
    limit ? [limit] : []
  );

  let migrated = 0;
  for (const row of rows) {
    const entries = parseClientDocumentImages(
      row.lot_project_client_document_file_url,
      row.lot_project_client_document_file_name
    );
    if (!entries.length) continue;

    const folder = buildBuyerDocumentFolder({
      projectStorageCode: resolveProjectStorageCode(row),
      listingStorageCode: resolveListingStorageCode(row),
      accountReference: row.account_reference,
      documentCode: row.document_code,
      documentId: row.document_id,
    });
    const nextEntries = [];
    const workingEntries = [...entries];

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const fileName = normalizedFileName(entry, index);
      const priorStoredName = clean(entry.storedFileName || entry.stored_file_name);
      const fileVersion = priorStoredName ? parseDocumentFileVersionFromName(priorStoredName) : 1;
      const fileSequence = priorStoredName ? parseDocumentFileSequenceFromName(priorStoredName) : index + 1;
      const storedFileName = buildDocumentStoredFileName({
        documentCode: row.document_code,
        accountReference: row.account_reference,
        version: fileVersion,
        sequence: fileSequence,
        totalFiles: entries.length,
        extension: getFileExtension({ fileName, fileType: entry.fileType || entry.file_type }),
      });

      const migration = await migrateAsset({
        entry,
        folder,
        fileName,
        storedFileName,
        label: `${row.account_reference}/${row.document_code || row.document_name || 'document'}`,
      });
      if (!migration) {
        nextEntries.push(entry);
        continue;
      }
      if (!apply) {
        nextEntries.push(entry);
        continue;
      }

      await connection.beginTransaction();
      try {
        const [insertResult] = await connection.query(
          `
            INSERT INTO lot_project_client_document_files (
              lot_project_account_id,
              lot_project_client_document_id,
              cloudinary_asset_id,
              cloudinary_public_id,
              cloudinary_resource_type,
              cloudinary_delivery_type,
              cloudinary_version,
              cloudinary_asset_folder,
              original_file_name,
              stored_file_name,
              file_version,
              file_sequence,
              file_format,
              file_mime_type,
              file_size_bytes,
              file_status,
              uploaded_at
            ) VALUES (?, ?, ?, ?, ?, 'authenticated', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
            ON DUPLICATE KEY UPDATE
              lot_project_client_document_file_id = LAST_INSERT_ID(lot_project_client_document_file_id),
              cloudinary_public_id = VALUES(cloudinary_public_id),
              cloudinary_delivery_type = 'authenticated',
              cloudinary_asset_folder = VALUES(cloudinary_asset_folder),
              stored_file_name = VALUES(stored_file_name),
              file_version = VALUES(file_version),
              file_sequence = VALUES(file_sequence),
              file_status = 'active'
          `,
          [
            row.lot_project_account_id,
            row.lot_project_client_document_id,
            migration.assetId,
            migration.publicId,
            migration.resourceType,
            migration.version,
            migration.assetFolder,
            fileName,
            storedFileName,
            fileVersion,
            fileSequence,
            migration.format || null,
            mimeFromFormat(migration.format, migration.resourceType),
            migration.bytes,
          ]
        );
        const fileId = Number(insertResult.insertId);
        const protectedEntry = buildProtectedEntry({ migration, fileId, fileName, storedFileName, fileVersion, fileSequence, originalEntry: entry });
        nextEntries.push(protectedEntry);
        workingEntries[index] = protectedEntry;
        await connection.query(
          `
            UPDATE lot_project_client_documents
            SET lot_project_client_document_file_url = ?,
                lot_project_client_document_file_name = ?,
                lot_project_client_document_updated_at = NOW()
            WHERE lot_project_client_document_id = ?
          `,
          [
            JSON.stringify(workingEntries),
            workingEntries.length === 1 ? workingEntries[0].fileName : `${workingEntries.length} protected file(s)`,
            row.lot_project_client_document_id,
          ]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
      migrated += 1;
    }

  }
  return { rows: rows.length, migrated };
};

const migrateArchivedDocuments = async (connection) => {
  if (!includeArchives || !(await tableExists(connection, 'lot_project_cancelled_sale_archives'))) {
    return { archives: 0, migrated: 0 };
  }
  if (!(await columnExists(connection, 'lot_project_cancelled_sale_archives', 'lot_project_account_id'))) {
    throw new Error('Run 20260720_account_retention_secure_purge_cloudinary.sql before migrating archive assets.');
  }

  const [documentRows] = await connection.query('SELECT document_id, document_code, document_name FROM documents');
  const documentMeta = new Map(documentRows.map((row) => [Number(row.document_id), { code: row.document_code, name: row.document_name }]));
  const [archives] = await connection.query(
    `
      SELECT
        archive_row.lot_project_cancelled_sale_archive_id,
        archive_row.lot_project_account_id,
        archive_row.client_document_snapshot,
        account.account_reference,
        account.buyer_name_snapshot,
        project.lot_project_id,
        project.lot_project_storage_code,
        project.lot_project_location_code,
        listing.lot_project_listing_id,
        listing.lot_project_listing_storage_code
      FROM lot_project_cancelled_sale_archives archive_row
      INNER JOIN lot_project_accounts account
        ON account.lot_project_account_id = archive_row.lot_project_account_id
      INNER JOIN lot_projects project
        ON project.lot_project_id = account.lot_project_id
      INNER JOIN lot_project_listings listing
        ON listing.lot_project_listing_id = account.lot_project_listing_id
      WHERE archive_row.client_document_snapshot IS NOT NULL
      ORDER BY archive_row.lot_project_cancelled_sale_archive_id
      ${limit ? 'LIMIT ?' : ''}
    `,
    limit ? [limit] : []
  );

  let migrated = 0;
  for (const archive of archives) {
    let documents;
    try {
      documents = Array.isArray(archive.client_document_snapshot)
        ? archive.client_document_snapshot
        : JSON.parse(archive.client_document_snapshot || '[]');
    } catch {
      log('SKIP invalid archive JSON:', archive.lot_project_cancelled_sale_archive_id);
      continue;
    }
    let archiveChanged = false;

    for (const documentRow of documents) {
      const entries = parseClientDocumentImages(
        documentRow.lot_project_client_document_file_url,
        documentRow.lot_project_client_document_file_name
      );
      if (!entries.length) continue;
      const document = documentMeta.get(Number(documentRow.document_id)) || { code: `DOC-${String(Number(documentRow.document_id || 0)).padStart(6, '0')}`, name: `document_${documentRow.document_id || 'archive'}` };
      const documentName = document.name;
      const folder = buildBuyerDocumentFolder({
        projectStorageCode: resolveProjectStorageCode(archive),
        listingStorageCode: resolveListingStorageCode(archive),
        accountReference: archive.account_reference,
        documentCode: document.code,
        documentId: documentRow.document_id,
      });
      const nextEntries = [];

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const fileName = normalizedFileName(entry, index);
        const priorStoredName = clean(entry.storedFileName || entry.stored_file_name);
        const fileVersion = priorStoredName ? parseDocumentFileVersionFromName(priorStoredName) : 1;
        const fileSequence = priorStoredName ? parseDocumentFileSequenceFromName(priorStoredName) : index + 1;
        const storedFileName = buildDocumentStoredFileName({
          documentCode: document.code,
          accountReference: archive.account_reference,
          version: fileVersion,
          sequence: fileSequence,
          totalFiles: entries.length,
          extension: getFileExtension({ fileName, fileType: entry.fileType || entry.file_type }),
        });
        const migration = await migrateAsset({
          entry,
          folder,
          fileName,
          storedFileName,
          label: `${archive.account_reference}/${document.code}/archive`,
        });
        if (!migration || !apply) {
          nextEntries.push(entry);
          continue;
        }
        nextEntries.push(buildProtectedEntry({ migration, fileName, storedFileName, fileVersion, fileSequence, originalEntry: entry }));
        archiveChanged = true;
        migrated += 1;
      }

      if (apply && archiveChanged) {
        documentRow.lot_project_client_document_file_url = JSON.stringify(nextEntries);
        documentRow.lot_project_client_document_file_name = nextEntries.length === 1
          ? nextEntries[0].fileName
          : `${nextEntries.length} protected file(s)`;
      }
    }

    if (apply && archiveChanged) {
      await connection.query(
        `UPDATE lot_project_cancelled_sale_archives SET client_document_snapshot = ?, archived_at = archived_at WHERE lot_project_cancelled_sale_archive_id = ?`,
        [JSON.stringify(documents), archive.lot_project_cancelled_sale_archive_id]
      );
    }
  }
  return { archives: archives.length, migrated };
};

const migratePaymentProofs = async (connection) => {
  if (!(await tableExists(connection, 'lot_project_payment_proofs'))) return { rows: 0, migrated: 0 };

  const [rows] = await connection.query(`
    SELECT
      proof.*,
      payment.lot_project_payment_storage_code,
      payment.lot_project_payment_created_at,
      account.account_reference,
      project.lot_project_id,
      project.lot_project_storage_code,
      project.lot_project_location_code,
      listing.lot_project_listing_id,
      listing.lot_project_listing_storage_code
    FROM lot_project_payment_proofs proof
    INNER JOIN lot_project_payments payment
      ON payment.lot_project_payment_id = proof.lot_project_payment_id
    INNER JOIN lot_projects project
      ON project.lot_project_id = proof.lot_project_id
    INNER JOIN lot_project_listings listing
      ON listing.lot_project_listing_id = proof.lot_project_listing_id
    LEFT JOIN lot_project_accounts account
      ON account.lot_project_account_id = proof.lot_project_account_id
    WHERE proof.proof_status = 'active'
    ORDER BY proof.lot_project_payment_id, proof.lot_project_payment_proof_id
    ${limit ? 'LIMIT ?' : ''}
  `, limit ? [limit] : []);

  const nextSequenceByPayment = new Map();
  let migrated = 0;
  for (const row of rows) {
    const paymentStorageCode = resolvePaymentStorageCode(row);
    const currentKey = Number(row.lot_project_payment_id);
    const fallbackSequence = (nextSequenceByPayment.get(currentKey) || 0) + 1;
    const priorStoredName = clean(row.stored_file_name);
    const sequence = Number(row.proof_sequence || 0)
      || (priorStoredName ? parsePaymentProofSequenceFromName(priorStoredName) : fallbackSequence);
    nextSequenceByPayment.set(currentKey, Math.max(fallbackSequence, sequence));
    const storedFileName = buildPaymentProofStoredFileName({
      paymentStorageCode,
      sequence,
      extension: getFileExtension({ fileName: row.file_name, fileType: row.file_mime_type }),
    });
    const folder = buildPaymentProofFolder({
      projectStorageCode: resolveProjectStorageCode(row),
      listingStorageCode: resolveListingStorageCode(row),
      accountReference: row.account_reference || `ACC-${String(Number(row.lot_project_account_id || 0)).padStart(6, '0')}`,
      paymentStorageCode,
      paymentId: row.lot_project_payment_id,
    });
    const entry = {
      cloudinaryPublicId: row.cloudinary_public_id,
      cloudinaryResourceType: row.cloudinary_resource_type,
      cloudinaryDeliveryType: row.cloudinary_delivery_type,
      cloudinaryAssetFolder: row.cloudinary_asset_folder,
      cloudinaryAssetId: row.cloudinary_asset_id,
      cloudinaryVersion: row.cloudinary_version,
      fileName: row.file_name,
      fileType: row.file_mime_type,
      fileSize: row.file_size_bytes,
      format: row.cloudinary_format,
    };
    const migration = await migrateAsset({
      entry,
      folder,
      fileName: row.file_name,
      storedFileName,
      label: `${paymentStorageCode}/proof-${sequence}`,
      assetKind: 'payment_proof',
    });
    if (!migration || !apply) continue;

    await connection.query(`
      UPDATE lot_project_payment_proofs
      SET cloudinary_asset_id = ?,
          cloudinary_public_id = ?,
          cloudinary_resource_type = ?,
          cloudinary_delivery_type = 'authenticated',
          cloudinary_version = ?,
          cloudinary_asset_folder = ?,
          cloudinary_format = ?,
          stored_file_name = ?,
          proof_sequence = ?,
          updated_at = NOW()
      WHERE lot_project_payment_proof_id = ?
    `, [
      migration.assetId,
      migration.publicId,
      migration.resourceType,
      migration.version,
      migration.assetFolder,
      migration.format || null,
      storedFileName,
      sequence,
      row.lot_project_payment_proof_id,
    ]);
    migrated += 1;
  }

  return { rows: rows.length, migrated };
};

const main = async () => {
  const connection = await db.getConnection();
  try {
    configureSecureCloudinary();
    for (const tableName of ['lot_project_accounts', 'lot_project_client_document_files']) {
      if (!(await tableExists(connection, tableName))) {
        throw new Error(`${tableName} is missing. Run 20260720_account_retention_secure_purge_cloudinary.sql first.`);
      }
    }
    for (const [tableName, columnName] of [
      ['documents', 'document_code'],
      ['lot_projects', 'lot_project_storage_code'],
      ['lot_project_listings', 'lot_project_listing_storage_code'],
      ['lot_project_payments', 'lot_project_payment_storage_code'],
      ['lot_project_client_document_files', 'file_version'],
    ]) {
      if (!(await columnExists(connection, tableName, columnName))) {
        throw new Error(`Missing ${tableName}.${columnName}. Run 20260810_storage_codes_and_canonical_file_names.sql first.`);
      }
    }

    log(apply ? 'APPLY MODE: Cloudinary assets and database rows will change.' : 'DRY RUN: no Cloudinary or database changes will be made.');
    const live = await migrateLiveDocuments(connection);
    const archives = await migrateArchivedDocuments(connection);
    const paymentProofs = await migratePaymentProofs(connection);
    log('Complete.', { live, archives, paymentProofs, apply, includeArchives, limit });
  } finally {
    connection.release();
    await db.end();
  }
};

main().catch((error) => {
  console.error('[cloudinary-document-migration] FAILED:', error?.stack || error?.message || error);
  process.exitCode = 1;
});



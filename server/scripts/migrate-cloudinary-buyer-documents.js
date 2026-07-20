import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';

import { db } from '../db/connect.js';
import {
  parseClientDocumentImages,
  tableExists,
  columnExists,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';
import {
  buildBuyerDocumentFolder,
  configureSecureCloudinary,
  sanitizeCloudinarySegment,
  verifyAuthenticatedCloudinaryAsset,
} from '../services/secureCloudinary.service.js';
import {
  getCloudinaryPublicIdFromUrl,
  getCloudinaryResourceType,
} from '../services/cloudinaryUnitFolder.service.js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const includeArchives = !args.has('--skip-archives');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1] || 0)) : null;

const clean = (value) => String(value ?? '').trim();
const log = (...values) => console.log('[cloudinary-document-migration]', ...values);

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

const migrateAsset = async ({ entry, folder, fileName, label }) => {
  const resourceType = getCloudinaryResourceType(entry);
  const sourcePublicId = getSourcePublicId(entry);
  const sourceDeliveryType = deliveryTypeFromEntry(entry);
  if (!sourcePublicId) {
    log('SKIP missing public ID:', label, fileName);
    return null;
  }

  const alreadyProtected = sourceDeliveryType === 'authenticated'
    && clean(entry.cloudinaryAssetFolder || entry.cloudinary_asset_folder || entry.asset_folder) === folder;

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
    targetPublicId = crypto.randomUUID();
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
      tags: ['dc_prime', 'buyer_document', 'authenticated', 'migrated'],
      context: `migration=buyer_account_documents|original_name=${encodeURIComponent(fileName.slice(0, 180))}`,
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

const buildProtectedEntry = ({ migration, fileId = null, fileName, originalEntry = {} }) => ({
  url: fileId ? `protected://document-file/${fileId}` : `protected://cloudinary/${migration.publicId}`,
  fileId: fileId || undefined,
  accessPath: fileId ? `/document-files/${fileId}/access-url` : undefined,
  fileName,
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
        project.lot_project_slug,
        listing.lot_project_listing_id,
        listing.lot_project_listing_unit_id,
        profile.buyer_full_name,
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
      projectSlug: row.lot_project_slug,
      listingId: row.lot_project_listing_id,
      unitId: row.lot_project_listing_unit_id,
      accountReference: row.account_reference,
      buyerName: row.buyer_full_name || row.buyer_name_snapshot,
      documentName: row.document_name || 'document',
    });
    const nextEntries = [];
    const workingEntries = [...entries];

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const fileName = normalizedFileName(entry, index);
      if (entry.fileId && entry.protected) {
        nextEntries.push(entry);
        continue;
      }

      const migration = await migrateAsset({
        entry,
        folder,
        fileName,
        label: `${row.account_reference}/${row.document_name || 'document'}`,
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
              file_format,
              file_mime_type,
              file_size_bytes,
              file_status,
              uploaded_at
            ) VALUES (?, ?, ?, ?, ?, 'authenticated', ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
            ON DUPLICATE KEY UPDATE
              lot_project_client_document_file_id = LAST_INSERT_ID(lot_project_client_document_file_id),
              cloudinary_public_id = VALUES(cloudinary_public_id),
              cloudinary_delivery_type = 'authenticated',
              cloudinary_asset_folder = VALUES(cloudinary_asset_folder),
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
            migration.publicId,
            migration.format || null,
            mimeFromFormat(migration.format, migration.resourceType),
            migration.bytes,
          ]
        );
        const fileId = Number(insertResult.insertId);
        const protectedEntry = buildProtectedEntry({ migration, fileId, fileName, originalEntry: entry });
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

  const [documentRows] = await connection.query('SELECT document_id, document_name FROM documents');
  const documentNames = new Map(documentRows.map((row) => [Number(row.document_id), row.document_name]));
  const [archives] = await connection.query(
    `
      SELECT
        archive_row.lot_project_cancelled_sale_archive_id,
        archive_row.lot_project_account_id,
        archive_row.client_document_snapshot,
        account.account_reference,
        account.buyer_name_snapshot,
        project.lot_project_slug,
        listing.lot_project_listing_id,
        listing.lot_project_listing_unit_id
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
      const documentName = documentNames.get(Number(documentRow.document_id)) || `document_${documentRow.document_id || 'archive'}`;
      const folder = buildBuyerDocumentFolder({
        projectSlug: archive.lot_project_slug,
        listingId: archive.lot_project_listing_id,
        unitId: archive.lot_project_listing_unit_id,
        accountReference: archive.account_reference,
        buyerName: archive.buyer_name_snapshot,
        documentName,
      });
      const nextEntries = [];

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const fileName = normalizedFileName(entry, index);
        if (entry.protected && deliveryTypeFromEntry(entry) === 'authenticated') {
          nextEntries.push(entry);
          continue;
        }
        const migration = await migrateAsset({
          entry,
          folder,
          fileName,
          label: `${archive.account_reference}/${documentName}/archive`,
        });
        if (!migration || !apply) {
          nextEntries.push(entry);
          continue;
        }
        nextEntries.push(buildProtectedEntry({ migration, fileName, originalEntry: entry }));
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

const main = async () => {
  const connection = await db.getConnection();
  try {
    configureSecureCloudinary();
    for (const tableName of ['lot_project_accounts', 'lot_project_client_document_files']) {
      if (!(await tableExists(connection, tableName))) {
        throw new Error(`${tableName} is missing. Run 20260720_account_retention_secure_purge_cloudinary.sql first.`);
      }
    }

    log(apply ? 'APPLY MODE: Cloudinary assets and database rows will change.' : 'DRY RUN: no Cloudinary or database changes will be made.');
    const live = await migrateLiveDocuments(connection);
    const archives = await migrateArchivedDocuments(connection);
    log('Complete.', { live, archives, apply, includeArchives, limit });
  } finally {
    connection.release();
    await db.end();
  }
};

main().catch((error) => {
  console.error('[cloudinary-document-migration] FAILED:', error?.stack || error?.message || error);
  process.exitCode = 1;
});

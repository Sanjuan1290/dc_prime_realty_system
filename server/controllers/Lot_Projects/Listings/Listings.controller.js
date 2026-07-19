import {
  db,
  getErrorMessage,
  slugify,
  toNullable,
  toNullableNumber,
  toActiveStatus,
  tableExists,
  columnExists,
  money,
  plainDate,
  formatDateTime,
  toDisplayValue,
  safeDeleteByProjectId,
  normalizeProjectPayload,
  getListingStatusLabel,
  normalizeLotType,
  lotTypeLabel,
  normalizeListingStatusPayload,
  formatDocumentsLabel,
  mapListingRow,
  mapProjectRows,
  getProjectBySlug,
  getProjectDefaultDocuments,
  getProjectCadastralLots,
  getListingLookupWhere,
  computeAgeFromDate,
  getClientCompletionStatus,
  mapClientProfile,
  canEditBuyerProfileForListing,
  mapProfileListing,
  getListingDocuments,
  roundMoneyValue,
  normalizeDateInput,
  addMonthsToDate,
  getOrdinalLabel,
  getScheduleTotalDue,
  appendPaymentReference,
  getPaymentAmountValue,
  createBalloonPrincipalRow,
  getRowSortOrder,
  sortComputedRows,
  getComputedSoaTerms,
  createComputedSoaRows,
  getPaymentTargetRows,
  allocatePaymentsToComputedRows,
  recomputeComputedSoaBalances,
  getExistingSoaScheduleRows,
  canGenerateListingSoa,
  getListingSoaRows,
  getRequestToken,
  getAuthenticatedUser,
  getUserFullName,
  getListingForPayment,
  normalizePaymentType,
  getPaymentTypeLabel,
  normalizePaymentMethod,
  getNextCashReference,
  mapPaymentRow,
  getListingPayments,
  recomputeListingScheduleBalances,
  applyPaymentToSchedules,
  reversePaymentAllocations,
  getPaymentById,
  dateOrNull,
  parseMoneyValue,
  cleanBuyerType,
  cleanSecondBuyerRole,
  addIfColumnExists,
  parseClientDocumentImages,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import { LISTING_STATUS_ACTIONS, validateListingStatusTransition } from './listingStatusTransitions.js';
import { calculateContractPricing } from '../_shared/listingPricing.js';
import {
  hasBuyerFormSchema,
  resetBuyerFormsForAvailable,
  revokeOpenBuyerFormLinks,
} from '../BuyerForms/buyerForm.shared.js';
import {
  applyCloudinaryMoveToEntry,
  deleteCloudinaryEmptyFolder,
  buildCloudinaryUnitAssetMove,
  getCloudinaryFolderCleanupPaths,
  moveCloudinaryDynamicAssetFolder,
  renameCloudinaryAsset,
} from '../../../services/cloudinaryUnitFolder.service.js';

export const getLotProjectListings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || 'all');

    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ message: 'Lot project not found.' });
    }

    const hasListings = await tableExists(connection, 'lot_project_listings');
    const hasListingDocuments = await tableExists(connection, 'lot_project_listing_documents');
    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');
    const cadastralLots = await getProjectCadastralLots(project.lot_project_id);
    const defaultDocuments = await getProjectDefaultDocuments(project.lot_project_id);

    if (!hasListings) {
      return res.json({
        success: true,
        data: [],
        overview: { total: 0, available: 0, sold: 0, hold: 0 },
        project: {
          ...project,
          id: project.lot_project_id,
          name: project.lot_project_name,
          locationCode: project.lot_project_location_code,
          cadastralLots,
          defaultDocuments,
        },
      });
    }

    const where = ['l.lot_project_id = ?'];
    const params = [project.lot_project_id];

    if (search) {
      where.push(`(
        l.lot_project_listing_unit_id LIKE ? OR
        IFNULL(l.lot_project_listing_old_unit_ids, '') LIKE ? OR
        IFNULL(cp.buyer_full_name, '') LIKE ? OR
        IFNULL(l.lot_project_listing_unit_type, '') LIKE ?
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    if (status !== 'all') {
      if (status === 'fully_paid') {
        where.push(`l.lot_project_listing_status = 'sold' AND l.lot_project_listing_sold_substatus = 'fully_paid'`);
      } else if (status === 'sold') {
        where.push(`l.lot_project_listing_status = 'sold'`);
      } else {
        where.push('l.lot_project_listing_status = ?');
        params.push(status);
      }
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const cadastralSelect = hasListingCadastralLinks
      ? `(
          SELECT GROUP_CONCAT(c.lot_project_cadastral_lot_number ORDER BY c.lot_project_cadastral_lot_number SEPARATOR ', ')
          FROM lot_project_listing_cadastral_lots lcl
          INNER JOIN lot_project_cadastral_lot_numbers c
            ON c.lot_project_cadastral_lot_number_id = lcl.lot_project_cadastral_lot_number_id
          WHERE lcl.lot_project_listing_id = l.lot_project_listing_id
        ) AS cadastral_lots,`
      : `NULL AS cadastral_lots,`;

    const listingDocumentJoin = hasListingDocuments
      ? `
          LEFT JOIN (
            SELECT lot_project_listing_id, COUNT(*) AS listing_document_count
            FROM lot_project_listing_documents
            WHERE lot_project_listing_document_status = 'active'
            GROUP BY lot_project_listing_id
          ) ldoc ON ldoc.lot_project_listing_id = l.lot_project_listing_id
        `
      : `LEFT JOIN (SELECT NULL AS lot_project_listing_id, 0 AS listing_document_count) ldoc ON 1 = 0`;

    const [rows] = await connection.query(
      `
        SELECT
          l.*,
          ${cadastralSelect}
          cp.buyer_full_name,
          COALESCE(ldoc.listing_document_count, 0) AS listing_document_count,
          COALESCE(pdoc.project_default_document_count, 0) AS project_default_document_count,
          COALESCE(pdoc.project_required_document_count, 0) AS project_required_document_count
        FROM lot_project_listings l
        LEFT JOIN lot_project_client_profiles cp
          ON cp.lot_project_listing_id = l.lot_project_listing_id
        ${listingDocumentJoin}
        LEFT JOIN (
          SELECT
            lot_project_id,
            COUNT(*) AS project_default_document_count,
            SUM(lot_project_default_document_is_required = 1) AS project_required_document_count
          FROM lot_project_default_documents
          WHERE lot_project_default_document_status = 'active'
          GROUP BY lot_project_id
        ) pdoc ON pdoc.lot_project_id = l.lot_project_id
        ${whereSql}
        ORDER BY l.lot_project_listing_created_at DESC, l.lot_project_listing_id DESC
      `,
      params
    );

    const [overviewRows] = await connection.query(
      `
        SELECT
          COUNT(*) AS total,
          SUM(lot_project_listing_status = 'available') AS available,
          SUM(lot_project_listing_status = 'sold') AS sold,
          SUM(lot_project_listing_status = 'hold') AS hold
        FROM lot_project_listings
        WHERE lot_project_id = ?
      `,
      [project.lot_project_id]
    );

    const overview = overviewRows[0] || {};

    return res.json({
      success: true,
      data: rows.map(mapListingRow),
      overview: {
        total: Number(overview.total || 0),
        available: Number(overview.available || 0),
        sold: Number(overview.sold || 0),
        hold: Number(overview.hold || 0),
      },
      project: {
        ...project,
        id: project.lot_project_id,
        name: project.lot_project_name,
        location: project.lot_project_location,
        locationCode: project.lot_project_location_code,
        cadastralLots,
        defaultDocuments,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};




const replaceListingSchedulesForProfile = async (connection, projectId, listingRow) => {
  if (!(await tableExists(connection, 'lot_project_payment_schedules'))) return;

  const terms = getComputedSoaTerms(listingRow, []);
  const computedRows = recomputeComputedSoaBalances(createComputedSoaRows(terms), terms);

  await connection.query(
    `DELETE FROM lot_project_payment_schedules WHERE lot_project_listing_id = ?`,
    [listingRow.lot_project_listing_id]
  );

  if (!computedRows.length) return;

  const baseColumns = [
    'lot_project_id',
    'lot_project_listing_id',
    'lot_project_client_profile_id',
    'due_date',
    'description',
    'beginning_balance',
    'due_amount',
    'penalty_amount',
    'amount_paid',
    'date_paid',
    'reference_id',
    'ending_balance',
    'schedule_status',
  ];
  const optionalColumns = [];
  const addOptionalColumn = async (column) => {
    if (await columnExists(connection, 'lot_project_payment_schedules', column)) optionalColumns.push(column);
  };

  await addOptionalColumn('interest_amount');
  await addOptionalColumn('principal_amount');
  await addOptionalColumn('monthly_amortization_amount');
  await addOptionalColumn('paid_interest_amount');
  await addOptionalColumn('paid_principal_amount');
  await addOptionalColumn('paid_penalty_amount');

  const columns = [...baseColumns, ...optionalColumns, 'created_at', 'updated_at'];
  const values = computedRows.flatMap((row) => {
    const baseValues = [
      projectId,
      listingRow.lot_project_listing_id,
      listingRow.lot_project_client_profile_id,
      row.dueDate,
      row.description,
      roundMoneyValue(row.beginningBalance || 0),
      roundMoneyValue(row.dueAmount || 0),
      roundMoneyValue(row.penalty || 0),
      roundMoneyValue(row.amountPaid || 0),
      row.datePaid && row.datePaid !== '-' ? row.datePaid : null,
      row.referenceId && row.referenceId !== '-' ? row.referenceId : null,
      roundMoneyValue(row.endingBalance || 0),
      row.status || 'Unpaid',
    ];
    const optionalValues = optionalColumns.map((column) => {
      if (column === 'interest_amount') return roundMoneyValue(row.interest || 0);
      if (column === 'principal_amount') return roundMoneyValue(row.principalAmount || 0);
      if (column === 'monthly_amortization_amount') return roundMoneyValue(row.monthlyAmortizationAmount || row.dueAmount || 0);
      if (column === 'paid_interest_amount') return roundMoneyValue(row.paidInterestAmount || 0);
      if (column === 'paid_principal_amount') return roundMoneyValue(row.paidPrincipalAmount || 0);
      if (column === 'paid_penalty_amount') return roundMoneyValue(row.paidPenaltyAmount || 0);
      return 0;
    });

    return [...baseValues, ...optionalValues];
  });

  await connection.query(
    `
      INSERT INTO lot_project_payment_schedules (
        ${columns.join(',\n        ')}
      ) VALUES ${computedRows.map(() => `(${columns.map((column) => column === 'created_at' || column === 'updated_at' ? 'NOW()' : '?').join(', ')})`).join(', ')}
    `,
    values
  );
};


const clearListingSaleDataForAvailable = async (connection, listingId) => {
  if (await tableExists(connection, 'lot_project_payment_allocations')) {
    await connection.query(
      `
        DELETE pa
        FROM lot_project_payment_allocations pa
        LEFT JOIN lot_project_payments p
          ON p.lot_project_payment_id = pa.lot_project_payment_id
        LEFT JOIN lot_project_payment_schedules ps
          ON ps.lot_project_payment_schedule_id = pa.lot_project_payment_schedule_id
        WHERE p.lot_project_listing_id = ?
           OR ps.lot_project_listing_id = ?
      `,
      [listingId, listingId]
    );
  }

  if (
    (await tableExists(connection, 'lot_project_commission_releases')) &&
    (await tableExists(connection, 'lot_project_commissions'))
  ) {
    await connection.query(
      `
        DELETE cr
        FROM lot_project_commission_releases cr
        INNER JOIN lot_project_commissions c
          ON c.lot_project_commission_id = cr.lot_project_commission_id
        WHERE c.lot_project_listing_id = ?
      `,
      [listingId]
    );
  }

  const childTables = [
    'lot_project_commissions',
    'lot_project_payments',
    'lot_project_payment_schedules',
    'lot_project_client_documents',
  ];

  for (const tableName of childTables) {
    if (await tableExists(connection, tableName)) {
      await connection.query(
        `DELETE FROM ${tableName} WHERE lot_project_listing_id = ?`,
        [listingId]
      );
    }
  }

  if (await tableExists(connection, 'lot_project_client_profiles')) {
    await connection.query(
      `DELETE FROM lot_project_client_profiles WHERE lot_project_listing_id = ?`,
      [listingId]
    );
  }

  if (await hasBuyerFormSchema(connection)) {
    await resetBuyerFormsForAvailable(connection, listingId);
  }
};

const syncListingInterestToUnlockedSoa = async (connection, projectId, listingId, annualInterestRate) => {
  if (!(await tableExists(connection, 'lot_project_client_profiles'))) return { synced: 0, skipped: 0 };

  const hasOverrideColumn = await columnExists(connection, 'lot_project_client_profiles', 'soa_interest_rate_overridden');
  const [profileRows] = await connection.query(
    `
      SELECT l.*, cp.*
      FROM lot_project_listings l
      INNER JOIN lot_project_client_profiles cp
        ON cp.lot_project_listing_id = l.lot_project_listing_id
      WHERE l.lot_project_id = ?
        AND l.lot_project_listing_id = ?
    `,
    [projectId, listingId]
  );

  let synced = 0;
  let skipped = 0;

  for (const profile of profileRows) {
    if (hasOverrideColumn && Number(profile.soa_interest_rate_overridden || 0) === 1) {
      skipped += 1;
      continue;
    }

    const paymentCount = await tableExists(connection, 'lot_project_payments')
      ? (await connection.query(
          `
            SELECT COUNT(*) AS total
            FROM lot_project_payments
            WHERE lot_project_id = ?
              AND lot_project_listing_id = ?
              AND lot_project_payment_status <> 'Cancelled'
          `,
          [projectId, listingId]
        ))[0][0]?.total
      : 0;

    if (Number(paymentCount || 0) > 0) {
      skipped += 1;
      continue;
    }

    const updateColumns = [];
    const updateParams = [];
    if (await columnExists(connection, 'lot_project_client_profiles', 'soa_annual_interest_rate')) {
      updateColumns.push('soa_annual_interest_rate = ?');
      updateParams.push(annualInterestRate);
    }
    if (hasOverrideColumn) {
      updateColumns.push('soa_interest_rate_overridden = 0');
    }
    if (updateColumns.length) {
      await connection.query(
        `
          UPDATE lot_project_client_profiles
          SET ${updateColumns.join(', ')}
          WHERE lot_project_client_profile_id = ?
        `,
        [...updateParams, profile.lot_project_client_profile_id]
      );
    }

    await replaceListingSchedulesForProfile(connection, projectId, {
      ...profile,
      annual_interest_rate: annualInterestRate,
      soa_annual_interest_rate: annualInterestRate,
      soa_interest_rate_overridden: 0,
    });

    synced += 1;
  }

  return { synced, skipped };
};


/**
 * Keeps every uploaded client document under the listing's current Unit ID.
 * Cloudinary assets are renamed first, then the stored JSON metadata is updated
 * inside the listing transaction. The completedMoves array is used as a
 * compensation log if a later database operation fails.
 */
const syncListingDocumentCloudinaryUnitFolder = async (
  connection,
  listingId,
  previousUnitId,
  targetUnitId,
  completedMoves
) => {
  if (!(await tableExists(connection, 'lot_project_client_documents'))) {
    return { movedAssets: 0, updatedDocumentRows: 0, repairedMetadata: 0 };
  }

  const [documentRows] = await connection.query(
    `
      SELECT
        lot_project_client_document_id,
        lot_project_client_document_file_name,
        lot_project_client_document_file_url
      FROM lot_project_client_documents
      WHERE lot_project_listing_id = ?
        AND lot_project_client_document_file_url IS NOT NULL
        AND TRIM(lot_project_client_document_file_url) <> ''
      FOR UPDATE
    `,
    [listingId]
  );

  let movedAssets = 0;
  let updatedDocumentRows = 0;
  let repairedMetadata = 0;
  const cleanupFolderPaths = new Set();

  for (const documentRow of documentRows) {
    const entries = parseClientDocumentImages(
      documentRow.lot_project_client_document_file_url,
      documentRow.lot_project_client_document_file_name
    );

    if (!entries.length) continue;

    const nextEntries = [...entries];
    let rowChanged = false;

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const move = buildCloudinaryUnitAssetMove(entry, targetUnitId, previousUnitId);
      if (!move) continue;

      if (move.fromFolder && move.toFolder && move.fromFolder !== move.toFolder) {
        getCloudinaryFolderCleanupPaths(move.fromFolder).forEach((folderPath) => {
          if (folderPath) cleanupFolderPaths.add(folderPath);
        });
      }

      let renameResult = {};
      let folderResult = null;
      let completedMove = null;

      if (move.needsRename) {
        renameResult = await renameCloudinaryAsset({
          fromPublicId: move.fromPublicId,
          toPublicId: move.toPublicId,
          resourceType: move.resourceType,
          overwrite: false,
          invalidate: true,
        });

        completedMove = {
          ...move,
          currentPublicId: renameResult.public_id || move.toPublicId,
          dynamicFolderMoved: false,
        };
        completedMoves.push(completedMove);
        movedAssets += 1;
      }

      const hasDynamicFolderMetadata = Boolean(
        renameResult.asset_folder !== undefined
          || entry.cloudinaryAssetFolder
          || entry.cloudinary_asset_folder
          || entry.asset_folder
          // In dynamic-folder mode the public ID may not contain the folder,
          // leaving only folder metadata to move for older uploads.
          || !move.needsRename
      );

      if (hasDynamicFolderMetadata && move.toFolder && move.toFolder !== move.fromFolder) {
        folderResult = await moveCloudinaryDynamicAssetFolder({
          publicId: renameResult.public_id || move.toPublicId,
          assetFolder: move.toFolder,
          resourceType: move.resourceType,
        });

        if (!completedMove) {
          completedMove = {
            ...move,
            currentPublicId: move.toPublicId,
            dynamicFolderMoved: true,
          };
          completedMoves.push(completedMove);
        } else {
          completedMove.dynamicFolderMoved = true;
        }
      }

      nextEntries[index] = applyCloudinaryMoveToEntry(entry, move, renameResult, folderResult);
      rowChanged = true;
      if (!move.needsRename) repairedMetadata += 1;
    }

    if (!rowChanged) continue;

    await connection.query(
      `
        UPDATE lot_project_client_documents
        SET lot_project_client_document_file_url = ?,
            lot_project_client_document_updated_at = NOW()
        WHERE lot_project_client_document_id = ?
      `,
      [JSON.stringify(nextEntries), documentRow.lot_project_client_document_id]
    );
    updatedDocumentRows += 1;
  }

  let deletedFolders = 0;
  const cleanupWarnings = [];

  // Cloudinary folders are separate objects. Remove empty legacy paths from
  // deepest to shallowest so the old Unit ID folder does not remain visible.
  const orderedCleanupPaths = [...cleanupFolderPaths]
    .sort((left, right) => right.split('/').length - left.split('/').length);

  for (const folderPath of orderedCleanupPaths) {
    try {
      const cleanupResult = await deleteCloudinaryEmptyFolder({ folder: folderPath, skipBackup: true });
      if (cleanupResult.deleted) deletedFolders += 1;
      if (cleanupResult.reason === 'not_empty') {
        cleanupWarnings.push(`${folderPath} still contains an untracked asset or subfolder.`);
      }
    } catch (cleanupError) {
      cleanupWarnings.push(`${folderPath}: ${cleanupError?.message || 'Folder cleanup failed.'}`);
    }
  }

  return {
    movedAssets,
    updatedDocumentRows,
    repairedMetadata,
    deletedFolders,
    cleanupWarnings,
  };
};

/**
 * External Cloudinary changes cannot be rolled back by MySQL, so reverse every
 * completed asset move when the listing transaction fails.
 */
const rollbackListingDocumentCloudinaryMoves = async (completedMoves = []) => {
  const failures = [];

  for (const move of [...completedMoves].reverse()) {
    try {
      if (move.needsRename) {
        await renameCloudinaryAsset({
          fromPublicId: move.currentPublicId || move.toPublicId,
          toPublicId: move.fromPublicId,
          resourceType: move.resourceType,
          overwrite: false,
          invalidate: true,
        });
      }

      if (move.dynamicFolderMoved && move.fromFolder) {
        await moveCloudinaryDynamicAssetFolder({
          publicId: move.needsRename ? move.fromPublicId : move.currentPublicId,
          assetFolder: move.fromFolder,
          resourceType: move.resourceType,
        });
      }
    } catch (rollbackError) {
      failures.push({
        fromPublicId: move.currentPublicId || move.toPublicId,
        toPublicId: move.fromPublicId,
        message: rollbackError?.message || 'Cloudinary rollback failed.',
      });
    }
  }

  return failures;
};

export const updateLotProjectListing = async (req, res) => {
  const connection = await db.getConnection();
  const completedCloudinaryMoves = [];

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });

    const unitCode = String(req.body.unitCode || req.body.unit_id || '').trim().toUpperCase();
    const legacyPricePerSqm = Number(req.body.pricePerSqm ?? req.body.price_per_sqm ?? 0);
    const installmentPricePerSqm = Number(
      req.body.installmentPricePerSqm ??
        req.body.installment_price_per_sqm ??
        legacyPricePerSqm
    );
    const cashPricePerSqm = Number(
      req.body.cashPricePerSqm ??
        req.body.cash_price_per_sqm ??
        installmentPricePerSqm
    );
    const lotAreaSqm = Number(req.body.lotAreaSqm ?? req.body.area ?? 0);
    const legalMiscRate = Number(req.body.legalMiscRate ?? req.body.lmfRate ?? 0);
    const reservationFee = Number(req.body.reservationFee ?? 0);
    const annualInterestRate = Number(req.body.annualInterestRate ?? 0);
    const listingStatus = normalizeListingStatusPayload(req.body.status || req.body.rawStatus || req.body.listing_status);

    if (!unitCode) return res.status(400).json({ message: 'Unit ID is required.' });
    if (!unitCode.startsWith(`${project.lot_project_location_code}-`)) {
      return res.status(400).json({ message: `Unit ID must start with ${project.lot_project_location_code}-.` });
    }
    if (installmentPricePerSqm <= 0) return res.status(400).json({ message: 'Installment price per SQM must be greater than 0.' });
    if (cashPricePerSqm <= 0) return res.status(400).json({ message: 'Cash price per SQM must be greater than 0.' });
    if (lotAreaSqm <= 0) return res.status(400).json({ message: 'Lot area SQM must be greater than 0.' });

    const lookup = getListingLookupWhere(listingLookup);
    const installmentPricing = calculateContractPricing({
      lotAreaSqm,
      pricePerSqm: installmentPricePerSqm,
      legalMiscRate,
    });
    const hasInstallmentPriceColumn = await columnExists(
      connection,
      'lot_project_listings',
      'lot_project_listing_installment_price_per_sqm'
    );
    const hasCashPriceColumn = await columnExists(
      connection,
      'lot_project_listings',
      'lot_project_listing_cash_price_per_sqm'
    );
    if (!hasInstallmentPriceColumn || !hasCashPriceColumn) {
      return res.status(500).json({
        message: 'Dual listing pricing migration is missing. Run server/migrations/20260719_dual_listing_pricing_and_contract_snapshots.sql.',
      });
    }
    const hasAnnualInterestRate = await columnExists(connection, 'lot_project_listings', 'annual_interest_rate');
    const hasCancellationType = await columnExists(connection, 'lot_project_listings', 'lot_project_listing_cancellation_type');
    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');
    const hasReservationHistory = await tableExists(connection, 'lot_project_reservation_history');

    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
        SELECT
          lot_project_listing_id,
          lot_project_listing_status,
          lot_project_listing_unit_id,
          lot_project_listing_tcp,
          (
            SELECT cp.soa_selected_tcp
            FROM lot_project_client_profiles cp
            WHERE cp.lot_project_listing_id = l.lot_project_listing_id
            LIMIT 1
          ) AS contract_tcp,
          lot_project_listing_cancellation_type
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
        FOR UPDATE
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const existingListing = existingRows[0];
    if (!existingListing) {
      await connection.rollback();
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const statusTransition = validateListingStatusTransition({
      currentStatus: existingListing.lot_project_listing_status,
      nextStatus: listingStatus.status,
      action: req.body.statusTransitionAction,
      confirmSaleDataDeletion: req.body.confirmSaleDataDeletion === true,
    });

    const [duplicateUnitRows] = await connection.query(
      `
        SELECT lot_project_listing_id
        FROM lot_project_listings
        WHERE lot_project_id = ?
          AND lot_project_listing_unit_id = ?
          AND lot_project_listing_id <> ?
        LIMIT 1
      `,
      [project.lot_project_id, unitCode, existingListing.lot_project_listing_id]
    );

    if (duplicateUnitRows.length) {
      await connection.rollback();
      return res.status(409).json({ message: `${unitCode} already exists in ${project.lot_project_name}.` });
    }

    const cloudinarySyncResult = await syncListingDocumentCloudinaryUnitFolder(
      connection,
      existingListing.lot_project_listing_id,
      existingListing.lot_project_listing_unit_id,
      unitCode,
      completedCloudinaryMoves
    );

    const updateColumns = [
      'lot_project_listing_unit_type = ?',
      'lot_project_listing_unit_id = ?',
      'lot_project_listing_old_unit_ids = ?',
      'lot_project_listing_area_sqm = ?',
      'lot_project_listing_price_per_sqm = ?',
      'lot_project_listing_installment_price_per_sqm = ?',
      'lot_project_listing_cash_price_per_sqm = ?',
      'lot_project_listing_net_selling_price = ?',
      'lot_project_listing_lmf_rate = ?',
      'lot_project_listing_lmf_amount = ?',
      'lot_project_listing_tcp = ?',
      'lot_project_listing_reservation_fee = ?',
      'lot_project_listing_status = ?',
      'lot_project_listing_sold_substatus = ?',
    ];

    const updateParams = [
      normalizeLotType(req.body.lotType || req.body.lot_type),
      unitCode,
      toNullable(req.body.oldUnitIds || req.body.old_unit_ids),
      lotAreaSqm,
      installmentPricePerSqm,
      installmentPricePerSqm,
      cashPricePerSqm,
      installmentPricing.netSellingPrice,
      legalMiscRate,
      installmentPricing.lmfAmount,
      installmentPricing.tcp,
      reservationFee,
      listingStatus.status,
      listingStatus.soldSubstatus,
    ];

    if (hasAnnualInterestRate) {
      updateColumns.push('annual_interest_rate = ?');
      updateParams.push(annualInterestRate);
    }

    const requestedCancellationType = ['refunded', 'discontinued'].includes(
      String(req.body.cancellationType || req.body.cancellation_type || '').trim().toLowerCase()
    )
      ? String(req.body.cancellationType || req.body.cancellation_type).trim().toLowerCase()
      : (existingListing.lot_project_listing_cancellation_type || 'discontinued');

    if (hasCancellationType) {
      if (req.body.statusTransitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION) {
        updateColumns.push('lot_project_listing_cancellation_type = NULL');
      } else if (
        listingStatus.status === 'pending_for_cancellation'
        || req.body.statusTransitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION
      ) {
        updateColumns.push('lot_project_listing_cancellation_type = ?');
        updateParams.push(requestedCancellationType);
      }
    }

    if (listingStatus.status !== 'hold') {
      const holdColumns = ['hold_client_name', 'hold_note', 'hold_created_at', 'hold_created_by_user_id'];
      for (const column of holdColumns) {
        if (await columnExists(connection, 'lot_project_listings', column)) {
          updateColumns.push(`${column} = NULL`);
        }
      }
    }

    const [result] = await connection.query(
      `
        UPDATE lot_project_listings
        SET ${updateColumns.join(', ')}
        WHERE lot_project_listing_id = ?
          AND lot_project_id = ?
      `,
      [...updateParams, existingListing.lot_project_listing_id, project.lot_project_id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const resetToAvailable = statusTransition.resetToAvailable;
    const unitIdChanged = unitCode !== existingListing.lot_project_listing_unit_id;
    const buyerFormSchemaAvailable = await hasBuyerFormSchema(connection);
    const statusTransitionAction = req.body.statusTransitionAction || null;

    if (hasReservationHistory) {
      if (
        existingListing.lot_project_listing_status === 'sold'
        && listingStatus.status === 'pending_for_cancellation'
      ) {
        await connection.query(
          `
            UPDATE lot_project_reservation_history
            SET reservation_status = 'pending_for_cancellation',
                cancellation_type = ?,
                cancellation_reason = ?,
                updated_at = NOW()
            WHERE lot_project_listing_id = ?
              AND reservation_status = 'active'
            ORDER BY lot_project_reservation_history_id DESC
            LIMIT 1
          `,
          [
            requestedCancellationType,
            toNullable(req.body.cancellationReason || req.body.cancellation_reason),
            existingListing.lot_project_listing_id,
          ]
        );
      } else if (statusTransitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION) {
        await connection.query(
          `
            UPDATE lot_project_reservation_history
            SET reservation_status = 'active',
                cancelled_at = NULL,
                cancellation_type = NULL,
                cancellation_reason = NULL,
                cancelled_value = 0,
                cash_collected_at_cancellation = 0,
                cancelled_by_user_id = NULL,
                updated_at = NOW()
            WHERE lot_project_listing_id = ?
              AND reservation_status = 'pending_for_cancellation'
            ORDER BY lot_project_reservation_history_id DESC
            LIMIT 1
          `,
          [existingListing.lot_project_listing_id]
        );
      } else if (statusTransitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION) {
        const [cashRows] = await connection.query(
          `
            SELECT COALESCE(SUM(lot_project_payment_amount), 0) AS cash_collected
            FROM lot_project_payments
            WHERE lot_project_listing_id = ?
              AND lot_project_payment_status = 'Verified'
          `,
          [existingListing.lot_project_listing_id]
        );

        const cancelledValue = Math.max(Number(existingListing.contract_tcp || existingListing.lot_project_listing_tcp || installmentPricing.tcp || 0), 0);
        const cashCollectedAtCancellation = Math.max(Number(cashRows[0]?.cash_collected || 0), 0);
        const cancellationReason = toNullable(req.body.cancellationReason || req.body.cancellation_reason);

        const [historyResult] = await connection.query(
          `
            UPDATE lot_project_reservation_history
            SET reservation_status = 'cancelled',
                cancelled_at = NOW(),
                cancellation_type = ?,
                cancellation_reason = ?,
                cancelled_value = ?,
                cash_collected_at_cancellation = ?,
                cancelled_by_user_id = ?,
                updated_at = NOW()
            WHERE lot_project_listing_id = ?
              AND reservation_status IN ('pending_for_cancellation', 'active')
            ORDER BY lot_project_reservation_history_id DESC
            LIMIT 1
          `,
          [
            requestedCancellationType,
            cancellationReason,
            cancelledValue,
            cashCollectedAtCancellation,
            req.authUser?.id || null,
            existingListing.lot_project_listing_id,
          ]
        );

        if (historyResult.affectedRows === 0) {
          const [profileRows] = await connection.query(
            `
              SELECT
                lot_project_client_profile_id,
                buyer_full_name,
                soa_mode_of_payment,
                soa_selected_price_per_sqm,
                soa_selected_base_selling_price,
                soa_selected_net_selling_price,
                soa_selected_lmf_amount,
                soa_selected_tcp,
                soa_sale_discount_percentage,
                soa_sale_discount_amount,
                soa_dp_discount_percentage
              FROM lot_project_client_profiles
              WHERE lot_project_listing_id = ?
              LIMIT 1
            `,
            [existingListing.lot_project_listing_id]
          );
          const profile = profileRows[0] || {};
          const discountPercentage = Number(profile.soa_sale_discount_percentage || 0);
          const discountAmount = Number(profile.soa_sale_discount_amount || 0);
          const effectiveTcp = Number(profile.soa_selected_tcp || cancelledValue || 0);

          await connection.query(
            `
              INSERT INTO lot_project_reservation_history (
                lot_project_id,
                lot_project_listing_id,
                lot_project_client_profile_id,
                unit_id_snapshot,
                buyer_name_snapshot,
                reservation_status,
                reserved_at,
                pricing_mode_snapshot,
                price_per_sqm_snapshot,
                base_selling_price_snapshot,
                net_selling_price_snapshot,
                lmf_amount_snapshot,
                sale_discount_percentage_snapshot,
                sale_discount_amount_snapshot,
                dp_discount_percentage_snapshot,
                tcp_snapshot,
                discount_percentage_snapshot,
                discount_applied_snapshot,
                cancelled_at,
                cancellation_type,
                cancellation_reason,
                cancelled_value,
                cash_collected_at_cancellation,
                cancelled_by_user_id
              ) VALUES (?, ?, ?, ?, ?, 'cancelled', NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
            `,
            [
              project.lot_project_id,
              existingListing.lot_project_listing_id,
              profile.lot_project_client_profile_id || null,
              existingListing.lot_project_listing_unit_id,
              profile.buyer_full_name || null,
              profile.soa_mode_of_payment || 'installment',
              Number(profile.soa_selected_price_per_sqm || 0),
              Number(profile.soa_selected_base_selling_price || 0),
              Number(profile.soa_selected_net_selling_price || 0),
              Number(profile.soa_selected_lmf_amount || 0),
              discountPercentage,
              discountAmount,
              Number(profile.soa_dp_discount_percentage || 0),
              effectiveTcp,
              discountPercentage,
              discountAmount,
              requestedCancellationType,
              cancellationReason,
              cancelledValue,
              cashCollectedAtCancellation,
              req.authUser?.id || null,
            ]
          );
        }
      }
    }

    if (resetToAvailable) {
      await clearListingSaleDataForAvailable(connection, existingListing.lot_project_listing_id);
    } else if (buyerFormSchemaAvailable && (unitIdChanged || listingStatus.status !== 'available')) {
      await revokeOpenBuyerFormLinks(connection, existingListing.lot_project_listing_id, { status: 'superseded' });
      await connection.query(
        `UPDATE lot_project_listings SET buyer_form_generation = buyer_form_generation + 1 WHERE lot_project_listing_id = ?`,
        [existingListing.lot_project_listing_id]
      );
    }

    if (hasListingCadastralLinks) {
      await connection.query(
        `DELETE FROM lot_project_listing_cadastral_lots WHERE lot_project_listing_id = ?`,
        [existingListing.lot_project_listing_id]
      );

      const requestedCadastralLots = Array.isArray(req.body.cadastralLots)
        ? req.body.cadastralLots.map((item) => String(item).trim()).filter(Boolean)
        : String(req.body.cadastral_lot_no || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

      if (requestedCadastralLots.length > 0) {
        const [lotRows] = await connection.query(
          `
            SELECT lot_project_cadastral_lot_number_id
            FROM lot_project_cadastral_lot_numbers
            WHERE lot_project_id = ?
              AND lot_project_cadastral_lot_number IN (${requestedCadastralLots.map(() => '?').join(', ')})
          `,
          [project.lot_project_id, ...requestedCadastralLots]
        );

        if (lotRows.length > 0) {
          await connection.query(
            `
              INSERT INTO lot_project_listing_cadastral_lots (
                lot_project_listing_id,
                lot_project_cadastral_lot_number_id
              ) VALUES ${lotRows.map(() => '(?, ?)').join(', ')}
            `,
            lotRows.flatMap((lot) => [existingListing.lot_project_listing_id, lot.lot_project_cadastral_lot_number_id])
          );
        }
      }
    }

    const soaSyncResult = hasAnnualInterestRate
      ? await syncListingInterestToUnlockedSoa(connection, project.lot_project_id, existingListing.lot_project_listing_id, annualInterestRate)
      : { synced: 0, skipped: 0 };

    const auditTitle = statusTransitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION
      ? 'Cancelled pending cancellation'
      : statusTransitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION
        ? 'Settled listing cancellation'
        : 'Updated listing details';
    const auditDescription = statusTransitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION
      ? `Returned ${unitCode} to Sold / Active without removing sale records.`
      : statusTransitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION
        ? `Completed cancellation settlement for ${unitCode}.`
        : `Updated ${unitCode} in ${project.lot_project_name}.`;

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Listings',
      entityType: 'lot_project_listing',
      entityId: String(existingListing.lot_project_listing_id),
      entityLabel: `Unit ${unitCode} — ${project.lot_project_name}`,
      title: auditTitle,
      description: auditDescription,
      metadata: {
        unitCode,
        previousUnitCode: existingListing.lot_project_listing_unit_id,
        previousStatus: existingListing.lot_project_listing_status,
        nextStatus: listingStatus.status,
        soldSubstatus: listingStatus.soldSubstatus,
        statusTransitionAction,
        resetToAvailable,
        soaSyncResult,
        cloudinarySyncResult,
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: resetToAvailable
        ? `${unitCode} changed to available. Previous buyer, payment, commission, and submitted document data were removed.`
        : statusTransitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION
          ? `${unitCode} returned to Sold / Active. Existing buyer, payment, SOA, document, and commission records were kept.`
          : statusTransitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION
            ? `${unitCode} cancellation settlement completed.`
            : cloudinarySyncResult.movedAssets > 0
          ? cloudinarySyncResult.cleanupWarnings?.length
            ? `${unitCode} updated and ${cloudinarySyncResult.movedAssets} document asset(s) were moved. Some old Cloudinary folders still contain untracked items and were kept.`
            : `${unitCode} updated successfully. ${cloudinarySyncResult.movedAssets} uploaded document asset(s) were moved into the ${unitCode} folder and the empty old folder was removed.`
          : soaSyncResult.synced > 0
            ? `${unitCode} updated successfully. SOA interest was synced and recomputed for ${soaSyncResult.synced} buyer account(s).`
            : soaSyncResult.skipped > 0
              ? `${unitCode} updated successfully. Existing SOA was not changed because it has payments or a custom SOA rate.`
              : `${unitCode} updated successfully.`,
      cloudinary_folder_sync: cloudinarySyncResult,
      listing_id: existingListing.lot_project_listing_id,
      unit_id: unitCode,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}

    const cloudinaryRollbackFailures = await rollbackListingDocumentCloudinaryMoves(completedCloudinaryMoves);
    if (cloudinaryRollbackFailures.length) {
      console.error('Cloudinary unit-folder rollback failed:', cloudinaryRollbackFailures);
    }

    const baseMessage = getErrorMessage(error);
    const message = cloudinaryRollbackFailures.length
      ? `${baseMessage} Some Cloudinary assets could not be restored automatically; check the server logs before retrying.`
      : baseMessage;

    return res.status(error?.statusCode || 500).json({ message });
  } finally {
    connection.release();
  }
};



export const createLotProjectListing = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ message: 'Lot project not found.' });
    }

    if (!(await tableExists(connection, 'lot_project_listings'))) {
      return res.status(500).json({
        message: 'lot_project_listings table does not exist. Run the included SQL migration first.',
      });
    }

    const unitNumber = String(req.body.unitNumber || '').trim();
    const unitCode = String(req.body.unitCode || `${project.lot_project_location_code}-${unitNumber}`).trim().toUpperCase();
    const legacyPricePerSqm = Number(req.body.pricePerSqm || 0);
    const installmentPricePerSqm = Number(
      req.body.installmentPricePerSqm ??
        req.body.installment_price_per_sqm ??
        legacyPricePerSqm
    );
    const cashPricePerSqm = Number(
      req.body.cashPricePerSqm ??
        req.body.cash_price_per_sqm ??
        installmentPricePerSqm
    );
    const lotAreaSqm = Number(req.body.lotAreaSqm || req.body.area || 0);
    const legalMiscRate = Number(req.body.legalMiscRate || req.body.lmfRate || 0);
    const reservationFee = Number(req.body.reservationFee || 0);
    const annualInterestRate = Number(req.body.annualInterestRate || 0);
    const listingStatus = normalizeListingStatusPayload(req.body.status);

    if (!unitNumber && !req.body.unitCode) {
      return res.status(400).json({ message: 'Unit number is required.' });
    }

    if (installmentPricePerSqm <= 0) {
      return res.status(400).json({ message: 'Installment price per SQM must be greater than 0.' });
    }

    if (cashPricePerSqm <= 0) {
      return res.status(400).json({ message: 'Cash price per SQM must be greater than 0.' });
    }

    if (lotAreaSqm <= 0) {
      return res.status(400).json({ message: 'Lot area SQM must be greater than 0.' });
    }

    const installmentPricing = calculateContractPricing({
      lotAreaSqm,
      pricePerSqm: installmentPricePerSqm,
      legalMiscRate,
    });
    const hasInstallmentPriceColumn = await columnExists(
      connection,
      'lot_project_listings',
      'lot_project_listing_installment_price_per_sqm'
    );
    const hasCashPriceColumn = await columnExists(
      connection,
      'lot_project_listings',
      'lot_project_listing_cash_price_per_sqm'
    );
    if (!hasInstallmentPriceColumn || !hasCashPriceColumn) {
      return res.status(500).json({
        message: 'Dual listing pricing migration is missing. Run server/migrations/20260719_dual_listing_pricing_and_contract_snapshots.sql.',
      });
    }
    const hasAnnualInterestRate = await columnExists(connection, 'lot_project_listings', 'annual_interest_rate');

    const insertColumns = [
      'lot_project_id',
      'lot_project_listing_unit_type',
      'lot_project_listing_unit_id',
      'lot_project_listing_old_unit_ids',
      'lot_project_listing_area_sqm',
      'lot_project_listing_price_per_sqm',
      'lot_project_listing_installment_price_per_sqm',
      'lot_project_listing_cash_price_per_sqm',
      'lot_project_listing_net_selling_price',
      'lot_project_listing_lmf_rate',
      'lot_project_listing_lmf_amount',
      'lot_project_listing_tcp',
      'lot_project_listing_reservation_fee',
      'lot_project_listing_status',
      'lot_project_listing_sold_substatus',
    ];

    const insertValues = [
      project.lot_project_id,
      normalizeLotType(req.body.lotType || req.body.unitType),
      unitCode,
      toNullable(req.body.oldUnitIds),
      lotAreaSqm,
      installmentPricePerSqm,
      installmentPricePerSqm,
      cashPricePerSqm,
      installmentPricing.netSellingPrice,
      legalMiscRate,
      installmentPricing.lmfAmount,
      installmentPricing.tcp,
      reservationFee,
      listingStatus.status,
      listingStatus.soldSubstatus,
    ];

    if (hasAnnualInterestRate) {
      insertColumns.push('annual_interest_rate');
      insertValues.push(annualInterestRate);
    }

    await connection.beginTransaction();

    const [listingResult] = await connection.query(
      `
        INSERT INTO lot_project_listings (
          ${insertColumns.join(',\n          ')}
        ) VALUES (${insertColumns.map(() => '?').join(', ')})
      `,
      insertValues
    );

    const listingId = listingResult.insertId;

    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');
    const requestedCadastralLots = Array.isArray(req.body.cadastralLots)
      ? req.body.cadastralLots.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (hasListingCadastralLinks && requestedCadastralLots.length > 0) {
      const [lotRows] = await connection.query(
        `
          SELECT lot_project_cadastral_lot_number_id, lot_project_cadastral_lot_number
          FROM lot_project_cadastral_lot_numbers
          WHERE lot_project_id = ?
            AND lot_project_cadastral_lot_number IN (${requestedCadastralLots.map(() => '?').join(', ')})
        `,
        [project.lot_project_id, ...requestedCadastralLots]
      );

      if (lotRows.length > 0) {
        await connection.query(
          `
            INSERT INTO lot_project_listing_cadastral_lots (
              lot_project_listing_id,
              lot_project_cadastral_lot_number_id
            ) VALUES ${lotRows.map(() => '(?, ?)').join(', ')}
          `,
          lotRows.flatMap((lot) => [listingId, lot.lot_project_cadastral_lot_number_id])
        );
      }
    }

    const requestedDocuments = Array.isArray(req.body.documentRequirements) ? req.body.documentRequirements : [];
    const fallbackDefaults = requestedDocuments.length ? requestedDocuments : await getProjectDefaultDocuments(project.lot_project_id);

    if (await tableExists(connection, 'lot_project_listing_documents')) {
      const cleanDocuments = fallbackDefaults
        .map((document) => ({
          document_id: Number(document.document_id || document.id),
          is_required: document.requirement === 'optional' || document.is_required === false ? 0 : 1,
          status: document.status === 'inactive' ? 'inactive' : 'active',
        }))
        .filter((document) => document.document_id);

      if (cleanDocuments.length > 0) {
        await connection.query(
          `
            INSERT INTO lot_project_listing_documents (
              lot_project_id,
              lot_project_listing_id,
              document_id,
              lot_project_listing_document_is_required,
              lot_project_listing_document_status
            ) VALUES ${cleanDocuments.map(() => '(?, ?, ?, ?, ?)').join(', ')}
          `,
          cleanDocuments.flatMap((document) => [
            project.lot_project_id,
            listingId,
            document.document_id,
            document.is_required,
            document.status,
          ])
        );
      }
    }

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Listings',
      entityType: 'lot_project_listing',
      entityId: String(listingId),
      entityLabel: `Unit ${unitCode} — ${project.lot_project_name}`,
      title: 'Added new listing',
      description: `Added ${unitCode} to ${project.lot_project_name}.`,
      metadata: { unitCode, status: listingStatus.status, soldSubstatus: listingStatus.soldSubstatus },
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `${unitCode} added successfully.`,
      listing_id: listingId,
      unit_id: unitCode,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};



export const deleteLotProjectListing = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });

    const lookup = getListingLookupWhere(listingLookup);

    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
        SELECT
          lot_project_listing_id,
          lot_project_listing_status,
          lot_project_listing_unit_id
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const existingListing = existingRows[0];
    if (!existingListing) {
      await connection.rollback();
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const paymentCountRows = await tableExists(connection, 'lot_project_payments')
      ? (await connection.query(
          `SELECT COUNT(*) AS payment_count FROM lot_project_payments WHERE lot_project_listing_id = ?`,
          [existingListing.lot_project_listing_id]
        ))[0]
      : [{ payment_count: 0 }];

    if (Number(paymentCountRows[0]?.payment_count || 0) > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'This listing has recorded payments and cannot be deleted. Cancel the listing instead.',
      });
    }

    if (
      (await tableExists(connection, 'lot_project_commission_releases')) &&
      (await tableExists(connection, 'lot_project_commissions')) &&
      (await columnExists(connection, 'lot_project_commissions', 'lot_project_listing_id'))
    ) {
      await connection.query(
        `
          DELETE cr
          FROM lot_project_commission_releases cr
          INNER JOIN lot_project_commissions c
            ON c.lot_project_commission_id = cr.lot_project_commission_id
          WHERE c.lot_project_listing_id = ?
        `,
        [existingListing.lot_project_listing_id]
      );
    }

    const dependentTables = [
      'lot_project_client_documents',
      'lot_project_payment_schedules',
      'lot_project_listing_documents',
      'lot_project_listing_cadastral_lots',
      'lot_project_commissions',
      'lot_project_notification_logs',
      'lot_project_client_profiles',
    ];

    for (const tableName of dependentTables) {
      if (
        (await tableExists(connection, tableName)) &&
        (await columnExists(connection, tableName, 'lot_project_listing_id'))
      ) {
        await connection.query(
          `DELETE FROM ${tableName} WHERE lot_project_listing_id = ?`,
          [existingListing.lot_project_listing_id]
        );
      }
    }

    const [result] = await connection.query(
      `DELETE FROM lot_project_listings WHERE lot_project_listing_id = ? AND lot_project_id = ?`,
      [existingListing.lot_project_listing_id, project.lot_project_id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Listing not found.' });
    }

    await connection.commit();

    return res.json({ success: true, message: 'Listing deleted successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


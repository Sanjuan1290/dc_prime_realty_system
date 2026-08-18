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
  closeCancelledAccountAndReleaseListing,
  getCurrentLotProjectAccount,
  settleCancellationCommissionStages,
  voidUnpaidLotProjectAccount,
} from '../../../services/lotProjectAccount.service.js';
import {
  applyCloudinaryMoveToEntry,
  deleteCloudinaryEmptyFolder,
  buildCloudinaryUnitAssetMove,
  getCloudinaryFolderCleanupPaths,
  moveCloudinaryDynamicAssetFolder,
  renameCloudinaryAsset,
} from '../../../services/cloudinaryUnitFolder.service.js';
import { createListingStorageCode } from '../../../services/storageCodes.service.js';
import { resolveDocumentRequiredFlag, resolveDocumentResponsibleParty } from '../../../utils/documentRequirement.js';

const normalizeListingDocumentRequirements = (documents = []) => {
  const documentMap = new Map();

  documents.forEach((document) => {
    const documentId = Number(document?.document_id || document?.documentId || document?.id || 0);
    if (!documentId) return;

    documentMap.set(documentId, {
      document_id: documentId,
      is_required: resolveDocumentRequiredFlag(document),
      responsible_party: resolveDocumentResponsibleParty(document),
      status: String(document?.status || 'active').trim().toLowerCase() === 'inactive'
        ? 'inactive'
        : 'active',
    });
  });

  return [...documentMap.values()];
};

const replaceListingDocumentRequirements = async (connection, projectId, listingId, documents = []) => {
  if (!(await tableExists(connection, 'lot_project_listing_documents'))) {
    return { count: 0, skipped: true };
  }

  const cleanDocuments = normalizeListingDocumentRequirements(documents);

  if (cleanDocuments.length > 0) {
    await connection.query(
      `
        UPDATE lot_project_listing_documents
        SET lot_project_listing_document_status = 'inactive'
        WHERE lot_project_id = ?
          AND lot_project_listing_id = ?
          AND document_id NOT IN (${cleanDocuments.map(() => '?').join(', ')})
      `,
      [projectId, listingId, ...cleanDocuments.map((document) => document.document_id)]
    );

    await connection.query(
      `
        INSERT INTO lot_project_listing_documents (
          lot_project_id,
          lot_project_listing_id,
          document_id,
          lot_project_listing_document_is_required,
          lot_project_listing_document_responsible_party,
          lot_project_listing_document_status
        ) VALUES ${cleanDocuments.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}
        ON DUPLICATE KEY UPDATE
          lot_project_listing_document_is_required = VALUES(lot_project_listing_document_is_required),
          lot_project_listing_document_responsible_party = VALUES(lot_project_listing_document_responsible_party),
          lot_project_listing_document_status = VALUES(lot_project_listing_document_status),
          lot_project_listing_document_updated_at = NOW()
      `,
      cleanDocuments.flatMap((document) => [
        projectId,
        listingId,
        document.document_id,
        document.is_required,
        document.responsible_party,
        document.status,
      ])
    );
  } else {
    await connection.query(
      `
        UPDATE lot_project_listing_documents
        SET lot_project_listing_document_status = 'inactive'
        WHERE lot_project_id = ?
          AND lot_project_listing_id = ?
      `,
      [projectId, listingId]
    );
  }

  return { count: cleanDocuments.filter((document) => document.status === 'active').length, skipped: false };
};

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
    const hasAccounts = await tableExists(connection, 'lot_project_accounts');
    const hasCurrentAccountId = hasAccounts && await columnExists(connection, 'lot_project_listings', 'current_account_id');
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

    // A listing can retain several historical buyer profiles. The inventory must
    // show only the profile attached to current_account_id, otherwise one listing
    // is repeated once for every profile that is still marked active.
    const currentBuyerJoin = hasCurrentAccountId
      ? `
          LEFT JOIN lot_project_accounts current_account
            ON current_account.lot_project_account_id = l.current_account_id
          LEFT JOIN lot_project_client_profiles cp
            ON cp.lot_project_client_profile_id = current_account.lot_project_client_profile_id
        `
      : `
          LEFT JOIN lot_project_client_profiles cp
            ON cp.lot_project_client_profile_id = (
              SELECT cp_current.lot_project_client_profile_id
              FROM lot_project_client_profiles cp_current
              WHERE cp_current.lot_project_listing_id = l.lot_project_listing_id
                AND cp_current.lot_project_client_profile_status = 'active'
              ORDER BY cp_current.lot_project_client_profile_id DESC
              LIMIT 1
            )
        `;

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
        ${currentBuyerJoin}
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

  const accountId = Number(listingRow.current_account_id || listingRow.lot_project_account_id || 0);
  const clientProfileId = Number(listingRow.lot_project_client_profile_id || 0);
  if (!clientProfileId) {
    throw Object.assign(new Error('Cannot rebuild SOA without a buyer profile.'), { statusCode: 409 });
  }
  if (!accountId) {
    throw Object.assign(new Error('Cannot rebuild SOA without the current buyer account.'), { statusCode: 409 });
  }

  const terms = getComputedSoaTerms(listingRow, []);
  const computedRows = recomputeComputedSoaBalances(createComputedSoaRows(terms), terms);

  // Keep the previous zero-payment generation as immutable account history.
  // Never delete schedules by listing id alone because one listing can have
  // several buyer accounts over its lifetime.
  await connection.query(
    `
      UPDATE lot_project_payment_schedules
      SET schedule_status = 'Cancelled',
          updated_at = NOW()
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
        AND lot_project_client_profile_id = ?
        AND lot_project_account_id = ?
        AND schedule_status <> 'Cancelled'
    `,
    [projectId, listingRow.lot_project_listing_id, clientProfileId, accountId]
  );

  if (!computedRows.length) return;

  const baseColumns = [
    'lot_project_id',
    'lot_project_listing_id',
    'lot_project_client_profile_id',
    'lot_project_account_id',
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
  await addOptionalColumn('discount_amount');
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
      clientProfileId,
      accountId,
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
      if (column === 'discount_amount') return roundMoneyValue(row.discountAmount || row.discount_amount || 0);
      if (column === 'principal_amount') return roundMoneyValue(row.principalAmount || row.principal_amount || 0);
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


export const normalizeCancellationRefundType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['no_refund', 'partial_refund', 'full_refund'].includes(normalized)
    ? normalized
    : null;
};

export const calculateCancellationSettlement = ({ cashCollected = 0, body = {} } = {}) => {
  const collected = roundMoneyValue(Math.max(Number(cashCollected || 0), 0));
  const refundType = normalizeCancellationRefundType(
    body.cancellationRefundType ?? body.cancellation_refund_type ?? body.refundType ?? body.refund_type
  );

  if (!refundType) {
    throw Object.assign(
      new Error('Select No Refund, Partial Refund, or Full Refund.'),
      { statusCode: 400 }
    );
  }

  const requestedRefund = roundMoneyValue(
    Number(body.refundAmount ?? body.refund_amount ?? 0)
  );

  if (!Number.isFinite(requestedRefund) || requestedRefund < 0) {
    throw Object.assign(new Error('Refund amount cannot be negative.'), { statusCode: 400 });
  }

  let refundAmount = requestedRefund;
  if (refundType === 'no_refund') refundAmount = 0;
  if (refundType === 'full_refund') refundAmount = collected;

  if (refundAmount > collected) {
    throw Object.assign(
      new Error('Refund amount cannot exceed verified payments.'),
      { statusCode: 400 }
    );
  }

  if (refundType === 'partial_refund' && (refundAmount <= 0 || refundAmount >= collected)) {
    throw Object.assign(
      new Error('Partial refund must be greater than zero and less than verified payments.'),
      { statusCode: 400 }
    );
  }

  const discontinuedAmount = roundMoneyValue(Math.max(collected - refundAmount, 0));
  const legacyCancellationType = refundAmount >= collected && collected > 0
    ? 'refunded'
    : 'discontinued';

  return {
    refundType,
    refundAmount,
    discontinuedAmount,
    legacyCancellationType,
    refundDate: dateOrNull(body.refundDate ?? body.refund_date),
    refundReference: toNullable(body.refundReference ?? body.refund_reference),
    settlementNotes: toNullable(
      body.cancellationSettlementNotes ?? body.cancellation_settlement_notes ?? body.settlementNotes
    ),
  };
};

const queryRowsIfTableExists = async (connection, tableName, sql, params = []) => {
  if (!(await tableExists(connection, tableName))) return [];
  const [rows] = await connection.query(sql, params);
  return rows;
};

const archiveListingSaleDataForAvailable = async (
  connection,
  {
    projectId,
    listingId,
    archivedByUserId = null,
  }
) => {
  if (!(await tableExists(connection, 'lot_project_cancelled_sale_archives'))) {
    throw Object.assign(
      new Error('Cancellation financial archive migration is missing. Run 20260719_cancellation_settlement_financial_archive.sql first.'),
      { statusCode: 500 }
    );
  }

  const currentAccount = await getCurrentLotProjectAccount(connection, listingId, { forUpdate: true });
  const clientProfileId = Number(currentAccount?.lot_project_client_profile_id || 0);
  if (!clientProfileId) {
    throw Object.assign(new Error('The cancelled buyer account could not be loaded.'), { statusCode: 400 });
  }

  const [historyRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_reservation_history
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
        AND lot_project_client_profile_id = ?
        AND reservation_status = 'cancelled'
      ORDER BY COALESCE(cancelled_at, updated_at) DESC, lot_project_reservation_history_id DESC
      LIMIT 1
      FOR UPDATE
    `,
    [projectId, listingId, clientProfileId]
  );
  const history = historyRows[0];

  if (!history) {
    throw Object.assign(
      new Error('Complete the cancellation settlement before changing this unit to Available.'),
      { statusCode: 400 }
    );
  }

  const buyerProfiles = await queryRowsIfTableExists(
    connection,
    'lot_project_client_profiles',
    'SELECT * FROM lot_project_client_profiles WHERE lot_project_client_profile_id = ?',
    [clientProfileId]
  );
  const payments = await queryRowsIfTableExists(
    connection,
    'lot_project_payments',
    'SELECT * FROM lot_project_payments WHERE lot_project_client_profile_id = ? ORDER BY lot_project_payment_id',
    [clientProfileId]
  );
  const paymentSchedules = await queryRowsIfTableExists(
    connection,
    'lot_project_payment_schedules',
    'SELECT * FROM lot_project_payment_schedules WHERE lot_project_client_profile_id = ? ORDER BY lot_project_payment_schedule_id',
    [clientProfileId]
  );
  const paymentAllocations = await queryRowsIfTableExists(
    connection,
    'lot_project_payment_allocations',
    `
      SELECT pa.*
      FROM lot_project_payment_allocations pa
      LEFT JOIN lot_project_payments p
        ON p.lot_project_payment_id = pa.lot_project_payment_id
      LEFT JOIN lot_project_payment_schedules ps
        ON ps.lot_project_payment_schedule_id = pa.lot_project_payment_schedule_id
      WHERE p.lot_project_client_profile_id = ? OR ps.lot_project_client_profile_id = ?
      ORDER BY pa.lot_project_payment_allocation_id
    `,
    [clientProfileId, clientProfileId]
  );
  const paymentLogs = await queryRowsIfTableExists(
    connection,
    'lot_project_payment_logs',
    `
      SELECT pl.*
      FROM lot_project_payment_logs pl
      INNER JOIN lot_project_payments p
        ON p.lot_project_payment_id = pl.lot_project_payment_id
      WHERE p.lot_project_client_profile_id = ?
      ORDER BY pl.lot_project_payment_log_id
    `,
    [clientProfileId]
  );
  const penaltyReliefs = await queryRowsIfTableExists(
    connection,
    'lot_project_penalty_reliefs',
    'SELECT * FROM lot_project_penalty_reliefs WHERE lot_project_client_profile_id = ? ORDER BY penalty_relief_id',
    [clientProfileId]
  );
  const clientDocuments = await queryRowsIfTableExists(
    connection,
    'lot_project_client_documents',
    'SELECT * FROM lot_project_client_documents WHERE lot_project_client_profile_id = ? ORDER BY lot_project_client_document_id',
    [clientProfileId]
  );
  const commissions = await queryRowsIfTableExists(
    connection,
    'lot_project_commissions',
    'SELECT * FROM lot_project_commissions WHERE lot_project_client_profile_id = ? ORDER BY lot_project_commission_id',
    [clientProfileId]
  );
  const commissionReleases = await queryRowsIfTableExists(
    connection,
    'lot_project_commission_releases',
    `
      SELECT cr.*
      FROM lot_project_commission_releases cr
      INNER JOIN lot_project_commissions c
        ON c.lot_project_commission_id = cr.lot_project_commission_id
      WHERE c.lot_project_client_profile_id = ?
      ORDER BY cr.lot_project_commission_release_id
    `,
    [clientProfileId]
  );
  const commissionReceipts = await queryRowsIfTableExists(
    connection,
    'lot_project_commission_receipts',
    'SELECT * FROM lot_project_commission_receipts WHERE lot_project_client_profile_id = ? ORDER BY lot_project_commission_receipt_id',
    [clientProfileId]
  );
  const commissionReceiptItems = await queryRowsIfTableExists(
    connection,
    'lot_project_commission_receipt_items',
    `
      SELECT item.*
      FROM lot_project_commission_receipt_items item
      INNER JOIN lot_project_commission_receipts receipt
        ON receipt.lot_project_commission_receipt_id = item.lot_project_commission_receipt_id
      WHERE receipt.lot_project_client_profile_id = ?
      ORDER BY item.lot_project_commission_receipt_item_id
    `,
    [clientProfileId]
  );

  const releasedCommissionAmount = commissionReleases
    .filter((row) => String(row.release_status || '').toLowerCase() === 'released')
    .reduce((sum, row) => sum + Number(row.net_release_amount || 0), 0);

  const [archiveResult] = await connection.query(
    `
      INSERT INTO lot_project_cancelled_sale_archives (
        lot_project_reservation_history_id,
        lot_project_id,
        lot_project_listing_id,
        unit_id_snapshot,
        buyer_name_snapshot,
        cash_collected_at_cancellation,
        refund_amount,
        discontinued_amount,
        released_commission_amount,
        buyer_profile_snapshot,
        payment_snapshot,
        payment_schedule_snapshot,
        payment_allocation_snapshot,
        payment_log_snapshot,
        penalty_relief_snapshot,
        client_document_snapshot,
        commission_snapshot,
        commission_release_snapshot,
        commission_receipt_snapshot,
        commission_receipt_item_snapshot,
        archived_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        refund_amount = VALUES(refund_amount),
        discontinued_amount = VALUES(discontinued_amount),
        released_commission_amount = VALUES(released_commission_amount),
        buyer_profile_snapshot = VALUES(buyer_profile_snapshot),
        payment_snapshot = VALUES(payment_snapshot),
        payment_schedule_snapshot = VALUES(payment_schedule_snapshot),
        payment_allocation_snapshot = VALUES(payment_allocation_snapshot),
        payment_log_snapshot = VALUES(payment_log_snapshot),
        penalty_relief_snapshot = VALUES(penalty_relief_snapshot),
        client_document_snapshot = VALUES(client_document_snapshot),
        commission_snapshot = VALUES(commission_snapshot),
        commission_release_snapshot = VALUES(commission_release_snapshot),
        commission_receipt_snapshot = VALUES(commission_receipt_snapshot),
        commission_receipt_item_snapshot = VALUES(commission_receipt_item_snapshot),
        archived_by_user_id = VALUES(archived_by_user_id),
        archived_at = NOW(),
        lot_project_cancelled_sale_archive_id = LAST_INSERT_ID(lot_project_cancelled_sale_archive_id)
    `,
    [
      history.lot_project_reservation_history_id,
      projectId,
      listingId,
      history.unit_id_snapshot,
      history.buyer_name_snapshot,
      Number(history.cash_collected_at_cancellation || 0),
      Number(history.refund_amount || 0),
      Number(history.discontinued_amount || 0),
      roundMoneyValue(releasedCommissionAmount),
      JSON.stringify(buyerProfiles),
      JSON.stringify(payments),
      JSON.stringify(paymentSchedules),
      JSON.stringify(paymentAllocations),
      JSON.stringify(paymentLogs),
      JSON.stringify(penaltyReliefs),
      JSON.stringify(clientDocuments),
      JSON.stringify(commissions),
      JSON.stringify(commissionReleases),
      JSON.stringify(commissionReceipts),
      JSON.stringify(commissionReceiptItems),
      archivedByUserId,
    ]
  );
  const archiveId = Number(archiveResult.insertId || 0);

  if (
    archiveId > 0 &&
    (await tableExists(connection, 'lot_project_archived_commission_releases')) &&
    (await tableExists(connection, 'lot_project_commission_releases')) &&
    (await tableExists(connection, 'lot_project_commissions'))
  ) {
    await connection.query(
      `
        INSERT IGNORE INTO lot_project_archived_commission_releases (
          lot_project_cancelled_sale_archive_id,
          lot_project_reservation_history_id,
          source_commission_release_id,
          source_commission_id,
          source_commission_receipt_id,
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          accredited_seller_id,
          sale_owner_accredited_seller_id,
          project_name_snapshot,
          project_location_snapshot,
          unit_id_snapshot,
          buyer_name_snapshot,
          commission_role,
          commission_seller_type,
          commission_rate_type,
          commission_rate,
          gross_commission_amount,
          release_stage,
          release_trigger_percent,
          release_percent,
          gross_release_amount,
          deduction_amount,
          net_release_amount,
          actual_release_date,
          release_entry_mode,
          release_recorded_at,
          historical_release_note,
          receipt_date,
          receipt_reference_number,
          receipt_bank_name,
          receipt_account_number,
          receipt_witness_name,
          receipt_total_amount,
          receipt_status,
          receipt_created_by_name
        )
        SELECT
          ?,
          ?,
          r.lot_project_commission_release_id,
          c.lot_project_commission_id,
          receipt.lot_project_commission_receipt_id,
          c.lot_project_id,
          c.lot_project_listing_id,
          c.lot_project_client_profile_id,
          c.accredited_seller_id,
          c.sale_owner_accredited_seller_id,
          p.lot_project_name,
          p.lot_project_location,
          l.lot_project_listing_unit_id,
          cp.buyer_full_name,
          c.commission_role,
          c.commission_seller_type,
          c.commission_rate_type,
          c.commission_rate,
          c.gross_commission_amount,
          r.release_stage,
          r.release_trigger_percent,
          r.release_percent,
          r.gross_release_amount,
          r.deduction_amount,
          r.net_release_amount,
          r.actual_release_date,
          r.release_entry_mode,
          r.release_recorded_at,
          r.historical_release_note,
          receipt.receipt_date,
          receipt.reference_number,
          receipt.bank_name,
          receipt.account_number,
          receipt.witness_name,
          receipt.total_amount,
          receipt.receipt_status,
          NULLIF(TRIM(CONCAT_WS(' ', creator.first_name, creator.middle_name, creator.last_name)), '')
        FROM lot_project_commission_releases r
        INNER JOIN lot_project_commissions c
          ON c.lot_project_commission_id = r.lot_project_commission_id
        INNER JOIN lot_projects p
          ON p.lot_project_id = c.lot_project_id
        INNER JOIN lot_project_listings l
          ON l.lot_project_listing_id = c.lot_project_listing_id
        LEFT JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = c.lot_project_client_profile_id
        LEFT JOIN lot_project_commission_receipt_items item
          ON item.lot_project_commission_release_id = r.lot_project_commission_release_id
        LEFT JOIN lot_project_commission_receipts receipt
          ON receipt.lot_project_commission_receipt_id = item.lot_project_commission_receipt_id
        LEFT JOIN users creator
          ON creator.id = receipt.created_by_user_id
        WHERE c.lot_project_client_profile_id = ?
          AND r.release_status = 'Released'
          AND r.actual_release_date IS NOT NULL
      `,
      [archiveId, history.lot_project_reservation_history_id, clientProfileId]
    );
  }

  if (await columnExists(connection, 'lot_project_reservation_history', 'sale_data_archived_at')) {
    await connection.query(
      `
        UPDATE lot_project_reservation_history
        SET sale_data_archived_at = NOW(),
            released_commission_amount_at_cancellation = ?
        WHERE lot_project_reservation_history_id = ?
      `,
      [roundMoneyValue(releasedCommissionAmount), history.lot_project_reservation_history_id]
    );
  }

  return {
    archiveId,
    historyId: Number(history.lot_project_reservation_history_id),
    releasedCommissionAmount: roundMoneyValue(releasedCommissionAmount),
  };
};

const clearListingSaleDataForAvailable = async (
  connection,
  {
    projectId,
    listingId,
    archivedByUserId = null,
  }
) => {
  // Keep the immutable financial snapshot for reporting compatibility, but do
  // not delete any buyer, payment, document, commission, receipt, or log row.
  const archive = await archiveListingSaleDataForAvailable(connection, {
    projectId,
    listingId,
    archivedByUserId,
  });

  const closedAccount = await closeCancelledAccountAndReleaseListing(connection, {
    projectId,
    listingId,
    closedByUserId: archivedByUserId,
  });

  if (await hasBuyerFormSchema(connection)) {
    await revokeOpenBuyerFormLinks(connection, listingId, { status: 'superseded' });
  }

  return {
    ...archive,
    ...closedAccount,
    recordsRetained: true,
  };
};

const syncListingInterestToUnlockedSoa = async (connection, projectId, listingId, annualInterestRate) => {
  if (!(await tableExists(connection, 'lot_project_client_profiles'))) return { synced: 0, skipped: 0 };

  const hasOverrideColumn = await columnExists(connection, 'lot_project_client_profiles', 'soa_interest_rate_overridden');
  const [profileRows] = await connection.query(
    `
      SELECT l.*, cp.*, account.lot_project_account_id
      FROM lot_project_listings l
      INNER JOIN lot_project_accounts account
        ON account.lot_project_account_id = l.current_account_id
       AND account.lot_project_id = l.lot_project_id
       AND account.lot_project_listing_id = l.lot_project_listing_id
      INNER JOIN lot_project_client_profiles cp
        ON cp.lot_project_client_profile_id = account.lot_project_client_profile_id
       AND cp.lot_project_client_profile_status = 'active'
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
              AND lot_project_client_profile_id = ?
              AND lot_project_account_id = ?
              AND lot_project_payment_status <> 'Cancelled'
          `,
          [projectId, listingId, profile.lot_project_client_profile_id, profile.lot_project_account_id]
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
      FROM lot_project_client_documents document_row
      INNER JOIN lot_project_listings listing
        ON listing.lot_project_listing_id = document_row.lot_project_listing_id
      WHERE document_row.lot_project_listing_id = ?
        AND (
          listing.current_account_id IS NULL
          OR document_row.lot_project_client_profile_id = (
            SELECT account.lot_project_client_profile_id
            FROM lot_project_accounts account
            WHERE account.lot_project_account_id = listing.current_account_id
            LIMIT 1
          )
        )
        AND document_row.lot_project_client_document_file_url IS NOT NULL
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
      // Authenticated account-scoped files keep their immutable account folder.
      if (entry.protected || entry.fileId || entry.accessPath) continue;
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
    let listingStatus = normalizeListingStatusPayload(req.body.status || req.body.rawStatus || req.body.listing_status);

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
    const hasCancellationSettlementFields = hasReservationHistory
      && await columnExists(connection, 'lot_project_reservation_history', 'refund_amount');

    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
        SELECT
          lot_project_listing_id,
          lot_project_listing_status,
          lot_project_listing_sold_substatus,
          lot_project_listing_unit_type,
          lot_project_listing_unit_id,
          lot_project_listing_old_unit_ids,
          lot_project_listing_area_sqm,
          lot_project_listing_price_per_sqm,
          lot_project_listing_installment_price_per_sqm,
          lot_project_listing_cash_price_per_sqm,
          lot_project_listing_lmf_rate,
          lot_project_listing_lmf_amount,
          lot_project_listing_tcp,
          lot_project_listing_reservation_fee,
          annual_interest_rate,
          current_account_id,
          (
            SELECT cp.soa_selected_tcp
            FROM lot_project_client_profiles cp
            WHERE cp.lot_project_listing_id = l.lot_project_listing_id
              AND cp.lot_project_client_profile_status = 'active'
            ORDER BY cp.lot_project_client_profile_id DESC
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

    const currentAccount = await getCurrentLotProjectAccount(
      connection,
      existingListing.lot_project_listing_id,
      { forUpdate: true }
    );
    const currentClientProfileId = Number(currentAccount?.lot_project_client_profile_id || 0);

    // A generic Edit Listing form submits raw status values such as "sold".
    // Preserve the existing sold substatus (especially fully_paid) unless the
    // request explicitly changes status/substatus through a business action.
    const requestedStatusToken = String(req.body.status || req.body.rawStatus || req.body.listing_status || '').trim().toLowerCase();
    const explicitlyRequestedSoldSubstatus = ['fully_paid', 'sold_active', 'sold / active'].includes(requestedStatusToken);
    if (
      listingStatus.status === 'sold'
      && existingListing.lot_project_listing_status === 'sold'
      && !explicitlyRequestedSoldSubstatus
      && !req.body.statusTransitionAction
    ) {
      listingStatus = {
        ...listingStatus,
        soldSubstatus: existingListing.lot_project_listing_sold_substatus || 'active',
      };
    }

    const sameNumber = (left, right) => Math.abs(Number(left || 0) - Number(right || 0)) < 0.000001;
    const unitIdChanged = unitCode !== String(existingListing.lot_project_listing_unit_id || '').trim().toUpperCase();
    const statusChanged = listingStatus.status !== existingListing.lot_project_listing_status
      || String(listingStatus.soldSubstatus || '') !== String(existingListing.lot_project_listing_sold_substatus || '');
    const annualInterestChanged = hasAnnualInterestRate
      && !sameNumber(annualInterestRate, existingListing.annual_interest_rate);
    const oldUnitIdsValue = req.body.oldUnitIds ?? req.body.old_unit_ids ?? existingListing.lot_project_listing_old_unit_ids ?? '';
    const oldUnitIdAliases = String(oldUnitIdsValue || '')
      .split(/[,;\n]+/)
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    const previousUnitId = String(existingListing.lot_project_listing_unit_id || '').trim().toUpperCase();
    const keepsPreviousUnitId = oldUnitIdAliases.includes(previousUnitId);

    if (unitIdChanged && previousUnitId && !keepsPreviousUnitId && req.body.confirmSkipPreviousUnitId !== true) {
      await connection.rollback();
      return res.status(409).json({
        code: 'PREVIOUS_UNIT_ID_CONFIRMATION_REQUIRED',
        previousUnitId,
        nextUnitId: unitCode,
        message: `The Unit ID is changing from ${previousUnitId} to ${unitCode}. Add ${previousUnitId} to Old Unit IDs or explicitly confirm that it should not be retained.`,
      });
    }

    const statusTransitionAction = req.body.statusTransitionAction || null;
    const statusTransition = validateListingStatusTransition({
      currentStatus: existingListing.lot_project_listing_status,
      nextStatus: listingStatus.status,
      action: statusTransitionAction,
      confirmSaleDataDeletion: req.body.confirmSaleDataDeletion === true,
    });
    const voidUnpaidAccount = statusTransition.voidUnpaidAccount === true;

    let cancellationSettlement = null;
    if (statusTransitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION) {
      if (!(await columnExists(connection, 'lot_project_reservation_history', 'refund_amount'))) {
        throw Object.assign(
          new Error('Cancellation settlement migration is missing. Run 20260719_cancellation_settlement_financial_archive.sql first.'),
          { statusCode: 500 }
        );
      }

      const hasPaymentAccountId = await columnExists(connection, 'lot_project_payments', 'lot_project_account_id');
      const paymentAccountId = Number(currentAccount?.lot_project_account_id || 0);
      const paymentScopeSql = hasPaymentAccountId && paymentAccountId
        ? 'lot_project_account_id = ?'
        : 'lot_project_client_profile_id = ?';
      const paymentScopeValue = hasPaymentAccountId && paymentAccountId
        ? paymentAccountId
        : currentClientProfileId;

      // Batch 1 payment writes lock the listing/account before changing money.
      // Lock the same verified payment rows here so cancellation always settles
      // against one stable collection total.
      await connection.query(
        `
          SELECT lot_project_payment_id
          FROM lot_project_payments
          WHERE ${paymentScopeSql}
            AND lot_project_payment_status = 'Verified'
          ORDER BY lot_project_payment_id
          FOR UPDATE
        `,
        [paymentScopeValue]
      );

      const [cashRows] = await connection.query(
        `
          SELECT COALESCE(SUM(lot_project_payment_amount), 0) AS cash_collected
          FROM lot_project_payments
          WHERE ${paymentScopeSql}
            AND lot_project_payment_status = 'Verified'
        `,
        [paymentScopeValue]
      );

      cancellationSettlement = calculateCancellationSettlement({
        cashCollected: cashRows[0]?.cash_collected || 0,
        body: req.body,
      });
    }

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

    const cloudinarySyncResult = unitIdChanged
      ? await syncListingDocumentCloudinaryUnitFolder(
          connection,
          existingListing.lot_project_listing_id,
          existingListing.lot_project_listing_unit_id,
          unitCode,
          completedCloudinaryMoves
        )
      : { movedAssets: 0, updatedDocumentRows: 0, repairedMetadata: 0, deletedFolders: 0, cleanupWarnings: [] };

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
      toNullable(oldUnitIdsValue),
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

    if (annualInterestChanged) {
      updateColumns.push('annual_interest_rate = ?');
      updateParams.push(annualInterestRate);
    }

    const requestedCancellationType = cancellationSettlement?.legacyCancellationType || (
      ['refunded', 'discontinued'].includes(
        String(req.body.cancellationType || req.body.cancellation_type || '').trim().toLowerCase()
      )
        ? String(req.body.cancellationType || req.body.cancellation_type).trim().toLowerCase()
        : (existingListing.lot_project_listing_cancellation_type || 'discontinued')
    );

    if (hasCancellationType) {
      if (
        req.body.statusTransitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION ||
        req.body.statusTransitionAction === LISTING_STATUS_ACTIONS.VOID_UNPAID_CANCELLATION
      ) {
        updateColumns.push('lot_project_listing_cancellation_type = NULL');
      } else if (
        listingStatus.status === 'pending_for_cancellation'
        || req.body.statusTransitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION
      ) {
        updateColumns.push('lot_project_listing_cancellation_type = ?');
        updateParams.push(requestedCancellationType);
      }
    }

    if (statusChanged && listingStatus.status !== 'hold') {
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
    const buyerFormSchemaAvailable = await hasBuyerFormSchema(connection);
    let saleArchiveResult = null;

    if (voidUnpaidAccount) {
      saleArchiveResult = await voidUnpaidLotProjectAccount(connection, {
        projectId: project.lot_project_id,
        listingId: existingListing.lot_project_listing_id,
      });
    }

    if (hasReservationHistory && !voidUnpaidAccount) {
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
            WHERE lot_project_client_profile_id = ?
              AND reservation_status = 'active'
            ORDER BY lot_project_reservation_history_id DESC
            LIMIT 1
          `,
          [
            requestedCancellationType,
            toNullable(req.body.cancellationReason || req.body.cancellation_reason),
            currentClientProfileId,
          ]
        );
        if (currentAccount?.lot_project_account_id) {
          await connection.query(
            `UPDATE lot_project_accounts SET account_status = 'pending_cancellation', cancellation_reason = ?, updated_at = NOW() WHERE lot_project_account_id = ?`,
            [toNullable(req.body.cancellationReason || req.body.cancellation_reason), currentAccount.lot_project_account_id]
          );
        }
      } else if (statusTransitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION) {
        const settlementResetSql = hasCancellationSettlementFields
          ? `,
                cancellation_refund_type = NULL,
                refund_amount = 0,
                discontinued_amount = 0,
                refund_date = NULL,
                refund_reference = NULL,
                cancellation_settlement_notes = NULL,
                released_commission_amount_at_cancellation = 0,
                sale_data_archived_at = NULL`
          : '';

        await connection.query(
          `
            UPDATE lot_project_reservation_history
            SET reservation_status = 'active',
                cancelled_at = NULL,
                cancellation_type = NULL,
                cancellation_reason = NULL,
                cancelled_value = 0,
                cash_collected_at_cancellation = 0,
                cancelled_by_user_id = NULL
                ${settlementResetSql},
                updated_at = NOW()
            WHERE lot_project_client_profile_id = ?
              AND reservation_status = 'pending_for_cancellation'
            ORDER BY lot_project_reservation_history_id DESC
            LIMIT 1
          `,
          [currentClientProfileId]
        );
        if (currentAccount?.lot_project_account_id) {
          await connection.query(
            `UPDATE lot_project_accounts SET account_status = 'active', cancellation_date = NULL, closed_at = NULL, cash_collected_at_cancellation = 0, refund_amount = 0, discontinued_amount = 0, commissionable_retained_amount = 0, commissionable_retained_percent = 0, cancellation_reason = NULL, settlement_notes = NULL, updated_at = NOW() WHERE lot_project_account_id = ?`,
            [currentAccount.lot_project_account_id]
          );
        }
      } else if (statusTransitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION) {
        if (!cancellationSettlement || !hasCancellationSettlementFields) {
          throw Object.assign(
            new Error('Cancellation settlement migration is missing or the settlement values are invalid.'),
            { statusCode: 500 }
          );
        }

        const cancelledValue = Math.max(
          Number(existingListing.contract_tcp || existingListing.lot_project_listing_tcp || installmentPricing.tcp || 0),
          0
        );
        const cashCollectedAtCancellation = roundMoneyValue(
          cancellationSettlement.refundAmount + cancellationSettlement.discontinuedAmount
        );
        const cancellationReason = toNullable(req.body.cancellationReason || req.body.cancellation_reason);
        const hasHistoryAccountId = await columnExists(connection, 'lot_project_reservation_history', 'lot_project_account_id');
        const historyScopeSql = hasHistoryAccountId && currentAccount?.lot_project_account_id
          ? 'lot_project_account_id = ?'
          : 'lot_project_client_profile_id = ?';
        const historyScopeValue = hasHistoryAccountId && currentAccount?.lot_project_account_id
          ? currentAccount.lot_project_account_id
          : currentClientProfileId;
        const [settlementHistoryRows] = await connection.query(
          `
            SELECT lot_project_reservation_history_id, reservation_status
            FROM lot_project_reservation_history
            WHERE ${historyScopeSql}
            ORDER BY lot_project_reservation_history_id DESC
            LIMIT 1
            FOR UPDATE
          `,
          [historyScopeValue]
        );
        const settlementHistory = settlementHistoryRows[0] || null;

        const [releasedCommissionRows] = await connection.query(
          `
            SELECT COALESCE(SUM(r.net_release_amount), 0) AS released_commission
            FROM lot_project_commission_releases r
            INNER JOIN lot_project_commissions c
              ON c.lot_project_commission_id = r.lot_project_commission_id
            WHERE c.lot_project_client_profile_id = ?
              AND r.release_status = 'Released'
          `,
          [currentClientProfileId]
        );
        const releasedCommissionAmount = roundMoneyValue(
          releasedCommissionRows[0]?.released_commission || 0
        );

        let historyResult = { affectedRows: 0 };
        if (settlementHistory) {
          if (!['pending_for_cancellation', 'active'].includes(settlementHistory.reservation_status)) {
            throw Object.assign(new Error('This cancellation settlement has already been completed.'), { statusCode: 409 });
          }

          [historyResult] = await connection.query(
            `
              UPDATE lot_project_reservation_history
              SET reservation_status = 'cancelled',
                  cancelled_at = NOW(),
                  cancellation_type = ?,
                  cancellation_refund_type = ?,
                  cancellation_reason = ?,
                  cancelled_value = ?,
                  cash_collected_at_cancellation = ?,
                  refund_amount = ?,
                  discontinued_amount = ?,
                  refund_date = ?,
                  refund_reference = ?,
                  cancellation_settlement_notes = ?,
                  released_commission_amount_at_cancellation = ?,
                  cancelled_by_user_id = ?,
                  updated_at = NOW()
              WHERE lot_project_reservation_history_id = ?
                AND reservation_status = ?
            `,
            [
              cancellationSettlement.legacyCancellationType,
              cancellationSettlement.refundType,
              cancellationReason,
              cancelledValue,
              cashCollectedAtCancellation,
              cancellationSettlement.refundAmount,
              cancellationSettlement.discontinuedAmount,
              cancellationSettlement.refundDate,
              cancellationSettlement.refundReference,
              cancellationSettlement.settlementNotes,
              releasedCommissionAmount,
              req.authUser?.id || null,
              settlementHistory.lot_project_reservation_history_id,
              settlementHistory.reservation_status,
            ]
          );

          if (historyResult.affectedRows !== 1) {
            throw Object.assign(new Error('Cancellation history changed while settlement was being saved. Please retry.'), { statusCode: 409 });
          }
        }

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
              WHERE lot_project_client_profile_id = ?
              LIMIT 1
            `,
            [currentClientProfileId]
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
                cancellation_refund_type,
                cancellation_reason,
                cancelled_value,
                cash_collected_at_cancellation,
                refund_amount,
                discontinued_amount,
                refund_date,
                refund_reference,
                cancellation_settlement_notes,
                released_commission_amount_at_cancellation,
                cancelled_by_user_id
              ) VALUES (?, ?, ?, ?, ?, 'cancelled', NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              cancellationSettlement.legacyCancellationType,
              cancellationSettlement.refundType,
              cancellationReason,
              cancelledValue,
              cashCollectedAtCancellation,
              cancellationSettlement.refundAmount,
              cancellationSettlement.discontinuedAmount,
              cancellationSettlement.refundDate,
              cancellationSettlement.refundReference,
              cancellationSettlement.settlementNotes,
              releasedCommissionAmount,
              req.authUser?.id || null,
            ]
          );
        }

        const commissionSettlement = await settleCancellationCommissionStages(connection, {
          listingId: existingListing.lot_project_listing_id,
          clientProfileId: currentClientProfileId,
          retainedAmount: cancellationSettlement.discontinuedAmount,
        });

        if (currentAccount?.lot_project_account_id) {
          const [accountUpdate] = await connection.query(
            `
              UPDATE lot_project_accounts
              SET account_status = 'cancelled',
                  cancellation_date = NOW(),
                  cash_collected_at_cancellation = ?,
                  refund_amount = ?,
                  discontinued_amount = ?,
                  commissionable_retained_amount = ?,
                  commissionable_retained_percent = ?,
                  cancellation_reason = ?,
                  settlement_notes = ?,
                  updated_at = NOW()
              WHERE lot_project_account_id = ?
                AND account_status IN ('active', 'pending_cancellation')
            `,
            [
              cashCollectedAtCancellation,
              cancellationSettlement.refundAmount,
              cancellationSettlement.discontinuedAmount,
              cancellationSettlement.discontinuedAmount,
              commissionSettlement.retainedPercent,
              cancellationReason,
              cancellationSettlement.settlementNotes,
              currentAccount.lot_project_account_id,
            ]
          );
          if (accountUpdate.affectedRows !== 1) {
            throw Object.assign(new Error('Buyer account changed while cancellation was being settled. Please retry.'), { statusCode: 409 });
          }
        }
      }
    }

    if (resetToAvailable) {
      saleArchiveResult = await clearListingSaleDataForAvailable(connection, {
        projectId: project.lot_project_id,
        listingId: existingListing.lot_project_listing_id,
        archivedByUserId: req.authUser?.id || null,
      });
    } else if (!voidUnpaidAccount && buyerFormSchemaAvailable && (unitIdChanged || statusChanged)) {
      await revokeOpenBuyerFormLinks(connection, existingListing.lot_project_listing_id, { status: 'superseded' });
      await connection.query(
        `UPDATE lot_project_listings SET buyer_form_generation = buyer_form_generation + 1 WHERE lot_project_listing_id = ?`,
        [existingListing.lot_project_listing_id]
      );
    }

    let cadastralSyncResult = { added: 0, removed: 0, skipped: true };
    const cadastralWasSubmitted = Array.isArray(req.body.cadastralLots)
      || Object.prototype.hasOwnProperty.call(req.body, 'cadastral_lot_no');
    if (hasListingCadastralLinks && cadastralWasSubmitted) {
      const requestedCadastralLots = Array.from(new Set(
        (Array.isArray(req.body.cadastralLots)
          ? req.body.cadastralLots
          : String(req.body.cadastral_lot_no || '').split(','))
          .map((item) => String(item).trim())
          .filter(Boolean)
      ));

      const [currentLotRows] = await connection.query(
        `
          SELECT
            c.lot_project_cadastral_lot_number_id,
            c.lot_project_cadastral_lot_number
          FROM lot_project_listing_cadastral_lots lcl
          INNER JOIN lot_project_cadastral_lot_numbers c
            ON c.lot_project_cadastral_lot_number_id = lcl.lot_project_cadastral_lot_number_id
          WHERE lcl.lot_project_listing_id = ?
            AND c.lot_project_id = ?
        `,
        [existingListing.lot_project_listing_id, project.lot_project_id]
      );
      const currentByNumber = new Map(currentLotRows.map((row) => [String(row.lot_project_cadastral_lot_number), Number(row.lot_project_cadastral_lot_number_id)]));
      let requestedByNumber = new Map();

      if (requestedCadastralLots.length > 0) {
        const [requestedLotRows] = await connection.query(
          `
            SELECT lot_project_cadastral_lot_number_id, lot_project_cadastral_lot_number
            FROM lot_project_cadastral_lot_numbers
            WHERE lot_project_id = ?
              AND lot_project_cadastral_lot_number IN (${requestedCadastralLots.map(() => '?').join(', ')})
          `,
          [project.lot_project_id, ...requestedCadastralLots]
        );
        requestedByNumber = new Map(requestedLotRows.map((row) => [String(row.lot_project_cadastral_lot_number), Number(row.lot_project_cadastral_lot_number_id)]));
        const missingLots = requestedCadastralLots.filter((lotNumber) => !requestedByNumber.has(lotNumber));
        if (missingLots.length) {
          throw Object.assign(new Error(`Unknown cadastral lot number(s): ${missingLots.join(', ')}.`), { statusCode: 400 });
        }
      }

      const removedIds = [...currentByNumber.entries()]
        .filter(([lotNumber]) => !requestedByNumber.has(lotNumber))
        .map(([, id]) => id);
      const addedIds = [...requestedByNumber.entries()]
        .filter(([lotNumber]) => !currentByNumber.has(lotNumber))
        .map(([, id]) => id);

      if (removedIds.length) {
        await connection.query(
          `DELETE FROM lot_project_listing_cadastral_lots WHERE lot_project_listing_id = ? AND lot_project_cadastral_lot_number_id IN (${removedIds.map(() => '?').join(', ')})`,
          [existingListing.lot_project_listing_id, ...removedIds]
        );
      }
      if (addedIds.length) {
        await connection.query(
          `
            INSERT INTO lot_project_listing_cadastral_lots (
              lot_project_listing_id,
              lot_project_cadastral_lot_number_id
            ) VALUES ${addedIds.map(() => '(?, ?)').join(', ')}
          `,
          addedIds.flatMap((id) => [existingListing.lot_project_listing_id, id])
        );
      }
      cadastralSyncResult = { added: addedIds.length, removed: removedIds.length, skipped: addedIds.length === 0 && removedIds.length === 0 };
    }

    let listingDocumentSyncResult = { count: null, skipped: true };
    if (Array.isArray(req.body.documentRequirements)) {
      const requestedListingDocuments = req.body.documentRequirements.length
        ? req.body.documentRequirements
        : await getProjectDefaultDocuments(project.lot_project_id);
      const requestedClean = normalizeListingDocumentRequirements(requestedListingDocuments);
      const [currentDocumentRows] = await connection.query(
        `
          SELECT document_id, lot_project_listing_document_is_required, lot_project_listing_document_responsible_party, lot_project_listing_document_status
          FROM lot_project_listing_documents
          WHERE lot_project_id = ? AND lot_project_listing_id = ?
        `,
        [project.lot_project_id, existingListing.lot_project_listing_id]
      );
      const signature = (rows) => rows
        .map((row) => `${Number(row.document_id)}:${Number((row.is_required ?? row.lot_project_listing_document_is_required) || 0)}:${String((row.responsible_party ?? row.lot_project_listing_document_responsible_party) || 'client').toLowerCase()}:${String((row.status ?? row.lot_project_listing_document_status) || 'active').toLowerCase()}`)
        .sort()
        .join('|');
      const currentSignature = signature(currentDocumentRows);
      const requestedSignature = signature(requestedClean);

      if (currentSignature !== requestedSignature) {
        listingDocumentSyncResult = await replaceListingDocumentRequirements(
          connection,
          project.lot_project_id,
          existingListing.lot_project_listing_id,
          requestedListingDocuments
        );
      }
    }

    const soaSyncResult = annualInterestChanged
      ? await syncListingInterestToUnlockedSoa(connection, project.lot_project_id, existingListing.lot_project_listing_id, annualInterestRate)
      : { synced: 0, skipped: 0 };

    const auditTitle = statusTransitionAction === LISTING_STATUS_ACTIONS.VOID_UNPAID_CANCELLATION
      ? 'Voided unpaid reservation'
      : statusTransitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION
      ? 'Cancelled pending cancellation'
      : statusTransitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION
        ? 'Settled listing cancellation'
        : 'Updated listing details';
    const auditDescription = statusTransitionAction === LISTING_STATUS_ACTIONS.VOID_UNPAID_CANCELLATION
      ? `Returned ${unitCode} to Available and removed the unpaid buyer account without creating Buyer Account History.`
      : statusTransitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION
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
        voidUnpaidAccount,
        saleArchiveResult,
        cancellationSettlement,
        soaSyncResult,
        cloudinarySyncResult,
        listingDocumentSyncResult,
        cadastralSyncResult,
        changes: {
          unitIdChanged,
          statusChanged,
          annualInterestChanged,
        },
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: voidUnpaidAccount
        ? `${unitCode} returned to Available. The unpaid reservation was voided and was not saved to Buyer Account History.`
        : resetToAvailable
        ? `${unitCode} changed to Available. The cancelled buyer account and all payment, SOA, document, commission, receipt, and audit records were retained in Account History.`
        : statusTransitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION
          ? `${unitCode} returned to Sold / Active. Existing buyer, payment, SOA, document, and commission records were kept.`
          : statusTransitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION
            ? `${unitCode} cancellation settlement completed.`
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
    const storageCode = createListingStorageCode(listingId);
    if (await columnExists(connection, 'lot_project_listings', 'lot_project_listing_storage_code')) {
      await connection.query(
        `UPDATE lot_project_listings SET lot_project_listing_storage_code = ? WHERE lot_project_listing_id = ?`,
        [storageCode, listingId]
      );
    }

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

    const requestedDocuments = Array.isArray(req.body.documentRequirements)
      ? req.body.documentRequirements
      : [];
    const listingDocuments = requestedDocuments.length
      ? requestedDocuments
      : await getProjectDefaultDocuments(project.lot_project_id);

    await replaceListingDocumentRequirements(
      connection,
      project.lot_project_id,
      listingId,
      listingDocuments
    );

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Listings',
      entityType: 'lot_project_listing',
      entityId: String(listingId),
      entityLabel: `Unit ${unitCode} — ${project.lot_project_name}`,
      title: 'Added new listing',
      description: `Added ${unitCode} to ${project.lot_project_name}.`,
      metadata: { unitCode, storageCode, status: listingStatus.status, soldSubstatus: listingStatus.soldSubstatus },
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `${unitCode} added successfully.`,
      listing_id: listingId,
      storage_code: storageCode,
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

    // A listing can only be removed when it has never been assigned to a buyer.
    // Closed buyer accounts are purged through the password + email-code workflow.
    const protectedHistoryTables = [
      'lot_project_accounts',
      'lot_project_client_profiles',
      'lot_project_reservation_history',
      'lot_project_payments',
    ];
    for (const tableName of protectedHistoryTables) {
      if (!(await tableExists(connection, tableName))) continue;
      const [historyRows] = await connection.query(
        `SELECT COUNT(*) AS total FROM ${tableName} WHERE lot_project_listing_id = ?`,
        [existingListing.lot_project_listing_id]
      );
      if (Number(historyRows[0]?.total || 0) > 0) {
        await connection.rollback();
        return res.status(409).json({
          message: 'This listing has buyer-account history and cannot be deleted. Close the account first, then use Permanently Delete Account Records from Account History if removal is required.',
        });
      }
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

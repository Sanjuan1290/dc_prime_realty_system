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
  getReserveSellerOptions,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';

const getColumnDefinition = async (connection, tableName, columnName) => {
  const [rows] = await connection.query(
    `SHOW COLUMNS FROM ${tableName} LIKE ?`,
    [columnName]
  );

  return rows[0] || null;
};

const listingStatusAllowsHold = async (connection) => {
  const column = await getColumnDefinition(connection, 'lot_project_listings', 'lot_project_listing_status');
  return String(column?.Type || '').includes("'hold'");
};

const getRowUnpaidAmount = (row = {}) => roundMoneyValue(
  Math.max(getScheduleTotalDue(row) - Number(row.amountPaid || 0), 0)
);

const applyActualPaymentStateToListing = (listing = {}, soaRows = []) => {
  if (!soaRows.length) return listing;

  const lastRow = soaRows[soaRows.length - 1] || {};
  const actualRemainingBalance = roundMoneyValue(Number(lastRow.endingBalance || 0));
  const unpaidScheduledDue = roundMoneyValue(
    soaRows.reduce((sum, row) => sum + getRowUnpaidAmount(row), 0)
  );
  const paymentCount = Number(listing.payment_count || listing.paymentCount || 0);
  const isFullyPaid = actualRemainingBalance <= 0.009 && unpaidScheduledDue <= 0.009 && paymentCount > 0;

  const nextListing = {
    ...listing,
    balance: money(actualRemainingBalance),
    balanceAmount: actualRemainingBalance,
    unpaidScheduledDue,
    payment_status: paymentCount === 0 ? 'Unpaid' : isFullyPaid ? 'Paid' : 'Partial',
  };

  if (isFullyPaid && String(nextListing.rawStatus || '').toLowerCase() === 'sold') {
    nextListing.listing_status = 'Fully Paid';
    nextListing.status = 'Fully Paid';
    nextListing.soldSubstatus = 'fully_paid';
  }

  return nextListing;
};

export const getLotProjectListingProfile = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });
    if (!(await tableExists(connection, 'lot_project_listings'))) {
      return res.status(500).json({ message: 'lot_project_listings table does not exist.' });
    }

    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');
    const hasAnnualInterestRate = await columnExists(connection, 'lot_project_listings', 'annual_interest_rate');
    const hasAssignedSellerColumn = await columnExists(connection, 'lot_project_client_profiles', 'assigned_accredited_seller_id');
    const hasSellerPrcNo = await columnExists(connection, 'users', 'prc_no');
    const hasSellerAddress = await columnExists(connection, 'users', 'address');
    const lookup = getListingLookupWhere(listingLookup);

    const cadastralSelect = hasListingCadastralLinks
      ? `(
          SELECT GROUP_CONCAT(c.lot_project_cadastral_lot_number ORDER BY c.lot_project_cadastral_lot_number SEPARATOR ', ')
          FROM lot_project_listing_cadastral_lots lcl
          INNER JOIN lot_project_cadastral_lot_numbers c
            ON c.lot_project_cadastral_lot_number_id = lcl.lot_project_cadastral_lot_number_id
          WHERE lcl.lot_project_listing_id = l.lot_project_listing_id
        ) AS cadastral_lots,`
      : `NULL AS cadastral_lots,`;

    const annualInterestSelect = hasAnnualInterestRate ? 'l.annual_interest_rate,' : '0 AS annual_interest_rate,';
    const sellerNameSelect = hasAssignedSellerColumn
      ? `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', assignedSeller.first_name, assignedSeller.middle_name, assignedSeller.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', seller.first_name, seller.middle_name, seller.last_name)), '')) AS seller_name,`
      : `NULLIF(TRIM(CONCAT_WS(' ', seller.first_name, seller.middle_name, seller.last_name)), '') AS seller_name,`;
    const sellerRoleSelect = hasAssignedSellerColumn
      ? `COALESCE(assignedSeller.role, seller.role) AS seller_role,`
      : `seller.role AS seller_role,`;
    const sellerEmailSelect = hasAssignedSellerColumn
      ? `COALESCE(assignedSeller.email, seller.email) AS seller_email,`
      : `seller.email AS seller_email,`;
    const sellerContactSelect = hasAssignedSellerColumn
      ? `COALESCE(assignedSeller.contact_no, seller.contact_no) AS seller_contact_no,`
      : `seller.contact_no AS seller_contact_no,`;
    const sellerTinSelect = hasAssignedSellerColumn
      ? `COALESCE(NULLIF(assignedSeller.tin_no, ''), NULLIF(seller.tin_no, '')) AS seller_tin_no,`
      : `NULLIF(seller.tin_no, '') AS seller_tin_no,`;
    const sellerFirstNameSelect = hasAssignedSellerColumn
      ? `COALESCE(NULLIF(assignedSeller.first_name, ''), NULLIF(seller.first_name, '')) AS seller_first_name,`
      : `NULLIF(seller.first_name, '') AS seller_first_name,`;
    const sellerMiddleNameSelect = hasAssignedSellerColumn
      ? `COALESCE(NULLIF(assignedSeller.middle_name, ''), NULLIF(seller.middle_name, '')) AS seller_middle_name,`
      : `NULLIF(seller.middle_name, '') AS seller_middle_name,`;
    const sellerLastNameSelect = hasAssignedSellerColumn
      ? `COALESCE(NULLIF(assignedSeller.last_name, ''), NULLIF(seller.last_name, '')) AS seller_last_name,`
      : `NULLIF(seller.last_name, '') AS seller_last_name,`;
    const sellerPrcSelect = hasSellerPrcNo
      ? (hasAssignedSellerColumn
        ? `COALESCE(NULLIF(assignedSeller.prc_no, ''), NULLIF(seller.prc_no, '')) AS seller_prc_no,`
        : `NULLIF(seller.prc_no, '') AS seller_prc_no,`)
      : `NULL AS seller_prc_no,`;
    const sellerAddressSelect = hasSellerAddress
      ? (hasAssignedSellerColumn
        ? `COALESCE(NULLIF(assignedSeller.address, ''), NULLIF(seller.address, '')) AS seller_address,`
        : `NULLIF(seller.address, '') AS seller_address,`)
      : `NULL AS seller_address,`;
    const sellerGroupSelect = hasAssignedSellerColumn
      ? `COALESCE(assignedSg.seller_group_name, sg.seller_group_name) AS seller_group_name,`
      : `sg.seller_group_name AS seller_group_name,`;
    const sellerStatusSelect = hasAssignedSellerColumn
      ? `COALESCE(assignedAcs.accredited_seller_status, acs.accredited_seller_status) AS seller_status,`
      : `acs.accredited_seller_status AS seller_status,`;
    const sellerAccreditationSelect = hasAssignedSellerColumn
      ? `COALESCE(assignedAcs.accredited_seller_accreditation_date, acs.accredited_seller_accreditation_date) AS seller_accreditation_date,`
      : `acs.accredited_seller_accreditation_date AS seller_accreditation_date,`;
    const reportsUnderSelect = hasAssignedSellerColumn
      ? `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', assignedReports.first_name, assignedReports.middle_name, assignedReports.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', sellerReports.first_name, sellerReports.middle_name, sellerReports.last_name)), '')) AS reports_under,`
      : `NULLIF(TRIM(CONCAT_WS(' ', sellerReports.first_name, sellerReports.middle_name, sellerReports.last_name)), '') AS reports_under,`;
    const assignedUserSelect = hasAssignedSellerColumn
      ? `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', assignedSeller.first_name, assignedSeller.middle_name, assignedSeller.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', seller.first_name, seller.middle_name, seller.last_name)), '')) AS assigned_user_name`
      : `NULLIF(TRIM(CONCAT_WS(' ', seller.first_name, seller.middle_name, seller.last_name)), '') AS assigned_user_name`;
    const assignedSellerJoin = hasAssignedSellerColumn
      ? `LEFT JOIN accredited_sellers assignedAcs ON assignedAcs.accredited_seller_id = cp.assigned_accredited_seller_id
         LEFT JOIN users assignedSeller ON assignedSeller.id = assignedAcs.user_id
         LEFT JOIN seller_groups assignedSg ON assignedSg.seller_group_id = assignedAcs.seller_group_id
         LEFT JOIN users assignedReports ON assignedReports.id = assignedAcs.accredited_seller_reports_under_user_id`
      : ``;

    const [rows] = await connection.query(
      `
        SELECT
          l.*,
          ${annualInterestSelect}
          ${cadastralSelect}
          cp.*,
          payment_summary.total_paid,
          payment_summary.payment_count,
          payment_summary.latest_payment_date,
          payment_summary.latest_payment_amount,
          COALESCE(cp.soa_first_due_date, schedule_summary.first_due_date) AS first_due_date,
          ${sellerNameSelect}
          ${sellerRoleSelect}
          ${sellerEmailSelect}
          ${sellerContactSelect}
          ${sellerTinSelect}
          ${sellerFirstNameSelect}
          ${sellerMiddleNameSelect}
          ${sellerLastNameSelect}
          ${sellerPrcSelect}
          ${sellerAddressSelect}
          ${sellerGroupSelect}
          ${sellerStatusSelect}
          ${sellerAccreditationSelect}
          ${reportsUnderSelect}
          commission.commission_rate,
          commission.gross_commission_amount,
          commission.released_commission_amount AS released_amount,
          commission.commission_status,
          ${assignedUserSelect}
        FROM lot_project_listings l
        LEFT JOIN lot_project_client_profiles cp
          ON cp.lot_project_listing_id = l.lot_project_listing_id
        LEFT JOIN (
          SELECT
            lot_project_listing_id,
            COALESCE(SUM(lot_project_payment_amount), 0) AS total_paid,
            COUNT(*) AS payment_count,
            MAX(lot_project_payment_date) AS latest_payment_date,
            SUBSTRING_INDEX(GROUP_CONCAT(lot_project_payment_amount ORDER BY lot_project_payment_date DESC, lot_project_payment_id DESC), ',', 1) AS latest_payment_amount
          FROM lot_project_payments
          WHERE lot_project_payment_status = 'Verified'
          GROUP BY lot_project_listing_id
        ) payment_summary ON payment_summary.lot_project_listing_id = l.lot_project_listing_id
        LEFT JOIN (
          SELECT
            lot_project_listing_id,
            COALESCE(
              MIN(CASE WHEN schedule_status IN ('Unpaid', 'Partial') AND LOWER(description) NOT LIKE '%reservation%' THEN due_date END),
              MIN(CASE WHEN LOWER(description) LIKE '%downpayment%' THEN due_date END),
              MIN(CASE WHEN LOWER(description) LIKE '%monthly%' THEN due_date END),
              MIN(due_date)
            ) AS first_due_date
          FROM lot_project_payment_schedules
          GROUP BY lot_project_listing_id
        ) schedule_summary ON schedule_summary.lot_project_listing_id = l.lot_project_listing_id
        LEFT JOIN (
          SELECT
            lot_project_listing_id,
            CAST(SUBSTRING_INDEX(
              GROUP_CONCAT(
                accredited_seller_id
                ORDER BY FIELD(commission_seller_type, 'selling_agent', 'main_seller', 'hierarchy_seller'), lot_project_commission_id
                SEPARATOR ','
              ),
              ',',
              1
            ) AS UNSIGNED) AS accredited_seller_id,
            SUM(commission_rate) AS commission_rate,
            SUM(gross_commission_amount) AS gross_commission_amount,
            SUM(released_commission_amount) AS released_commission_amount,
            CASE
              WHEN SUM(commission_status = 'Cancelled') = COUNT(*) THEN 'Cancelled'
              WHEN SUM(commission_status = 'On Hold') > 0 THEN 'On Hold'
              WHEN SUM(commission_status = 'Released') = COUNT(*) THEN 'Released'
              WHEN SUM(commission_status IN ('Released', 'Partially Released')) > 0 THEN 'Partially Released'
              WHEN SUM(commission_status = 'Eligible') > 0 THEN 'Eligible'
              ELSE 'Pending'
            END AS commission_status
          FROM lot_project_commissions
          GROUP BY lot_project_listing_id
        ) commission ON commission.lot_project_listing_id = l.lot_project_listing_id
        ${assignedSellerJoin}
        LEFT JOIN accredited_sellers acs ON acs.accredited_seller_id = commission.accredited_seller_id
        LEFT JOIN users seller ON seller.id = acs.user_id
        LEFT JOIN seller_groups sg ON sg.seller_group_id = acs.seller_group_id
        LEFT JOIN users sellerReports ON sellerReports.id = acs.accredited_seller_reports_under_user_id
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Listing not found.' });

    const documents = await getListingDocuments(connection, project.lot_project_id, row.lot_project_listing_id, row.lot_project_client_profile_id);
    const payments = await getListingPayments(connection, project.lot_project_id, row.lot_project_listing_id);
    const soaRows = await getListingSoaRows(connection, project.lot_project_id, row.lot_project_listing_id, row, payments);
    const cadastralLots = await getProjectCadastralLots(project.lot_project_id);
    const defaultDocuments = await getProjectDefaultDocuments(project.lot_project_id);
    const sellerOptions = await getReserveSellerOptions(connection, project.lot_project_id);
    const sellerName = row.seller_name || '-';
    const canEditBuyerProfile = canEditBuyerProfileForListing(row.lot_project_listing_status);
    const clientProfile = canEditBuyerProfile
      ? mapClientProfile(row, sellerName)
      : { profileStatus: 'not_reserved', buyerType: 'single', seller: '-' };

    return res.json({
      success: true,
      data: {
        project: {
          ...project,
          id: project.lot_project_id,
          name: project.lot_project_name,
          slug: project.lot_project_slug,
          location: project.lot_project_location,
          locationCode: project.lot_project_location_code,
          administrator: project.lot_project_administrator_name,
          cadastralLots,
          defaultDocuments,
        },
        listing: applyActualPaymentStateToListing(mapProfileListing(row, project, documents), soaRows),
        client: clientProfile,
        soaRows,
        payments,
        documents,
        reserveOptions: {
          sellers: sellerOptions,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
export const holdLotProjectListing = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const clientName = String(req.body.clientName || req.body.hold_client_name || '').trim();
    const holdNote = String(req.body.note || req.body.hold_note || '').trim();

    if (!clientName) return res.status(400).json({ message: 'Client name is required.' });

    const project = await getProjectBySlug(slug);
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });

    const lookup = getListingLookupWhere(listingLookup);
    const [rows] = await connection.query(
      `
        SELECT l.*
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const listing = rows[0];
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (listing.lot_project_listing_status !== 'available') {
      return res.status(400).json({ message: 'Only available listings can be put on hold.' });
    }

    if (!(await listingStatusAllowsHold(connection))) {
      return res.status(400).json({
        message: "Listing status enum is missing 'hold'. Run server/migrations/20260708_fix_hold_listing_fields.sql first.",
      });
    }

    const requiredHoldColumns = ['hold_client_name', 'hold_note', 'hold_created_at', 'hold_created_by_user_id'];
    for (const column of requiredHoldColumns) {
      if (!(await columnExists(connection, 'lot_project_listings', column))) {
        return res.status(400).json({ message: 'Hold fields are missing. Run server/migrations/20260708_fix_hold_listing_fields.sql first.' });
      }
    }

    const updateColumns = [
      'lot_project_listing_status = ?',
      'hold_client_name = ?',
      'hold_note = ?',
      'hold_created_at = NOW()',
      'hold_created_by_user_id = ?',
    ];
    const updateParams = ['hold', clientName, holdNote || null, req.user?.id || null];

    if (await columnExists(connection, 'lot_project_listings', 'lot_project_listing_sold_substatus')) {
      updateColumns.splice(1, 0, 'lot_project_listing_sold_substatus = NULL');
    }

    updateParams.push(project.lot_project_id, listing.lot_project_listing_id);

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE lot_project_listings
        SET ${updateColumns.join(', ')}
        WHERE lot_project_id = ?
          AND lot_project_listing_id = ?
      `,
      updateParams
    );

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Listings',
      entityType: 'lot_project_listing',
      entityId: String(listing.lot_project_listing_id),
      entityLabel: `Unit ${listing.lot_project_listing_unit_id} — ${project.lot_project_name}`,
      title: 'Placed listing on hold',
      description: `Placed ${listing.lot_project_listing_unit_id} on hold for ${clientName}.`,
      metadata: { clientName, holdNote },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: `Listing held for ${clientName}.`,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    console.error('Hold listing failed:', {
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      sqlMessage: error?.sqlMessage,
    });

    const sqlMessage = String(error?.sqlMessage || error?.message || '');

    if (sqlMessage.includes('lot_project_listing_sold_substatus')) {
      return res.status(400).json({
        message: 'Hold failed because your database is missing lot_project_listing_sold_substatus. Apply the latest listing schema/migration or use the updated Hold controller that checks this column first.',
      });
    }

    if (sqlMessage.toLowerCase().includes('data truncated') || sqlMessage.includes("lot_project_listing_status")) {
      return res.status(400).json({
        message: "Hold failed because the lot_project_listing_status enum in your active database does not allow 'hold'. Run SHOW COLUMNS FROM lot_project_listings LIKE 'lot_project_listing_status' and update the enum to include hold.",
      });
    }

    if (sqlMessage.includes('hold_client_name') || sqlMessage.includes('hold_note') || sqlMessage.includes('hold_created_at') || sqlMessage.includes('hold_created_by_user_id')) {
      return res.status(400).json({
        message: 'Hold failed because one or more hold columns are missing. Run the hold fields migration on the same database your server is using.',
      });
    }

    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const unholdLotProjectListing = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();

    const project = await getProjectBySlug(slug);
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });

    const lookup = getListingLookupWhere(listingLookup);
    const [rows] = await connection.query(
      `
        SELECT l.*
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const listing = rows[0];
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (listing.lot_project_listing_status !== 'hold') {
      return res.status(400).json({ message: 'Only held listings can be unheld.' });
    }

    const updateColumns = [
      'lot_project_listing_status = ?',
    ];
    const updateParams = ['available'];

    if (await columnExists(connection, 'lot_project_listings', 'lot_project_listing_sold_substatus')) {
      updateColumns.push('lot_project_listing_sold_substatus = NULL');
    }

    const holdColumns = ['hold_client_name', 'hold_note', 'hold_created_at', 'hold_created_by_user_id'];
    for (const column of holdColumns) {
      if (await columnExists(connection, 'lot_project_listings', column)) {
        updateColumns.push(`${column} = NULL`);
      }
    }

    updateParams.push(project.lot_project_id, listing.lot_project_listing_id);

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE lot_project_listings
        SET ${updateColumns.join(', ')}
        WHERE lot_project_id = ?
          AND lot_project_listing_id = ?
      `,
      updateParams
    );

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Listings',
      entityType: 'lot_project_listing',
      entityId: String(listing.lot_project_listing_id),
      entityLabel: `Unit ${listing.lot_project_listing_unit_id} — ${project.lot_project_name}`,
      title: 'Removed listing hold',
      description: `Returned ${listing.lot_project_listing_unit_id} to available status.`,
      metadata: { previousHoldClientName: listing.hold_client_name || null },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: 'Listing returned to available.',
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    console.error('Unhold listing failed:', {
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      sqlMessage: error?.sqlMessage,
    });

    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};



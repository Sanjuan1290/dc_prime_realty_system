import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getProjectDefaultDocuments,
  getProjectCadastralLots,
  mapListingRow,
  formatDocumentsLabel,
  todayDateOnly,
} from '../_shared/lotProject.shared.js';

const toNumber = (value) => Number(value || 0);

const buildProjectPayload = async (project) => {
  const cadastralLots = await getProjectCadastralLots(project.lot_project_id);
  const defaultDocuments = await getProjectDefaultDocuments(project.lot_project_id);

  return {
    ...project,
    id: project.lot_project_id,
    name: project.lot_project_name,
    location: project.lot_project_location,
    locationCode: project.lot_project_location_code,
    cadastralLots,
    defaultDocuments,
  };
};

export const getLotProjectDashboard = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    const projectPayload = await buildProjectPayload(project);
    const hasListings = await tableExists(connection, 'lot_project_listings');

    const emptyStats = {
      totalUnits: 0,
      available: 0,
      hold: 0,
      soldActive: 0,
      fullyPaid: 0,
      pendingCancellation: 0,
      cancelled: 0,
      totalContractPrice: 0,
      totalSales: 0,
      totalCollected: 0,
      pendingSales: 0,
      outstandingBalance: 0,
      collectionProgress: 0,
      listedLotValue: 0,
      availableLotValue: 0,
      soldLotValue: 0,
      totalCommission: 0,
      grossCommission: 0,
      eligibleCommission: 0,
      releasedCommission: 0,
      cashAdvanceDeductions: 0,
      netRemainingCommission: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      upcomingDueAmount: 0,
    };

    if (!hasListings) {
      return res.json({
        success: true,
        data: {
          project: projectPayload,
          stats: emptyStats,
          recentUnits: [],
          upcomingDues: [],
          sellerPerformance: [],
          groupPerformance: [],
        },
      });
    }

    const hasPayments = await tableExists(connection, 'lot_project_payments');
    const hasSchedules = await tableExists(connection, 'lot_project_payment_schedules');
    const hasCommissions = await tableExists(connection, 'lot_project_commissions');
    const hasCommissionReleases = await tableExists(connection, 'lot_project_commission_releases');
    const hasClientProfiles = await tableExists(connection, 'lot_project_client_profiles');
    const hasListingDocuments = await tableExists(connection, 'lot_project_listing_documents');
    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');

    const paymentSummarySelect = hasPayments
      ? `COALESCE((
          SELECT SUM(p.lot_project_payment_amount)
          FROM lot_project_payments p
          WHERE p.lot_project_id = l.lot_project_id
            AND p.lot_project_listing_id = l.lot_project_listing_id
            AND p.lot_project_payment_status = 'Verified'
        ), 0)`
      : '0';

    const releaseSummaryJoin = hasCommissionReleases
      ? `
        LEFT JOIN (
          SELECT
            lot_project_commission_id,
            COALESCE(SUM(CASE WHEN release_status = 'Eligible' THEN net_release_amount ELSE 0 END), 0) AS eligible_amount,
            COALESCE(SUM(CASE WHEN release_status = 'Released' THEN net_release_amount ELSE 0 END), 0) AS released_amount,
            COALESCE(SUM(deduction_amount), 0) AS deduction_amount
          FROM lot_project_commission_releases
          GROUP BY lot_project_commission_id
        ) release_summary ON release_summary.lot_project_commission_id = c.lot_project_commission_id
      `
      : '';

    const releaseEligibleExpr = hasCommissionReleases
      ? 'COALESCE(release_summary.eligible_amount, 0)'
      : `CASE WHEN c.commission_status = 'Eligible' THEN c.net_remaining_commission_amount ELSE 0 END`;
    const releaseReleasedExpr = hasCommissionReleases
      ? 'COALESCE(release_summary.released_amount, 0)'
      : 'c.released_commission_amount';
    const releaseDeductionExpr = hasCommissionReleases
      ? 'COALESCE(release_summary.deduction_amount, 0)'
      : '0';

    const [summaryRows] = await connection.query(
      `
        SELECT
          COUNT(*) AS totalUnits,
          SUM(lot_project_listing_status = 'available') AS available,
          SUM(lot_project_listing_status = 'hold') AS hold,
          SUM(lot_project_listing_status = 'sold' AND COALESCE(lot_project_listing_sold_substatus, 'active') = 'active') AS soldActive,
          SUM(lot_project_listing_status = 'sold' AND lot_project_listing_sold_substatus = 'fully_paid') AS fullyPaid,
          SUM(lot_project_listing_status = 'pending_for_cancellation') AS pendingCancellation,
          SUM(lot_project_listing_status = 'cancelled') AS cancelled,
          COALESCE(SUM(lot_project_listing_tcp), 0) AS totalContractPrice,
          COALESCE(SUM(CASE WHEN lot_project_listing_status <> 'cancelled' THEN lot_project_listing_tcp ELSE 0 END), 0) AS listedLotValue,
          COALESCE(SUM(CASE WHEN lot_project_listing_status IN ('available', 'hold') THEN lot_project_listing_tcp ELSE 0 END), 0) AS availableLotValue,
          COALESCE(SUM(CASE WHEN lot_project_listing_status = 'sold' THEN lot_project_listing_tcp ELSE 0 END), 0) AS soldLotValue
        FROM lot_project_listings
        WHERE lot_project_id = ?
      `,
      [project.lot_project_id]
    );

    const [moneyRows] = await connection.query(
      `
        SELECT
          COALESCE(SUM(l.lot_project_listing_tcp), 0) AS totalSales,
          COALESCE(SUM(${paymentSummarySelect}), 0) AS totalCollected,
          COALESCE(SUM(l.lot_project_listing_tcp - ${paymentSummarySelect}), 0) AS pendingSales
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
          AND l.lot_project_listing_status IN ('sold', 'pending_for_cancellation', 'cancelled')
      `,
      [project.lot_project_id]
    );

    const [commissionRows] = hasCommissions
      ? await connection.query(
          `
            SELECT
              COALESCE(SUM(c.gross_commission_amount), 0) AS totalCommission,
              COALESCE(SUM(${releaseEligibleExpr}), 0) AS eligibleCommission,
              COALESCE(SUM(${releaseReleasedExpr}), 0) AS releasedCommission,
              COALESCE(SUM(${releaseDeductionExpr}), 0) AS cashAdvanceDeductions,
              COALESCE(SUM(GREATEST(c.gross_commission_amount - ${releaseReleasedExpr} - ${releaseDeductionExpr}, 0)), 0) AS netRemainingCommission
            FROM lot_project_commissions c
            ${releaseSummaryJoin}
            WHERE c.lot_project_id = ?
          `,
          [project.lot_project_id]
        )
      : [[{
          totalCommission: 0,
          eligibleCommission: 0,
          releasedCommission: 0,
          cashAdvanceDeductions: 0,
          netRemainingCommission: 0,
        }]];

    const dueDiscountExpr = `CASE
      WHEN LOWER(s.description) LIKE '%downpayment%' OR LOWER(s.description) LIKE '%down payment%'
        THEN ROUND(s.due_amount * (COALESCE(cp.soa_dp_discount_percentage, 0) / 100), 2)
      ELSE 0
    END`;
    const dueBalanceExpr = `GREATEST((s.due_amount + s.penalty_amount - ${dueDiscountExpr}) - s.amount_paid, 0)`;

    const [scheduleRows] = hasSchedules
      ? await connection.query(
          `
            SELECT
              COALESCE(SUM(s.due_date < CURDATE() AND s.schedule_status IN ('Unpaid', 'Partial', 'Overdue') AND ${dueBalanceExpr} > 0), 0) AS overdueCount,
              COALESCE(SUM(s.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND s.schedule_status IN ('Unpaid', 'Partial', 'Overdue') AND ${dueBalanceExpr} > 0), 0) AS dueSoonCount,
              COALESCE(SUM(CASE
                WHEN s.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                  AND s.schedule_status IN ('Unpaid', 'Partial', 'Overdue')
                  THEN ${dueBalanceExpr}
                ELSE 0
              END), 0) AS upcomingDueAmount
            FROM lot_project_payment_schedules s
            LEFT JOIN lot_project_client_profiles cp
              ON cp.lot_project_client_profile_id = s.lot_project_client_profile_id
            WHERE s.lot_project_id = ?
              AND s.due_date IS NOT NULL
          `,
          [project.lot_project_id]
        )
      : [[{ overdueCount: 0, dueSoonCount: 0, upcomingDueAmount: 0 }]];

    const [upcomingDueRows] = hasSchedules
      ? await connection.query(
          `
            SELECT
              s.lot_project_payment_schedule_id,
              s.due_date,
              s.description,
              s.due_amount,
              s.penalty_amount,
              s.amount_paid,
              ${dueDiscountExpr} AS discount_amount,
              ${dueBalanceExpr} AS balance_due,
              l.lot_project_listing_unit_id,
              cp.buyer_full_name
            FROM lot_project_payment_schedules s
            INNER JOIN lot_project_listings l
              ON l.lot_project_listing_id = s.lot_project_listing_id
            LEFT JOIN lot_project_client_profiles cp
              ON cp.lot_project_client_profile_id = s.lot_project_client_profile_id
            WHERE s.lot_project_id = ?
              AND s.due_date IS NOT NULL
              AND s.schedule_status IN ('Unpaid', 'Partial', 'Overdue')
              AND s.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
              AND ${dueBalanceExpr} > 0
            ORDER BY s.due_date ASC, l.lot_project_listing_unit_id ASC, s.lot_project_payment_schedule_id ASC
            LIMIT 8
          `,
          [project.lot_project_id]
        )
      : [[]];

    const sellerPerformanceQuery = hasCommissions
      ? `
        SELECT
          acs.accredited_seller_id,
          sg.seller_group_id,
          COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)), ''), 'Unassigned Seller') AS seller_name,
          u.role AS seller_role,
          COALESCE(sg.seller_group_name, 'No Group') AS seller_group_name,
          COUNT(DISTINCT c.lot_project_listing_id) AS unit_count,
          COALESCE(SUM(c.gross_commission_amount), 0) AS gross_commission,
          COALESCE(SUM(${releaseEligibleExpr}), 0) AS eligible_commission,
          COALESCE(SUM(${releaseReleasedExpr}), 0) AS released_commission,
          COALESCE(SUM(${releaseDeductionExpr}), 0) AS deduction_amount,
          COALESCE(SUM(GREATEST(c.gross_commission_amount - ${releaseReleasedExpr} - ${releaseDeductionExpr}, 0)), 0) AS remaining_commission
        FROM lot_project_commissions c
        LEFT JOIN accredited_sellers acs
          ON acs.accredited_seller_id = c.accredited_seller_id
        LEFT JOIN users u
          ON u.id = acs.user_id
        LEFT JOIN seller_groups sg
          ON sg.seller_group_id = acs.seller_group_id
        ${releaseSummaryJoin}
        WHERE c.lot_project_id = ?
        GROUP BY acs.accredited_seller_id, sg.seller_group_id, u.first_name, u.middle_name, u.last_name, u.role, sg.seller_group_name
        ORDER BY gross_commission DESC, seller_name ASC
        LIMIT 8
      `
      : '';

    const groupPerformanceQuery = hasCommissions
      ? `
        SELECT
          sg.seller_group_id,
          COALESCE(sg.seller_group_name, 'No Group') AS seller_group_name,
          COUNT(DISTINCT c.lot_project_listing_id) AS unit_count,
          COALESCE(SUM(c.gross_commission_amount), 0) AS gross_commission,
          COALESCE(SUM(${releaseEligibleExpr}), 0) AS eligible_commission,
          COALESCE(SUM(${releaseReleasedExpr}), 0) AS released_commission,
          COALESCE(SUM(${releaseDeductionExpr}), 0) AS deduction_amount,
          COALESCE(SUM(GREATEST(c.gross_commission_amount - ${releaseReleasedExpr} - ${releaseDeductionExpr}, 0)), 0) AS remaining_commission
        FROM lot_project_commissions c
        LEFT JOIN accredited_sellers acs
          ON acs.accredited_seller_id = c.accredited_seller_id
        LEFT JOIN seller_groups sg
          ON sg.seller_group_id = acs.seller_group_id
        ${releaseSummaryJoin}
        WHERE c.lot_project_id = ?
        GROUP BY sg.seller_group_id, sg.seller_group_name
        ORDER BY gross_commission DESC, seller_group_name ASC
        LIMIT 8
      `
      : '';

    const [sellerRows] = hasCommissions
      ? await connection.query(sellerPerformanceQuery, [project.lot_project_id])
      : [[]];

    const [groupRows] = hasCommissions
      ? await connection.query(groupPerformanceQuery, [project.lot_project_id])
      : [[]];

    const cadastralSelect = hasListingCadastralLinks
      ? `(
          SELECT GROUP_CONCAT(c.lot_project_cadastral_lot_number ORDER BY c.lot_project_cadastral_lot_number SEPARATOR ', ')
          FROM lot_project_listing_cadastral_lots lcl
          INNER JOIN lot_project_cadastral_lot_numbers c
            ON c.lot_project_cadastral_lot_number_id = lcl.lot_project_cadastral_lot_number_id
          WHERE lcl.lot_project_listing_id = l.lot_project_listing_id
        ) AS cadastral_lots,`
      : `NULL AS cadastral_lots,`;

    const clientJoin = hasClientProfiles
      ? `LEFT JOIN lot_project_client_profiles cp ON cp.lot_project_listing_id = l.lot_project_listing_id`
      : `LEFT JOIN (SELECT NULL AS lot_project_listing_id, NULL AS buyer_full_name) cp ON 1 = 0`;

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

    const [recentRows] = await connection.query(
      `
        SELECT
          l.*,
          ${cadastralSelect}
          cp.buyer_full_name,
          ${paymentSummarySelect} AS total_paid,
          COALESCE(ldoc.listing_document_count, 0) AS listing_document_count,
          COALESCE(pdoc.project_default_document_count, 0) AS project_default_document_count,
          COALESCE(pdoc.project_required_document_count, 0) AS project_required_document_count
        FROM lot_project_listings l
        ${clientJoin}
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
        WHERE l.lot_project_id = ?
        ORDER BY l.lot_project_listing_updated_at DESC, l.lot_project_listing_id DESC
        LIMIT 8
      `,
      [project.lot_project_id]
    );

    const summary = summaryRows[0] || {};
    const moneySummary = moneyRows[0] || {};
    const commissionSummary = commissionRows[0] || {};
    const scheduleSummary = scheduleRows[0] || {};
    const totalSales = toNumber(moneySummary.totalSales);
    const totalCollected = toNumber(moneySummary.totalCollected);

    return res.json({
      success: true,
      data: {
        project: projectPayload,
        stats: {
          ...emptyStats,
          totalUnits: toNumber(summary.totalUnits),
          available: toNumber(summary.available),
          hold: toNumber(summary.hold),
          soldActive: toNumber(summary.soldActive),
          fullyPaid: toNumber(summary.fullyPaid),
          pendingCancellation: toNumber(summary.pendingCancellation),
          cancelled: toNumber(summary.cancelled),
          totalContractPrice: toNumber(summary.totalContractPrice),
          totalSales,
          totalCollected,
          pendingSales: Math.max(toNumber(moneySummary.pendingSales), 0),
          outstandingBalance: Math.max(toNumber(moneySummary.pendingSales), 0),
          collectionProgress: totalSales > 0 ? Math.min((totalCollected / totalSales) * 100, 100) : 0,
          listedLotValue: toNumber(summary.listedLotValue),
          availableLotValue: toNumber(summary.availableLotValue),
          soldLotValue: toNumber(summary.soldLotValue),
          totalCommission: toNumber(commissionSummary.totalCommission),
          grossCommission: toNumber(commissionSummary.totalCommission),
          eligibleCommission: toNumber(commissionSummary.eligibleCommission),
          releasedCommission: toNumber(commissionSummary.releasedCommission),
          cashAdvanceDeductions: toNumber(commissionSummary.cashAdvanceDeductions),
          netRemainingCommission: toNumber(commissionSummary.netRemainingCommission),
          overdueCount: toNumber(scheduleSummary.overdueCount),
          dueSoonCount: toNumber(scheduleSummary.dueSoonCount),
          upcomingDueAmount: toNumber(scheduleSummary.upcomingDueAmount),
        },
        upcomingDues: upcomingDueRows.map((row) => ({
          id: row.lot_project_payment_schedule_id,
          unit: row.lot_project_listing_unit_id,
          buyer: row.buyer_full_name || '-',
          dueDate: row.due_date,
          description: row.description,
          dueAmount: toNumber(row.due_amount),
          penalty: toNumber(row.penalty_amount),
          paid: toNumber(row.amount_paid),
          discount: toNumber(row.discount_amount),
          balanceDue: toNumber(row.balance_due),
        })),
        sellerPerformance: sellerRows.map((row) => ({
          id: row.accredited_seller_id,
          seller: row.seller_name,
          role: row.seller_role,
          group: row.seller_group_name,
          units: toNumber(row.unit_count),
          grossCommission: toNumber(row.gross_commission),
          eligibleCommission: toNumber(row.eligible_commission),
          releasedCommission: toNumber(row.released_commission),
          cashAdvanceDeductions: toNumber(row.deduction_amount),
          remainingCommission: toNumber(row.remaining_commission),
        })),
        groupPerformance: groupRows.map((row) => ({
          id: row.seller_group_id,
          group: row.seller_group_name,
          units: toNumber(row.unit_count),
          grossCommission: toNumber(row.gross_commission),
          eligibleCommission: toNumber(row.eligible_commission),
          releasedCommission: toNumber(row.released_commission),
          cashAdvanceDeductions: toNumber(row.deduction_amount),
          remainingCommission: toNumber(row.remaining_commission),
        })),
        recentUnits: recentRows.map((row) => ({
          ...mapListingRow(row),
          collected: toNumber(row.total_paid),
          balance: Math.max(toNumber(row.lot_project_listing_tcp) - toNumber(row.total_paid), 0),
          progress: toNumber(row.lot_project_listing_tcp) > 0
            ? `${Math.min((toNumber(row.total_paid) / toNumber(row.lot_project_listing_tcp)) * 100, 100).toFixed(1)}%`
            : '0%',
          documents: formatDocumentsLabel(row),
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


export const getLotProjectPriceList = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    const projectPayload = await buildProjectPayload(project);
    const hasListings = await tableExists(connection, 'lot_project_listings');

    if (!hasListings) {
      return res.json({ success: true, data: { project: projectPayload, listings: [] } });
    }

    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');
    const cadastralSelect = hasListingCadastralLinks
      ? `(
          SELECT GROUP_CONCAT(c.lot_project_cadastral_lot_number ORDER BY c.lot_project_cadastral_lot_number SEPARATOR ', ')
          FROM lot_project_listing_cadastral_lots lcl
          INNER JOIN lot_project_cadastral_lot_numbers c
            ON c.lot_project_cadastral_lot_number_id = lcl.lot_project_cadastral_lot_number_id
          WHERE lcl.lot_project_listing_id = l.lot_project_listing_id
        ) AS cadastral_lots,`
      : `NULL AS cadastral_lots,`;

    const [rows] = await connection.query(
      `
        SELECT
          l.*,
          ${cadastralSelect}
          NULL AS buyer_full_name,
          0 AS listing_document_count,
          0 AS project_default_document_count,
          0 AS project_required_document_count
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
        ORDER BY l.lot_project_listing_unit_id ASC, l.lot_project_listing_id ASC
      `,
      [project.lot_project_id]
    );

    return res.json({
      success: true,
      data: {
        project: projectPayload,
        listings: rows.map(mapListingRow),
        printedAt: todayDateOnly(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

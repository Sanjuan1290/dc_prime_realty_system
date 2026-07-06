import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getProjectDefaultDocuments,
  getProjectCadastralLots,
  mapListingRow,
  formatDocumentsLabel,
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

    if (!hasListings) {
      return res.json({
        success: true,
        data: {
          project: projectPayload,
          stats: {
            totalUnits: 0,
            available: 0,
            soldActive: 0,
            fullyPaid: 0,
            pendingCancellation: 0,
            cancelled: 0,
            totalContractPrice: 0,
            totalCollected: 0,
            outstandingBalance: 0,
            grossCommission: 0,
            overdueCount: 0,
            dueSoonCount: 0,
          },
          recentUnits: [],
        },
      });
    }

    const hasPayments = await tableExists(connection, 'lot_project_payments');
    const hasSchedules = await tableExists(connection, 'lot_project_payment_schedules');
    const hasCommissions = await tableExists(connection, 'lot_project_commissions');
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
          COALESCE(SUM(lot_project_listing_tcp), 0) AS totalContractPrice
        FROM lot_project_listings
        WHERE lot_project_id = ?
      `,
      [project.lot_project_id]
    );

    const [moneyRows] = await connection.query(
      `
        SELECT
          COALESCE(SUM(${paymentSummarySelect}), 0) AS totalCollected,
          COALESCE(SUM(l.lot_project_listing_tcp - ${paymentSummarySelect}), 0) AS outstandingBalance
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
          AND l.lot_project_listing_status IN ('sold', 'pending_for_cancellation', 'cancelled')
      `,
      [project.lot_project_id]
    );

    const [commissionRows] = hasCommissions
      ? await connection.query(
          `
            SELECT COALESCE(SUM(gross_commission_amount), 0) AS grossCommission
            FROM lot_project_commissions
            WHERE lot_project_id = ?
          `,
          [project.lot_project_id]
        )
      : [[{ grossCommission: 0 }]];

    const [scheduleRows] = hasSchedules
      ? await connection.query(
          `
            SELECT
              SUM(due_date < CURDATE() AND schedule_status IN ('Unpaid', 'Partial')) AS overdueCount,
              SUM(due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND schedule_status IN ('Unpaid', 'Partial')) AS dueSoonCount
            FROM lot_project_payment_schedules
            WHERE lot_project_id = ?
          `,
          [project.lot_project_id]
        )
      : [[{ overdueCount: 0, dueSoonCount: 0 }]];

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

    return res.json({
      success: true,
      data: {
        project: projectPayload,
        stats: {
          totalUnits: toNumber(summary.totalUnits),
          available: toNumber(summary.available),
          hold: toNumber(summary.hold),
          soldActive: toNumber(summary.soldActive),
          fullyPaid: toNumber(summary.fullyPaid),
          pendingCancellation: toNumber(summary.pendingCancellation),
          cancelled: toNumber(summary.cancelled),
          totalContractPrice: toNumber(summary.totalContractPrice),
          totalCollected: toNumber(moneySummary.totalCollected),
          outstandingBalance: Math.max(toNumber(moneySummary.outstandingBalance), 0),
          grossCommission: toNumber(commissionSummary.grossCommission),
          overdueCount: toNumber(scheduleSummary.overdueCount),
          dueSoonCount: toNumber(scheduleSummary.dueSoonCount),
        },
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

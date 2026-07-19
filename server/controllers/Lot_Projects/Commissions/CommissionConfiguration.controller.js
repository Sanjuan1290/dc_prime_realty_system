import {
  db,
  getErrorMessage,
  getListingLookupWhere,
  getProjectBySlug,
  getReserveSellerOptions,
  tableExists,
} from '../_shared/lotProject.shared.js';
import { getReservationCommissionPreview } from './commissionHierarchy.service.js';
import { getListingPricingForMode } from '../_shared/listingPricing.js';

const getListingForPreview = async (connection, projectId, listingLookup) => {
  const lookup = getListingLookupWhere(listingLookup, 'l');
  const [rows] = await connection.query(
    `
      SELECT l.*
      FROM lot_project_listings l
      WHERE l.lot_project_id = ?
        AND ${lookup.sql}
      LIMIT 1
    `,
    [projectId, ...lookup.params]
  );

  return rows[0] || null;
};

/**
 * Returns only active real or system-owned agents that have a direct rate for
 * the selected project. Managers, brokers, and BNMs never appear directly.
 */
export const getReservationAgents = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || '').trim());
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });

    const search = String(req.query.search || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const agents = await getReserveSellerOptions(connection, project.lot_project_id, {
      search,
      limit,
    });

    return res.json({
      success: true,
      data: agents,
      meta: {
        search,
        total: agents.length,
        projectId: Number(project.lot_project_id),
        projectName: project.lot_project_name,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

/**
 * Uses the same service as reservation saving so rates, hierarchy order, and
 * estimated amounts in the UI match the records inserted by the transaction.
 */
export const getReservationCommissionPreviewController = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || '').trim());
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!(await tableExists(connection, 'lot_project_listings'))) {
      return res.status(500).json({ message: 'Lot project listing table is missing.' });
    }

    const listingLookup = String(req.query.listingId || '').trim();
    const agentId = Number(req.query.agentId || 0);
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });
    if (!agentId) return res.status(400).json({ message: 'Sales agent is required.' });

    const listing = await getListingForPreview(connection, project.lot_project_id, listingLookup);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const modeOfPayment = String(req.query.modeOfPayment || '').toLowerCase() === 'cash' ? 'cash' : 'installment';
    const saleDiscountPercentage = Number(req.query.saleDiscountPercentage || 0);
    if (!Number.isFinite(saleDiscountPercentage) || saleDiscountPercentage < 0 || saleDiscountPercentage > 100) {
      return res.status(400).json({ message: 'Sale discount percentage must be between 0 and 100.' });
    }
    const contractPricing = getListingPricingForMode(listing, modeOfPayment, saleDiscountPercentage);
    listing.lot_project_listing_net_selling_price = contractPricing.netSellingPrice;
    listing.lot_project_listing_tcp = contractPricing.tcp;

    const preview = await getReservationCommissionPreview(
      connection,
      project.lot_project_id,
      listing,
      agentId
    );

    return res.json({
      success: true,
      data: {
        ...preview,
        rows: undefined,
        assignedSeller: undefined,
        project: {
          id: Number(project.lot_project_id),
          name: project.lot_project_name,
          slug: project.lot_project_slug,
        },
        listing: {
          id: Number(listing.lot_project_listing_id),
          unitId: listing.lot_project_listing_unit_id,
        },
        pricing: contractPricing,
      },
    });
  } catch (error) {
    const status = error?.statusCode || 400;
    return res.status(status).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


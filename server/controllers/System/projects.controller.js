import { db } from '../../db/connect.js';

const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'Duplicate project name, slug, location code, or unit ID.';
  return error?.message || 'Something went wrong.';
};

const slugify = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toNullable = (value) => {
  const clean = String(value || '').trim();
  return clean || null;
};

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const toActiveStatus = (value) => (value === 'inactive' ? 'inactive' : 'active');

const tableExists = async (connection, tableName) => {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName]
  );

  return Number(rows[0]?.total || 0) > 0;
};

const safeDeleteByProjectId = async (connection, tableName, lotProjectId) => {
  const allowedTables = new Set([
    'lot_project_settings',
    'lot_project_cadastral_lot_numbers',
    'lot_project_default_documents',
    'seller_group_lot_project_rates',
    'accredited_seller_lot_project_rates',
  ]);

  if (!allowedTables.has(tableName)) {
    throw new Error('Unsafe project delete operation blocked.');
  }

  const exists = await tableExists(connection, tableName);
  if (!exists) return;

  await connection.query(`DELETE FROM ${tableName} WHERE lot_project_id = ?`, [lotProjectId]);
};

const normalizeProjectPayload = (body = {}) => {
  const name = String(body.lot_project_name || body.project_bailen_name || body.name || '').trim();

  return {
    name,
    slug: slugify(body.lot_project_slug || body.slug || name),
    location: String(body.lot_project_location || body.project_bailen_location || body.location || '').trim(),
    locationCode: String(body.lot_project_location_code || body.project_bailen_location_code || body.locationCode || '').trim().toUpperCase(),
    administrator: toNullable(body.lot_project_administrator_name || body.project_bailen_administrator_name || body.administrator),
    taxDeclarationNo: toNullable(body.lot_project_tax_declaration_no || body.project_bailen_tax_declaration_no || body.taxDeclarationNo),
    pin: toNullable(body.lot_project_pin || body.project_bailen_pin || body.pin),
    status: toActiveStatus(body.lot_project_status || body.project_bailen_status || body.status),
    cadastralLots: Array.isArray(body.cadastralLots)
      ? body.cadastralLots.map((item) => String(item).trim()).filter(Boolean)
      : Array.isArray(body.cadastral_lots)
        ? body.cadastral_lots.map((item) => String(item?.lotNumber || item?.lot_project_cadastral_lot_number || item).trim()).filter(Boolean)
        : [],
    defaultDocuments: Array.isArray(body.defaultDocuments)
      ? body.defaultDocuments
      : Array.isArray(body.default_documents)
        ? body.default_documents
        : Array.isArray(body.documents)
          ? body.documents
          : Array.isArray(body.selectedDocuments)
            ? body.selectedDocuments
            : [],
  };
};

const getListingStatusLabel = (status = '', soldSubstatus = null) => {
  if (status === 'sold' && soldSubstatus === 'fully_paid') return 'Fully Paid';

  const map = {
    available: 'Available',
    hold: 'Hold',
    sold: 'Sold / Active',
    pending_for_cancellation: 'Pending Cancellation',
    cancelled: 'Cancelled',
    superseded: 'Superseded',
  };

  return map[status] || status || 'Available';
};

const normalizeLotType = (value = '') => {
  const clean = String(value || '').trim().toLowerCase();
  if (clean === 'corner') return 'Corner';
  if (clean === 'end') return 'End';
  return 'Inner';
};

const lotTypeLabel = (value = '') => normalizeLotType(value);

const normalizeListingStatusPayload = (value = '') => {
  const clean = String(value || 'available').trim().toLowerCase();

  if (clean === 'fully_paid') {
    return { status: 'sold', soldSubstatus: 'fully_paid' };
  }

  if (clean === 'sold_active' || clean === 'sold / active') {
    return { status: 'sold', soldSubstatus: 'active' };
  }

  const allowed = new Set([
    'available',
    'hold',
    'sold',
    'pending_for_cancellation',
    'cancelled',
    'superseded',
  ]);

  return {
    status: allowed.has(clean) ? clean : 'available',
    soldSubstatus: clean === 'sold' ? 'active' : null,
  };
};

const formatDocumentsLabel = (row = {}) => {
  const listingDocs = Number(row.listing_document_count || 0);
  const projectDocs = Number(row.project_default_document_count || 0);
  const requiredDocs = Number(row.project_required_document_count || 0);

  if (listingDocs > 0) return `${listingDocs} custom`;
  if (projectDocs > 0) return `${projectDocs} project default`;
  if (requiredDocs > 0) return `${requiredDocs} required`;
  return 'No checklist';
};

const mapListingRow = (row = {}) => ({
  ...row,
  id: row.lot_project_listing_id,
  unitCode: row.lot_project_listing_unit_id,
  oldUnitIds: row.lot_project_listing_old_unit_ids || '-',
  lotType: lotTypeLabel(row.lot_project_listing_unit_type),
  cadastralLots: row.cadastral_lots
    ? String(row.cadastral_lots).split(',').map((item) => item.trim()).filter(Boolean)
    : [],
  area: Number(row.lot_project_listing_area_sqm || 0),
  pricePerSqm: Number(row.lot_project_listing_price_per_sqm || 0),
  netSellingPrice: Number(row.lot_project_listing_net_selling_price || 0),
  lmfRate: Number(row.lot_project_listing_lmf_rate || 0),
  lmfAmount: Number(row.lot_project_listing_lmf_amount || 0),
  tcp: Number(row.lot_project_listing_tcp || 0),
  reservationFee: Number(row.lot_project_listing_reservation_fee || 0),
  annualInterestRate: Number(row.annual_interest_rate || 0),
  buyer: row.buyer_full_name || row.buyer_name || 'No buyer yet',
  documentStatus: row.document_status || formatDocumentsLabel(row),
  status: getListingStatusLabel(row.lot_project_listing_status, row.lot_project_listing_sold_substatus),
  rawStatus: row.lot_project_listing_status,
  soldSubstatus: row.lot_project_listing_sold_substatus,
  routeId: row.lot_project_listing_id || row.lot_project_listing_unit_id,
});

const mapProjectRows = (projects = [], cadastralRows = []) => {
  const cadastralMap = new Map();

  cadastralRows.forEach((row) => {
    if (!cadastralMap.has(row.lot_project_id)) {
      cadastralMap.set(row.lot_project_id, []);
    }

    cadastralMap.get(row.lot_project_id).push(row.lot_project_cadastral_lot_number);
  });

  return projects.map((project) => ({
    ...project,
    id: project.lot_project_id,
    type: 'lot',
    name: project.lot_project_name,
    slug: project.lot_project_slug,
    location: project.lot_project_location,
    locationCode: project.lot_project_location_code,
    administrator: project.lot_project_administrator_name,
    taxDeclarationNo: project.lot_project_tax_declaration_no,
    pin: project.lot_project_pin,
    status: project.lot_project_status,
    routePath: `/lot-projects/${project.lot_project_slug}`,
    cadastralLots: cadastralMap.get(project.lot_project_id) || [],
    defaultDocs: Number(project.default_documents_count || 0),
    requiredDocs: Number(project.required_documents_count || 0),
  }));
};

const getProjectBySlug = async (slug) => {
  const [projectRows] = await db.query(
    `
      SELECT *
      FROM lot_projects
      WHERE lot_project_slug = ?
      LIMIT 1
    `,
    [slug]
  );

  return projectRows[0] || null;
};

const getProjectDefaultDocuments = async (lotProjectId) => {
  const [defaultDocuments] = await db.query(
    `
      SELECT
        lpdd.lot_project_default_document_id,
        lpdd.lot_project_id,
        lpdd.document_id,
        lpdd.lot_project_default_document_is_required,
        lpdd.lot_project_default_document_status,
        d.document_name,
        d.document_description,
        d.document_status
      FROM lot_project_default_documents lpdd
      INNER JOIN documents d ON d.document_id = lpdd.document_id
      WHERE lpdd.lot_project_id = ?
      ORDER BY d.document_name ASC
    `,
    [lotProjectId]
  );

  return defaultDocuments.map((document) => ({
    ...document,
    id: document.document_id,
    name: document.document_name,
    description: document.document_description || 'Project Default',
    source: 'Project Default',
    requirement: document.lot_project_default_document_is_required ? 'required' : 'optional',
    status: document.lot_project_default_document_status || document.document_status || 'active',
  }));
};

const getProjectCadastralLots = async (lotProjectId) => {
  const connection = await db.getConnection();

  try {
    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');

    if (!hasListingCadastralLinks) {
      const [rows] = await connection.query(
        `
          SELECT
            lot_project_cadastral_lot_number_id,
            lot_project_id,
            lot_project_cadastral_lot_number
          FROM lot_project_cadastral_lot_numbers
          WHERE lot_project_id = ?
          ORDER BY lot_project_cadastral_lot_number ASC
        `,
        [lotProjectId]
      );

      return rows.map((lot) => ({
        ...lot,
        id: lot.lot_project_cadastral_lot_number_id,
        lotNumber: lot.lot_project_cadastral_lot_number,
        status: 'active',
        usedCount: 0,
        usedByUnits: '',
      }));
    }

    const [cadastralLots] = await connection.query(
      `
        SELECT
          c.lot_project_cadastral_lot_number_id,
          c.lot_project_id,
          c.lot_project_cadastral_lot_number,
          COALESCE(COUNT(l.lot_project_listing_id), 0) AS usedCount,
          GROUP_CONCAT(l.lot_project_listing_unit_id ORDER BY l.lot_project_listing_unit_id SEPARATOR ', ') AS usedByUnits
        FROM lot_project_cadastral_lot_numbers c
        LEFT JOIN lot_project_listing_cadastral_lots lcl
          ON lcl.lot_project_cadastral_lot_number_id = c.lot_project_cadastral_lot_number_id
        LEFT JOIN lot_project_listings l
          ON l.lot_project_listing_id = lcl.lot_project_listing_id
        WHERE c.lot_project_id = ?
        GROUP BY c.lot_project_cadastral_lot_number_id, c.lot_project_id, c.lot_project_cadastral_lot_number
        ORDER BY c.lot_project_cadastral_lot_number ASC
      `,
      [lotProjectId]
    );

    return cadastralLots.map((lot) => ({
      ...lot,
      id: lot.lot_project_cadastral_lot_number_id,
      lotNumber: lot.lot_project_cadastral_lot_number,
      status: 'active',
      usedCount: Number(lot.usedCount || 0),
      usedByUnits: lot.usedByUnits || '',
    }));
  } finally {
    connection.release();
  }
};

export const getLotProjects = async (req, res) => {
  try {
    const [projects] = await db.query(`
      SELECT
        lp.*,
        COUNT(DISTINCT lpdd.lot_project_default_document_id) AS default_documents_count,
        COALESCE(SUM(lpdd.lot_project_default_document_is_required = 1), 0) AS required_documents_count
      FROM lot_projects lp
      LEFT JOIN lot_project_default_documents lpdd
        ON lpdd.lot_project_id = lp.lot_project_id
        AND lpdd.lot_project_default_document_status = 'active'
      GROUP BY lp.lot_project_id
      ORDER BY lp.lot_project_created_at DESC, lp.lot_project_id DESC
    `);

    const [cadastralRows] = await db.query(`
      SELECT
        lot_project_id,
        lot_project_cadastral_lot_number
      FROM lot_project_cadastral_lot_numbers
      ORDER BY lot_project_cadastral_lot_number ASC
    `);

    return res.json({
      success: true,
      data: mapProjectRows(projects, cadastralRows),
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getLotProjectOptions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        lot_project_id,
        lot_project_name,
        lot_project_slug,
        lot_project_location_code,
        lot_project_status
      FROM lot_projects
      WHERE lot_project_status = 'active'
      ORDER BY lot_project_name ASC
    `);

    return res.json({
      success: true,
      data: rows.map((project) => ({
        ...project,
        id: project.lot_project_id,
        label: project.lot_project_name,
        value: project.lot_project_id,
        slug: project.lot_project_slug,
        routePath: `/lot-projects/${project.lot_project_slug}`,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getLotProjectBySlug = async (req, res) => {
  try {
    const slug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ message: 'Lot project not found.' });
    }

    const cadastralLots = await getProjectCadastralLots(project.lot_project_id);
    const defaultDocuments = await getProjectDefaultDocuments(project.lot_project_id);

    return res.json({
      success: true,
      data: {
        ...project,
        id: project.lot_project_id,
        type: 'lot',
        name: project.lot_project_name,
        slug: project.lot_project_slug,
        location: project.lot_project_location,
        locationCode: project.lot_project_location_code,
        administrator: project.lot_project_administrator_name,
        taxDeclarationNo: project.lot_project_tax_declaration_no,
        pin: project.lot_project_pin,
        status: project.lot_project_status,
        routePath: `/lot-projects/${project.lot_project_slug}`,
        cadastralLots,
        defaultDocuments,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getLotProjectDashboard = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
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
        data: {
          project: {
            ...project,
            id: project.lot_project_id,
            name: project.lot_project_name,
            location: project.lot_project_location,
            locationCode: project.lot_project_location_code,
            cadastralLots,
            defaultDocuments,
          },
          stats: {
            totalUnits: 0,
            available: 0,
            soldActive: 0,
            grossCommission: 0,
          },
          recentUnits: [],
        },
      });
    }

    const [summaryRows] = await connection.query(
      `
        SELECT
          COUNT(*) AS totalUnits,
          SUM(lot_project_listing_status = 'available') AS available,
          SUM(lot_project_listing_status = 'sold') AS soldActive,
          COALESCE(SUM(lot_project_listing_tcp), 0) AS totalContractPrice,
          COALESCE((
            SELECT SUM(gross_commission_amount)
            FROM lot_project_commissions
            WHERE lot_project_id = ?
          ), 0) AS grossCommission
        FROM lot_project_listings
        WHERE lot_project_id = ?
      `,
      [project.lot_project_id, project.lot_project_id]
    );

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

    const [recentRows] = await connection.query(
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
        WHERE l.lot_project_id = ?
        ORDER BY l.lot_project_listing_updated_at DESC, l.lot_project_listing_id DESC
        LIMIT 5
      `,
      [project.lot_project_id]
    );

    const summary = summaryRows[0] || {};

    return res.json({
      success: true,
      data: {
        project: {
          ...project,
          id: project.lot_project_id,
          name: project.lot_project_name,
          location: project.lot_project_location,
          locationCode: project.lot_project_location_code,
          cadastralLots,
          defaultDocuments,
        },
        stats: {
          totalUnits: Number(summary.totalUnits || 0),
          available: Number(summary.available || 0),
          soldActive: Number(summary.soldActive || 0),
          grossCommission: Number(summary.grossCommission || 0),
        },
        recentUnits: recentRows.map((row) => ({
          ...mapListingRow(row),
          progress: row.lot_project_listing_status === 'sold' && row.lot_project_listing_sold_substatus === 'fully_paid' ? '100%' : '0%',
          documents: formatDocumentsLabel(row),
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
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
    const pricePerSqm = Number(req.body.pricePerSqm || 0);
    const lotAreaSqm = Number(req.body.lotAreaSqm || req.body.area || 0);
    const legalMiscRate = Number(req.body.legalMiscRate || req.body.lmfRate || 0);
    const reservationFee = Number(req.body.reservationFee || 0);
    const listingStatus = normalizeListingStatusPayload(req.body.status);

    if (!unitNumber && !req.body.unitCode) {
      return res.status(400).json({ message: 'Unit number is required.' });
    }

    if (pricePerSqm <= 0) {
      return res.status(400).json({ message: 'Price per SQM must be greater than 0.' });
    }

    if (lotAreaSqm <= 0) {
      return res.status(400).json({ message: 'Lot area SQM must be greater than 0.' });
    }

    const netSellingPrice = pricePerSqm * lotAreaSqm;
    const lmfAmount = netSellingPrice * (legalMiscRate / 100);
    const tcp = netSellingPrice + lmfAmount;

    await connection.beginTransaction();

    const [listingResult] = await connection.query(
      `
        INSERT INTO lot_project_listings (
          lot_project_id,
          lot_project_listing_unit_type,
          lot_project_listing_unit_id,
          lot_project_listing_old_unit_ids,
          lot_project_listing_area_sqm,
          lot_project_listing_price_per_sqm,
          lot_project_listing_net_selling_price,
          lot_project_listing_lmf_rate,
          lot_project_listing_lmf_amount,
          lot_project_listing_tcp,
          lot_project_listing_reservation_fee,
          lot_project_listing_status,
          lot_project_listing_sold_substatus
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        project.lot_project_id,
        normalizeLotType(req.body.lotType || req.body.unitType),
        unitCode,
        toNullable(req.body.oldUnitIds),
        lotAreaSqm,
        pricePerSqm,
        netSellingPrice,
        legalMiscRate,
        lmfAmount,
        tcp,
        reservationFee,
        listingStatus.status,
        listingStatus.soldSubstatus,
      ]
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

export const createLotProject = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const payload = normalizeProjectPayload(req.body);

    if (!payload.name) return res.status(400).json({ message: 'Project name is required.' });
    if (!payload.location) return res.status(400).json({ message: 'Project location is required.' });
    if (!payload.locationCode) return res.status(400).json({ message: 'Location code is required.' });

    await connection.beginTransaction();

    const [projectResult] = await connection.query(
      `
        INSERT INTO lot_projects (
          lot_project_name,
          lot_project_slug,
          lot_project_location,
          lot_project_location_code,
          lot_project_administrator_name,
          lot_project_tax_declaration_no,
          lot_project_pin,
          lot_project_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [payload.name, payload.slug, payload.location, payload.locationCode, payload.administrator, payload.taxDeclarationNo, payload.pin, payload.status]
    );

    const lotProjectId = projectResult.insertId;

    if (payload.cadastralLots.length > 0) {
      await connection.query(
        `
          INSERT INTO lot_project_cadastral_lot_numbers (
            lot_project_id,
            lot_project_cadastral_lot_number
          )
          VALUES ${payload.cadastralLots.map(() => '(?, ?)').join(', ')}
        `,
        payload.cadastralLots.flatMap((lot) => [lotProjectId, lot])
      );
    }

    const cleanDocuments = payload.defaultDocuments
      .map((document) => ({
        document_id: Number(document.document_id || document.id),
        is_required: document.requirement === 'optional' || document.is_required === false ? 0 : 1,
        status: document.status === 'inactive' ? 'inactive' : 'active',
      }))
      .filter((document) => document.document_id);

    if (cleanDocuments.length > 0) {
      await connection.query(
        `
          INSERT INTO lot_project_default_documents (
            lot_project_id,
            document_id,
            lot_project_default_document_is_required,
            lot_project_default_document_status
          )
          VALUES ${cleanDocuments.map(() => '(?, ?, ?, ?)').join(', ')}
        `,
        cleanDocuments.flatMap((document) => [lotProjectId, document.document_id, document.is_required, document.status])
      );
    }

    await connection.query(
      `
        INSERT INTO lot_project_settings (
          lot_project_id,
          release_day_one,
          release_day_two,
          reservation_contact_name,
          reservation_contact_email,
          reservation_contact_number,
          company_name,
          company_email,
          company_contact_number
        ) VALUES (?, 7, 22, ?, ?, ?, ?, ?, ?)
      `,
      [lotProjectId, 'D&C Prime Realty', 'dcprimerealty@gmail.com', '0912-345-6789', 'D&C Prime Realty', 'dcprimerealty@gmail.com', '(046) 866-0616']
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Lot project created successfully.',
      lot_project_id: lotProjectId,
      routePath: `/lot-projects/${payload.slug}`,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateLotProject = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const lotProjectId = Number(req.params.id);
    const payload = normalizeProjectPayload(req.body);

    if (!lotProjectId) return res.status(400).json({ message: 'Invalid lot project id.' });
    if (!payload.name) return res.status(400).json({ message: 'Project name is required.' });
    if (!payload.location) return res.status(400).json({ message: 'Project location is required.' });
    if (!payload.locationCode) return res.status(400).json({ message: 'Location code is required.' });

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        UPDATE lot_projects
        SET
          lot_project_name = ?,
          lot_project_slug = ?,
          lot_project_location = ?,
          lot_project_location_code = ?,
          lot_project_administrator_name = ?,
          lot_project_tax_declaration_no = ?,
          lot_project_pin = ?,
          lot_project_status = ?
        WHERE lot_project_id = ?
      `,
      [payload.name, payload.slug, payload.location, payload.locationCode, payload.administrator, payload.taxDeclarationNo, payload.pin, payload.status, lotProjectId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Lot project not found.' });
    }

    await connection.query(`DELETE FROM lot_project_cadastral_lot_numbers WHERE lot_project_id = ?`, [lotProjectId]);

    if (payload.cadastralLots.length > 0) {
      await connection.query(
        `
          INSERT INTO lot_project_cadastral_lot_numbers (
            lot_project_id,
            lot_project_cadastral_lot_number
          )
          VALUES ${payload.cadastralLots.map(() => '(?, ?)').join(', ')}
        `,
        payload.cadastralLots.flatMap((lot) => [lotProjectId, lot])
      );
    }

    await connection.query(`DELETE FROM lot_project_default_documents WHERE lot_project_id = ?`, [lotProjectId]);

    const cleanDocuments = payload.defaultDocuments
      .map((document) => ({
        document_id: Number(document.document_id || document.id),
        is_required: document.requirement === 'optional' || document.is_required === false ? 0 : 1,
        status: document.status === 'inactive' ? 'inactive' : 'active',
      }))
      .filter((document) => document.document_id);

    if (cleanDocuments.length > 0) {
      await connection.query(
        `
          INSERT INTO lot_project_default_documents (
            lot_project_id,
            document_id,
            lot_project_default_document_is_required,
            lot_project_default_document_status
          )
          VALUES ${cleanDocuments.map(() => '(?, ?, ?, ?)').join(', ')}
        `,
        cleanDocuments.flatMap((document) => [lotProjectId, document.document_id, document.is_required, document.status])
      );
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'Lot project updated successfully.',
      routePath: `/lot-projects/${payload.slug}`,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const toggleLotProjectStatus = async (req, res) => {
  try {
    const lotProjectId = Number(req.params.id);
    if (!lotProjectId) return res.status(400).json({ message: 'Invalid lot project id.' });

    const nextStatus = toActiveStatus(req.body.status);

    const [result] = await db.query(
      `
        UPDATE lot_projects
        SET lot_project_status = ?
        WHERE lot_project_id = ?
      `,
      [nextStatus, lotProjectId]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Lot project not found.' });

    return res.json({
      success: true,
      message: `Lot project status changed to ${nextStatus}.`,
      status: nextStatus,
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const deleteLotProject = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const lotProjectId = Number(req.params.id);
    if (!lotProjectId) return res.status(400).json({ message: 'Invalid lot project id.' });

    await connection.beginTransaction();

    const [projectRows] = await connection.query(
      `
        SELECT lot_project_id, lot_project_name
        FROM lot_projects
        WHERE lot_project_id = ?
        LIMIT 1
      `,
      [lotProjectId]
    );

    const project = projectRows[0];

    if (!project) {
      await connection.rollback();
      return res.status(404).json({ message: 'Lot project not found.' });
    }

    let listingCount = 0;

    if (await tableExists(connection, 'lot_project_listings')) {
      const [listingRows] = await connection.query(
        `
          SELECT COUNT(*) AS total
          FROM lot_project_listings
          WHERE lot_project_id = ?
        `,
        [lotProjectId]
      );

      listingCount = Number(listingRows[0]?.total || 0);
    }

    if (listingCount > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        can_delete: false,
        listed_units_count: listingCount,
        message: `${project.lot_project_name} has ${listingCount} listed unit(s). It cannot be deleted. Change the project status to inactive instead.`,
      });
    }

    await safeDeleteByProjectId(connection, 'lot_project_settings', lotProjectId);
    await safeDeleteByProjectId(connection, 'lot_project_cadastral_lot_numbers', lotProjectId);
    await safeDeleteByProjectId(connection, 'lot_project_default_documents', lotProjectId);
    await safeDeleteByProjectId(connection, 'seller_group_lot_project_rates', lotProjectId);
    await safeDeleteByProjectId(connection, 'accredited_seller_lot_project_rates', lotProjectId);

    await connection.query(`DELETE FROM lot_projects WHERE lot_project_id = ?`, [lotProjectId]);

    await connection.commit();

    return res.json({
      success: true,
      message: 'Lot project permanently deleted successfully.',
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

const moneyValue = (value) => Number(value || 0);

const formatMoneyString = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDateOnly = (value) => {
  if (!value) return '-';
  return new Date(value).toISOString().slice(0, 10);
};

const normalizeListingKeyWhere = (listingKey) => {
  const key = String(listingKey || '').trim();
  if (/^\d+$/.test(key)) {
    return { sql: '(l.lot_project_listing_id = ? OR l.lot_project_listing_unit_id = ?)', params: [Number(key), key] };
  }
  return { sql: 'l.lot_project_listing_unit_id = ?', params: [key.toUpperCase()] };
};

const mapClientProfile = (row = {}) => {
  if (!row?.lot_project_client_profile_id) {
    return {
      profileStatus: 'incomplete',
      buyerType: 'single',
      buyerName: '',
      seller: '-',
      salesOfficer: '-',
      dateReceived: '',
    };
  }

  return {
    id: row.lot_project_client_profile_id,
    lot_project_client_profile_id: row.lot_project_client_profile_id,
    profileStatus: row.buyer_full_name ? 'complete' : 'incomplete',
    buyerType: row.buyer_type || 'single',
    buyerTypeLabel: row.buyer_type === 'and_account' ? 'AND Account' : row.buyer_type === 'spouses' ? 'Spouses' : 'Single',
    buyerRole: 'Principal Buyer',
    buyerName: row.buyer_full_name || [row.buyer_first_name, row.buyer_middle_name, row.buyer_last_name].filter(Boolean).join(' '),
    firstName: row.buyer_first_name || '',
    middleName: row.buyer_middle_name || '',
    lastName: row.buyer_last_name || '',
    suffix: row.buyer_suffix || '',
    birthDate: row.buyer_birth_date ? formatDateOnly(row.buyer_birth_date) : '',
    placeOfBirth: row.buyer_place_of_birth || '',
    citizenship: row.buyer_citizenship || '',
    gender: row.buyer_gender || '',
    civilStatus: row.buyer_civil_status || '',
    contactNo: row.buyer_contact_number || '',
    email: row.buyer_email || '',
    tin: row.buyer_tin || '',
    presentAddress: row.buyer_present_address || '',
    permanentAddress: row.buyer_permanent_address || '',
    employmentStatus: row.buyer_employment_status || '',
    employerBusinessName: row.buyer_employer_business_name || '',
    employerBusinessAddress: row.buyer_employer_business_address || '',
    natureOfWorkBusiness: row.buyer_nature_of_work_business || '',
    occupationPositionTitle: row.buyer_occupation_position || '',
    monthlyIncome: row.buyer_monthly_income || 0,
    secondBuyerRole: row.buyer_type === 'spouses' ? 'Spouse' : 'Co-Buyer',
    secondBuyerName: row.second_buyer_full_name || '',
    secondBuyerBirthDate: row.second_buyer_birth_date ? formatDateOnly(row.second_buyer_birth_date) : '',
    secondBuyerPlaceOfBirth: row.second_buyer_place_of_birth || '',
    secondBuyerCitizenship: row.second_buyer_citizenship || '',
    secondBuyerGender: row.second_buyer_gender || '',
    secondBuyerCivilStatus: row.second_buyer_civil_status || '',
    secondBuyerContactNo: row.second_buyer_contact_number || '',
    secondBuyerEmail: row.second_buyer_email || '',
    secondBuyerTin: row.second_buyer_tin || '',
    secondBuyerPresentAddress: row.second_buyer_present_address || '',
    secondBuyerPermanentAddress: row.second_buyer_permanent_address || '',
    secondBuyerEmploymentStatus: row.second_buyer_employment_status || '',
    secondBuyerEmployerBusinessName: row.second_buyer_employer_business_name || '',
    secondBuyerEmployerBusinessAddress: row.second_buyer_employer_business_address || '',
    secondBuyerNatureOfWorkBusiness: row.second_buyer_nature_of_work_business || '',
    secondBuyerOccupationPositionTitle: row.second_buyer_occupation_position || '',
    secondBuyerMonthlyIncome: row.second_buyer_monthly_income || 0,
    seller: row.seller_name || '-',
    salesOfficer: row.seller_name || '-',
    dateReceived: row.lot_project_client_profile_created_at ? formatDateOnly(row.lot_project_client_profile_created_at) : '',
    status: row.lot_project_client_profile_status,
  };
};

const buildBuyerFullName = (body = {}) => {
  const explicit = String(body.buyerName || body.buyer_full_name || '').trim();
  if (explicit) return explicit;
  return [body.firstName || body.buyer_first_name, body.middleName || body.buyer_middle_name, body.lastName || body.buyer_last_name, body.suffix || body.buyer_suffix]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' ');
};

const mapSoaRow = (row = {}) => ({
  ...row,
  id: row.lot_project_payment_schedule_id,
  dueDate: row.due_date,
  description: row.description,
  beginningBalance: moneyValue(row.beginning_balance),
  dueAmount: moneyValue(row.due_amount),
  interest: 0,
  penalty: moneyValue(row.penalty_amount),
  amountPaid: moneyValue(row.amount_paid),
  datePaid: row.date_paid || '-',
  referenceId: row.reference_id || '-',
  status: row.schedule_status,
  endingBalance: moneyValue(row.ending_balance),
});

const mapPaymentRow = (row = {}) => ({
  id: row.lot_project_payment_id,
  paymentId: row.lot_project_payment_id,
  scheduleId: row.lot_project_payment_schedule_id,
  client: row.buyer_full_name || '-',
  unit: row.lot_project_listing_unit_id || '-',
  project: row.lot_project_name || '-',
  amount: moneyValue(row.lot_project_payment_amount),
  type: row.lot_project_payment_type,
  method: row.lot_project_payment_method,
  referenceId: row.lot_project_payment_reference_id || '-',
  paymentDate: row.lot_project_payment_date,
  verifiedBy: row.verified_by_name || '-',
  verifiedAt: row.lot_project_payment_verified_at,
  status: row.lot_project_payment_status,
});

const mapDocumentRow = (row = {}) => ({
  ...row,
  id: row.document_id,
  documentId: row.document_id,
  clientDocumentId: row.lot_project_client_document_id || null,
  name: row.document_name,
  description: row.document_description || 'No description',
  requirement: row.is_required ? 'Required' : 'Optional',
  status: row.lot_project_client_document_status || 'Missing',
  fileName: row.lot_project_client_document_file_name || '-',
  fileUrl: row.lot_project_client_document_file_url || '',
  images: row.lot_project_client_document_file_url ? [row.lot_project_client_document_file_url] : [],
});

const getListingProfileBundle = async (projectSlug, listingKey, connection = db) => {
  const listingWhere = normalizeListingKeyWhere(listingKey);

  const [listingRows] = await connection.query(
    `
      SELECT
        p.*,
        l.*,
        cp.*,
        seller_user.id AS seller_user_id,
        TRIM(CONCAT_WS(' ', seller_user.first_name, seller_user.middle_name, seller_user.last_name)) AS seller_name,
        seller_user.role AS seller_role,
        parent_user.id AS reports_under_user_id,
        TRIM(CONCAT_WS(' ', parent_user.first_name, parent_user.middle_name, parent_user.last_name)) AS reports_under_name,
        COALESCE(payment_summary.total_paid, 0) AS total_paid,
        COALESCE(payment_summary.payment_count, 0) AS payment_count,
        payment_summary.latest_payment_date,
        COALESCE(payment_summary.latest_payment_amount, 0) AS latest_payment_amount,
        COALESCE(doc_summary.total_documents, 0) AS total_documents,
        COALESCE(doc_summary.required_documents, 0) AS required_documents,
        COALESCE(doc_summary.submitted_documents, 0) AS submitted_documents,
        COALESCE(doc_summary.approved_documents, 0) AS approved_documents,
        COALESCE(doc_summary.missing_required, 0) AS missing_required,
        COALESCE(commission_summary.gross_commission, 0) AS gross_commission,
        COALESCE(commission_summary.released_commission, 0) AS released_commission,
        COALESCE(commission_summary.remaining_commission, 0) AS remaining_commission,
        commission_summary.commission_status
      FROM lot_project_listings l
      INNER JOIN lot_projects p ON p.lot_project_id = l.lot_project_id
      LEFT JOIN lot_project_client_profiles cp ON cp.lot_project_listing_id = l.lot_project_listing_id
      LEFT JOIN (
        SELECT
          lot_project_listing_id,
          SUM(lot_project_payment_amount) AS total_paid,
          COUNT(*) AS payment_count,
          MAX(lot_project_payment_date) AS latest_payment_date,
          SUBSTRING_INDEX(GROUP_CONCAT(lot_project_payment_amount ORDER BY lot_project_payment_date DESC, lot_project_payment_id DESC), ',', 1) AS latest_payment_amount
        FROM lot_project_payments
        WHERE lot_project_payment_status = 'Verified'
        GROUP BY lot_project_listing_id
      ) payment_summary ON payment_summary.lot_project_listing_id = l.lot_project_listing_id
      LEFT JOIN (
        SELECT
          listing_docs.lot_project_listing_id,
          COUNT(*) AS total_documents,
          SUM(listing_docs.is_required = 1) AS required_documents,
          SUM(listing_docs.client_status IN ('Submitted', 'Approved')) AS submitted_documents,
          SUM(listing_docs.client_status = 'Approved') AS approved_documents,
          SUM(listing_docs.is_required = 1 AND listing_docs.client_status = 'Missing') AS missing_required
        FROM (
          SELECT
            ld.lot_project_listing_id,
            ld.lot_project_listing_document_is_required AS is_required,
            COALESCE(cd.lot_project_client_document_status, 'Missing') AS client_status
          FROM lot_project_listing_documents ld
          LEFT JOIN lot_project_client_documents cd
            ON cd.lot_project_listing_id = ld.lot_project_listing_id
           AND cd.document_id = ld.document_id
        ) listing_docs
        GROUP BY listing_docs.lot_project_listing_id
      ) doc_summary ON doc_summary.lot_project_listing_id = l.lot_project_listing_id
      LEFT JOIN (
        SELECT
          lot_project_listing_id,
          MIN(accredited_seller_id) AS accredited_seller_id,
          SUM(gross_commission_amount) AS gross_commission,
          SUM(released_commission_amount) AS released_commission,
          SUM(net_remaining_commission_amount) AS remaining_commission,
          MAX(commission_status) AS commission_status
        FROM lot_project_commissions
        GROUP BY lot_project_listing_id
      ) commission_summary ON commission_summary.lot_project_listing_id = l.lot_project_listing_id
      LEFT JOIN accredited_sellers seller ON seller.accredited_seller_id = commission_summary.accredited_seller_id
      LEFT JOIN users seller_user ON seller_user.id = seller.user_id
      LEFT JOIN users parent_user ON parent_user.id = seller.accredited_seller_reports_under_user_id
      WHERE p.lot_project_slug = ?
        AND ${listingWhere.sql}
      LIMIT 1
    `,
    [projectSlug, ...listingWhere.params]
  );

  const row = listingRows[0];
  if (!row) return null;

  const balance = moneyValue(row.lot_project_listing_tcp) - moneyValue(row.total_paid);
  const docStatus = Number(row.missing_required || 0) > 0 ? 'Incomplete' : 'Complete';
  const paymentStatus = balance <= 0 ? 'Fully Paid' : Number(row.total_paid || 0) > 0 ? 'Partially Paid' : 'Unpaid';

  const [cadastralRows] = await connection.query(
    `
      SELECT c.lot_project_cadastral_lot_number
      FROM lot_project_cadastral_lot_numbers c
      LEFT JOIN lot_project_listing_cadastral_lots lcl
        ON lcl.lot_project_cadastral_lot_number_id = c.lot_project_cadastral_lot_number_id
      WHERE c.lot_project_id = ?
        AND (lcl.lot_project_listing_id = ? OR NOT EXISTS (
          SELECT 1 FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'lot_project_listing_cadastral_lots'
        ))
      ORDER BY c.lot_project_cadastral_lot_number ASC
    `,
    [row.lot_project_id, row.lot_project_listing_id]
  ).catch(async () => [[], []]);

  const listing = {
    ...row,
    id: row.lot_project_listing_id,
    listingId: row.lot_project_listing_id,
    lotProjectId: row.lot_project_id,
    unit_id: row.lot_project_listing_unit_id,
    unitCode: row.lot_project_listing_unit_id,
    project_name: row.lot_project_name,
    projectName: row.lot_project_name,
    project_location: row.lot_project_location,
    location: row.lot_project_location,
    administrator: row.lot_project_administrator_name || '-',
    cadastral_lot_no: cadastralRows?.length ? cadastralRows.map((item) => item.lot_project_cadastral_lot_number).join(', ') : '-',
    cadastralLots: cadastralRows?.map((item) => item.lot_project_cadastral_lot_number) || [],
    old_unit_ids: row.lot_project_listing_old_unit_ids || '-',
    source_unit_ids: row.lot_project_listing_old_unit_ids || '-',
    derived_unit_ids: '-',
    lot_type: row.lot_project_listing_unit_type,
    listing_status: getListingStatusLabel(row.lot_project_listing_status, row.lot_project_listing_sold_substatus),
    status: getListingStatusLabel(row.lot_project_listing_status, row.lot_project_listing_sold_substatus),
    rawStatus: row.lot_project_listing_status,
    soldSubstatus: row.lot_project_listing_sold_substatus,
    lot_area_sqm: `${Number(row.lot_project_listing_area_sqm || 0)} sqm`,
    lotAreaSqm: Number(row.lot_project_listing_area_sqm || 0),
    price_per_sqm: formatMoneyString(row.lot_project_listing_price_per_sqm),
    pricePerSqm: Number(row.lot_project_listing_price_per_sqm || 0),
    net_selling_price: formatMoneyString(row.lot_project_listing_net_selling_price),
    netSellingPrice: Number(row.lot_project_listing_net_selling_price || 0),
    lmf_rate: `${Number(row.lot_project_listing_lmf_rate || 0)}%`,
    legalMiscRate: Number(row.lot_project_listing_lmf_rate || 0),
    lmf_amount: formatMoneyString(row.lot_project_listing_lmf_amount),
    lmfAmount: Number(row.lot_project_listing_lmf_amount || 0),
    tcp: formatMoneyString(row.lot_project_listing_tcp),
    tcpAmount: Number(row.lot_project_listing_tcp || 0),
    reservationFee: Number(row.lot_project_listing_reservation_fee || 0),
    balanceAmount: balance,
    balance: formatMoneyString(balance),
    buyer_name: row.buyer_full_name || '-',
    email: row.buyer_email || '-',
    contact_no: row.buyer_contact_number || '-',
    address: row.buyer_present_address || '-',
    region: 'REGION 4A',
    assigned_user: row.seller_name || '-',
    due_day: row.due_day || '-',
    total_paid: formatMoneyString(row.total_paid),
    payment_status: paymentStatus,
    payment_count: String(row.payment_count || 0),
    latest_payment_date: row.latest_payment_date || '-',
    latest_payment_amount: formatMoneyString(row.latest_payment_amount),
    seller: row.seller_name || '-',
    seller_role: row.seller_role || '-',
    reports_under: row.reports_under_name || 'Direct / None',
    commission_rate: '-',
    commission_amount: formatMoneyString(row.gross_commission),
    released_amount: formatMoneyString(row.released_commission),
    remaining_commission: formatMoneyString(row.remaining_commission),
    commission_status: row.commission_status || '-',
    total_documents: String(row.total_documents || 0),
    required_documents: String(row.required_documents || 0),
    submitted_documents: String(row.submitted_documents || 0),
    approved_documents: String(row.approved_documents || 0),
    missing_required: String(row.missing_required || 0),
    document_status: docStatus,
    created_at: row.lot_project_listing_created_at,
    updated_at: row.lot_project_listing_updated_at,
    client_unit_created: row.lot_project_client_profile_created_at || '-',
    client_unit_updated: row.lot_project_client_profile_updated_at || '-',
  };

  const client = mapClientProfile(row);

  const [scheduleRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payment_schedules
      WHERE lot_project_listing_id = ?
      ORDER BY due_date ASC, lot_project_payment_schedule_id ASC
    `,
    [row.lot_project_listing_id]
  );

  const [payments] = await connection.query(
    `
      SELECT
        pmt.*,
        proj.lot_project_name,
        l.lot_project_listing_unit_id,
        cp.buyer_full_name,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS verified_by_name
      FROM lot_project_payments pmt
      INNER JOIN lot_projects proj ON proj.lot_project_id = pmt.lot_project_id
      INNER JOIN lot_project_listings l ON l.lot_project_listing_id = pmt.lot_project_listing_id
      LEFT JOIN lot_project_client_profiles cp ON cp.lot_project_client_profile_id = pmt.lot_project_client_profile_id
      LEFT JOIN users u ON u.id = pmt.lot_project_payment_verified_by_user_id
      WHERE pmt.lot_project_listing_id = ?
      ORDER BY pmt.lot_project_payment_date DESC, pmt.lot_project_payment_id DESC
    `,
    [row.lot_project_listing_id]
  );

  const [documents] = await connection.query(
    `
      SELECT
        d.document_id,
        d.document_name,
        d.document_description,
        ld.lot_project_listing_document_is_required AS is_required,
        cd.lot_project_client_document_id,
        cd.lot_project_client_document_file_name,
        cd.lot_project_client_document_file_url,
        cd.lot_project_client_document_status,
        cd.lot_project_client_document_uploaded_at,
        cd.lot_project_client_document_approved_at
      FROM lot_project_listing_documents ld
      INNER JOIN documents d ON d.document_id = ld.document_id
      LEFT JOIN lot_project_client_documents cd
        ON cd.lot_project_listing_id = ld.lot_project_listing_id
       AND cd.document_id = ld.document_id
      WHERE ld.lot_project_listing_id = ?
        AND ld.lot_project_listing_document_status = 'active'
      ORDER BY ld.lot_project_listing_document_is_required DESC, d.document_name ASC
    `,
    [row.lot_project_listing_id]
  );

  return {
    project: {
      id: row.lot_project_id,
      slug: row.lot_project_slug,
      name: row.lot_project_name,
      location: row.lot_project_location,
      locationCode: row.lot_project_location_code,
      administrator: row.lot_project_administrator_name,
      taxDeclarationNo: row.lot_project_tax_declaration_no,
      pin: row.lot_project_pin,
      status: row.lot_project_status,
    },
    listing,
    client,
    soaRows: scheduleRows.map(mapSoaRow),
    payments: payments.map(mapPaymentRow),
    documents: documents.map(mapDocumentRow),
  };
};

export const getLotProjectListingProfile = async (req, res) => {
  try {
    const bundle = await getListingProfileBundle(req.params.projectSlug, req.params.listingId);

    if (!bundle) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    return res.json({ success: true, data: bundle });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const updateLotProjectListingStatus = async (req, res) => {
  try {
    const bundle = await getListingProfileBundle(req.params.projectSlug, req.params.listingId);
    if (!bundle) return res.status(404).json({ message: 'Listing not found.' });

    const listingId = bundle.listing.listingId;
    const lotProjectId = bundle.project.id;
    const area = Number(req.body.lotAreaSqm || req.body.area || bundle.listing.lotAreaSqm || 0);
    const pricePerSqm = Number(req.body.pricePerSqm || bundle.listing.pricePerSqm || 0);
    const lmfRate = Number(req.body.legalMiscRate || req.body.lmfRate || bundle.listing.legalMiscRate || 0);
    const netSellingPrice = area * pricePerSqm;
    const lmfAmount = netSellingPrice * (lmfRate / 100);
    const tcp = netSellingPrice + lmfAmount;
    const statusPayload = normalizeListingStatusPayload(req.body.status || req.body.listing_status || bundle.listing.rawStatus);

    await db.query(
      `
        UPDATE lot_project_listings
        SET
          lot_project_listing_unit_type = ?,
          lot_project_listing_unit_id = ?,
          lot_project_listing_old_unit_ids = ?,
          lot_project_listing_area_sqm = ?,
          lot_project_listing_price_per_sqm = ?,
          lot_project_listing_net_selling_price = ?,
          lot_project_listing_lmf_rate = ?,
          lot_project_listing_lmf_amount = ?,
          lot_project_listing_tcp = ?,
          lot_project_listing_reservation_fee = ?,
          lot_project_listing_status = ?,
          lot_project_listing_sold_substatus = ?,
          lot_project_listing_cancellation_type = ?
        WHERE lot_project_listing_id = ?
          AND lot_project_id = ?
      `,
      [
        normalizeLotType(req.body.lotType || req.body.unitType || bundle.listing.lot_type),
        String(req.body.unitCode || req.body.unit_id || bundle.listing.unit_id).trim().toUpperCase(),
        toNullable(req.body.oldUnitIds || req.body.old_unit_ids),
        area,
        pricePerSqm,
        netSellingPrice,
        lmfRate,
        lmfAmount,
        tcp,
        Number(req.body.reservationFee || bundle.listing.reservationFee || 0),
        statusPayload.status,
        statusPayload.soldSubstatus,
        toNullable(req.body.cancellationType || req.body.lot_project_listing_cancellation_type),
        listingId,
        lotProjectId,
      ]
    );

    return res.json({ success: true, message: 'Unit and status saved successfully.' });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const updateLotProjectClientProfile = async (req, res) => {
  try {
    const bundle = await getListingProfileBundle(req.params.projectSlug, req.params.listingId);
    if (!bundle) return res.status(404).json({ message: 'Listing not found.' });

    const body = req.body || {};
    const buyerFullName = buildBuyerFullName(body);
    const secondBuyerName = String(body.secondBuyerName || body.second_buyer_full_name || '').trim() || null;
    const buyerType = body.buyerType || body.buyer_type || 'single';

    await db.query(
      `
        INSERT INTO lot_project_client_profiles (
          lot_project_id,
          lot_project_listing_id,
          buyer_type,
          buyer_first_name,
          buyer_middle_name,
          buyer_last_name,
          buyer_suffix,
          buyer_full_name,
          buyer_birth_date,
          buyer_place_of_birth,
          buyer_citizenship,
          buyer_gender,
          buyer_civil_status,
          buyer_contact_number,
          buyer_email,
          buyer_tin,
          buyer_present_address,
          buyer_permanent_address,
          buyer_employment_status,
          buyer_employer_business_name,
          buyer_employer_business_address,
          buyer_nature_of_work_business,
          buyer_occupation_position,
          buyer_monthly_income,
          second_buyer_full_name,
          second_buyer_birth_date,
          second_buyer_place_of_birth,
          second_buyer_citizenship,
          second_buyer_gender,
          second_buyer_civil_status,
          second_buyer_contact_number,
          second_buyer_email,
          second_buyer_tin,
          second_buyer_present_address,
          second_buyer_permanent_address,
          second_buyer_employment_status,
          second_buyer_employer_business_name,
          second_buyer_employer_business_address,
          second_buyer_nature_of_work_business,
          second_buyer_occupation_position,
          second_buyer_monthly_income,
          lot_project_client_profile_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        ON DUPLICATE KEY UPDATE
          buyer_type = VALUES(buyer_type),
          buyer_first_name = VALUES(buyer_first_name),
          buyer_middle_name = VALUES(buyer_middle_name),
          buyer_last_name = VALUES(buyer_last_name),
          buyer_suffix = VALUES(buyer_suffix),
          buyer_full_name = VALUES(buyer_full_name),
          buyer_birth_date = VALUES(buyer_birth_date),
          buyer_place_of_birth = VALUES(buyer_place_of_birth),
          buyer_citizenship = VALUES(buyer_citizenship),
          buyer_gender = VALUES(buyer_gender),
          buyer_civil_status = VALUES(buyer_civil_status),
          buyer_contact_number = VALUES(buyer_contact_number),
          buyer_email = VALUES(buyer_email),
          buyer_tin = VALUES(buyer_tin),
          buyer_present_address = VALUES(buyer_present_address),
          buyer_permanent_address = VALUES(buyer_permanent_address),
          buyer_employment_status = VALUES(buyer_employment_status),
          buyer_employer_business_name = VALUES(buyer_employer_business_name),
          buyer_employer_business_address = VALUES(buyer_employer_business_address),
          buyer_nature_of_work_business = VALUES(buyer_nature_of_work_business),
          buyer_occupation_position = VALUES(buyer_occupation_position),
          buyer_monthly_income = VALUES(buyer_monthly_income),
          second_buyer_full_name = VALUES(second_buyer_full_name),
          second_buyer_birth_date = VALUES(second_buyer_birth_date),
          second_buyer_place_of_birth = VALUES(second_buyer_place_of_birth),
          second_buyer_citizenship = VALUES(second_buyer_citizenship),
          second_buyer_gender = VALUES(second_buyer_gender),
          second_buyer_civil_status = VALUES(second_buyer_civil_status),
          second_buyer_contact_number = VALUES(second_buyer_contact_number),
          second_buyer_email = VALUES(second_buyer_email),
          second_buyer_tin = VALUES(second_buyer_tin),
          second_buyer_present_address = VALUES(second_buyer_present_address),
          second_buyer_permanent_address = VALUES(second_buyer_permanent_address),
          second_buyer_employment_status = VALUES(second_buyer_employment_status),
          second_buyer_employer_business_name = VALUES(second_buyer_employer_business_name),
          second_buyer_employer_business_address = VALUES(second_buyer_employer_business_address),
          second_buyer_nature_of_work_business = VALUES(second_buyer_nature_of_work_business),
          second_buyer_occupation_position = VALUES(second_buyer_occupation_position),
          second_buyer_monthly_income = VALUES(second_buyer_monthly_income),
          lot_project_client_profile_status = 'active'
      `,
      [
        bundle.project.id,
        bundle.listing.listingId,
        buyerType,
        toNullable(body.firstName || body.buyer_first_name),
        toNullable(body.middleName || body.buyer_middle_name),
        toNullable(body.lastName || body.buyer_last_name),
        toNullable(body.suffix || body.buyer_suffix),
        toNullable(buyerFullName),
        toNullable(body.birthDate || body.buyer_birth_date),
        toNullable(body.placeOfBirth || body.buyer_place_of_birth),
        toNullable(body.citizenship || body.buyer_citizenship),
        toNullable(body.gender || body.buyer_gender),
        toNullable(body.civilStatus || body.buyer_civil_status),
        toNullable(body.contactNo || body.buyer_contact_number),
        toNullable(body.email || body.buyer_email),
        toNullable(body.tin || body.buyer_tin),
        toNullable(body.presentAddress || body.buyer_present_address),
        toNullable(body.permanentAddress || body.buyer_permanent_address),
        toNullable(body.employmentStatus || body.buyer_employment_status),
        toNullable(body.employerBusinessName || body.buyer_employer_business_name),
        toNullable(body.employerBusinessAddress || body.buyer_employer_business_address),
        toNullable(body.natureOfWorkBusiness || body.buyer_nature_of_work_business),
        toNullable(body.occupationPositionTitle || body.buyer_occupation_position),
        Number(body.monthlyIncome || body.buyer_monthly_income || 0),
        secondBuyerName,
        toNullable(body.secondBuyerBirthDate),
        toNullable(body.secondBuyerPlaceOfBirth),
        toNullable(body.secondBuyerCitizenship),
        toNullable(body.secondBuyerGender),
        toNullable(body.secondBuyerCivilStatus),
        toNullable(body.secondBuyerContactNo),
        toNullable(body.secondBuyerEmail),
        toNullable(body.secondBuyerTin),
        toNullable(body.secondBuyerPresentAddress),
        toNullable(body.secondBuyerPermanentAddress),
        toNullable(body.secondBuyerEmploymentStatus),
        toNullable(body.secondBuyerEmployerBusinessName),
        toNullable(body.secondBuyerEmployerBusinessAddress),
        toNullable(body.secondBuyerNatureOfWorkBusiness),
        toNullable(body.secondBuyerOccupationPositionTitle),
        Number(body.secondBuyerMonthlyIncome || 0),
      ]
    );

    return res.json({ success: true, message: 'Client profile saved successfully.' });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

const generateCashReference = (unitCode) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const cleanUnit = String(unitCode || 'UNIT').replace(/[^a-zA-Z0-9]/g, '');
  const random = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `CASH-${date}-${cleanUnit}-${random}`;
};

export const addLotProjectPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const bundle = await getListingProfileBundle(req.params.projectSlug, req.params.listingId, connection);
    if (!bundle) return res.status(404).json({ message: 'Listing not found.' });
    if (!bundle.client?.lot_project_client_profile_id) {
      return res.status(400).json({ message: 'Client profile is required before adding payments.' });
    }

    const body = req.body || {};
    const scheduleId = Number(body.soaRowId || body.lot_project_payment_schedule_id);
    const amount = Number(body.amount || body.lot_project_payment_amount || 0);
    const method = body.method || body.lot_project_payment_method || 'Cash';
    const paymentDate = body.paymentDate || body.lot_project_payment_date || new Date().toISOString().slice(0, 10);
    const paymentType = String(body.paymentType || body.lot_project_payment_type || 'other').toLowerCase().replace(/\s+/g, '_').replace(/\//g, '_');
    const referenceId = method === 'Cash' ? (body.referenceId || generateCashReference(bundle.listing.unit_id)) : String(body.referenceId || '').trim();

    if (!scheduleId) return res.status(400).json({ message: 'SOA row is required.' });
    if (amount <= 0) return res.status(400).json({ message: 'Payment amount must be greater than 0.' });
    if (method !== 'Cash' && !referenceId) return res.status(400).json({ message: 'Reference ID is required for non-cash payments.' });

    await connection.beginTransaction();

    const allowedTypes = new Set(['reservation', 'downpayment', 'monthly_amortization', 'legal_misc', 'full_payment', 'other']);
    const finalType = allowedTypes.has(paymentType) ? paymentType : paymentType.includes('reservation') ? 'reservation' : paymentType.includes('downpayment') ? 'downpayment' : paymentType.includes('monthly') ? 'monthly_amortization' : paymentType.includes('legal') ? 'legal_misc' : paymentType.includes('full') ? 'full_payment' : 'other';

    const [paymentResult] = await connection.query(
      `
        INSERT INTO lot_project_payments (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_payment_schedule_id,
          lot_project_payment_type,
          lot_project_payment_method,
          lot_project_payment_amount,
          lot_project_payment_date,
          lot_project_payment_reference_id,
          lot_project_payment_status,
          lot_project_payment_verified_by_user_id,
          lot_project_payment_verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified', NULL, NOW())
      `,
      [bundle.project.id, bundle.listing.listingId, bundle.client.lot_project_client_profile_id, scheduleId, finalType, method, amount, paymentDate, referenceId]
    );

    await connection.query(
      `
        UPDATE lot_project_payment_schedules
        SET
          amount_paid = amount_paid + ?,
          date_paid = ?,
          reference_id = ?,
          ending_balance = GREATEST(beginning_balance - (amount_paid + ?), 0),
          schedule_status = CASE
            WHEN amount_paid + ? >= due_amount + penalty_amount THEN 'Paid'
            WHEN amount_paid + ? > 0 THEN 'Partial'
            ELSE schedule_status
          END
        WHERE lot_project_payment_schedule_id = ?
          AND lot_project_listing_id = ?
      `,
      [amount, paymentDate, referenceId, amount, amount, amount, scheduleId, bundle.listing.listingId]
    );

    await connection.query(
      `
        INSERT INTO lot_project_payment_logs (
          lot_project_payment_id,
          action_type,
          action_description,
          action_by_user_id
        ) VALUES (?, 'created', ?, NULL)
      `,
      [paymentResult.insertId, `Payment recorded for ${bundle.listing.unit_id}.`]
    );

    await connection.commit();

    return res.status(201).json({ success: true, message: 'Payment saved successfully.', reference_id: referenceId });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const uploadLotProjectClientDocument = async (req, res) => {
  try {
    const bundle = await getListingProfileBundle(req.params.projectSlug, req.params.listingId);
    if (!bundle) return res.status(404).json({ message: 'Listing not found.' });
    if (!bundle.client?.lot_project_client_profile_id) return res.status(400).json({ message: 'Client profile is required before uploading documents.' });

    const documentId = Number(req.params.documentId);
    const fileName = String(req.body.fileName || req.body.file_name || '').trim();
    const fileUrl = String(req.body.fileUrl || req.body.file_url || '').trim() || '/docImage1.png';

    if (!documentId) return res.status(400).json({ message: 'Invalid document id.' });
    if (!fileName) return res.status(400).json({ message: 'File name is required.' });

    await db.query(
      `
        INSERT INTO lot_project_client_documents (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          document_id,
          lot_project_client_document_file_name,
          lot_project_client_document_file_url,
          lot_project_client_document_status,
          lot_project_client_document_uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'Submitted', NOW())
        ON DUPLICATE KEY UPDATE
          lot_project_client_document_file_name = VALUES(lot_project_client_document_file_name),
          lot_project_client_document_file_url = VALUES(lot_project_client_document_file_url),
          lot_project_client_document_status = 'Submitted',
          lot_project_client_document_uploaded_at = NOW(),
          lot_project_client_document_approved_at = NULL,
          lot_project_client_document_approved_by_user_id = NULL
      `,
      [bundle.project.id, bundle.listing.listingId, bundle.client.lot_project_client_profile_id, documentId, fileName, fileUrl]
    );

    return res.json({ success: true, message: 'Document uploaded and marked as submitted.' });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const updateLotProjectClientDocumentStatus = async (req, res) => {
  try {
    const bundle = await getListingProfileBundle(req.params.projectSlug, req.params.listingId);
    if (!bundle) return res.status(404).json({ message: 'Listing not found.' });
    if (!bundle.client?.lot_project_client_profile_id) return res.status(400).json({ message: 'Client profile is required before updating documents.' });

    const documentId = Number(req.params.documentId);
    const status = req.body.status || 'Approved';
    const allowed = new Set(['Missing', 'Submitted', 'Approved', 'Rejected']);
    const finalStatus = allowed.has(status) ? status : 'Submitted';

    await db.query(
      `
        INSERT INTO lot_project_client_documents (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          document_id,
          lot_project_client_document_status,
          lot_project_client_document_approved_at
        ) VALUES (?, ?, ?, ?, ?, IF(? = 'Approved', NOW(), NULL))
        ON DUPLICATE KEY UPDATE
          lot_project_client_document_status = VALUES(lot_project_client_document_status),
          lot_project_client_document_approved_at = IF(VALUES(lot_project_client_document_status) = 'Approved', NOW(), NULL)
      `,
      [bundle.project.id, bundle.listing.listingId, bundle.client.lot_project_client_profile_id, documentId, finalStatus, finalStatus]
    );

    return res.json({ success: true, message: `Document marked as ${finalStatus}.` });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const clearLotProjectClientDocument = async (req, res) => {
  try {
    const bundle = await getListingProfileBundle(req.params.projectSlug, req.params.listingId);
    if (!bundle) return res.status(404).json({ message: 'Listing not found.' });

    const documentId = Number(req.params.documentId);

    await db.query(
      `
        UPDATE lot_project_client_documents
        SET
          lot_project_client_document_file_name = NULL,
          lot_project_client_document_file_url = NULL,
          lot_project_client_document_status = 'Missing',
          lot_project_client_document_uploaded_at = NULL,
          lot_project_client_document_approved_at = NULL,
          lot_project_client_document_approved_by_user_id = NULL
        WHERE lot_project_listing_id = ?
          AND document_id = ?
      `,
      [bundle.listing.listingId, documentId]
    );

    return res.json({ success: true, message: 'Document cleared and marked as missing.' });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getLotProjectListingPrintPayload = async (req, res) => {
  try {
    const bundle = await getListingProfileBundle(req.params.projectSlug, req.params.listingId);
    if (!bundle) return res.status(404).json({ message: 'Listing not found.' });

    return res.json({ success: true, data: bundle });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

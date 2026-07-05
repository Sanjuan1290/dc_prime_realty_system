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


const columnExists = async (connection, tableName, columnName) => {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  );

  return Number(rows[0]?.total || 0) > 0;
};

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const plainDate = (value) => {
  if (!value) return '-';
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};

const formatDateTime = (value) => {
  if (!value) return '-';
  if (typeof value === 'string') return value.replace('T', ' ').slice(0, 16);
  return new Date(value).toISOString().replace('T', ' ').slice(0, 16);
};

const toDisplayValue = (value, fallback = '-') => {
  const clean = String(value ?? '').trim();
  return clean || fallback;
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


const getListingLookupWhere = (value) => {
  const clean = String(value || '').trim();
  if (/^\d+$/.test(clean)) {
    return {
      sql: 'l.lot_project_listing_id = ?',
      params: [Number(clean)],
    };
  }

  return {
    sql: 'l.lot_project_listing_unit_id = ?',
    params: [clean.toUpperCase()],
  };
};

const mapClientProfile = (profile = {}, sellerName = '-') => ({
  profileStatus: profile.lot_project_client_profile_id ? profile.lot_project_client_profile_status || 'active' : 'incomplete',
  buyerType: profile.buyer_type || 'single',
  buyerRole: 'Principal Buyer',
  buyerName: profile.buyer_full_name || '-',
  birthDate: plainDate(profile.buyer_birth_date) === '-' ? '' : plainDate(profile.buyer_birth_date),
  placeOfBirth: profile.buyer_place_of_birth || '',
  computedAge: '-',
  citizenship: profile.buyer_citizenship || '',
  gender: profile.buyer_gender || '',
  civilStatus: profile.buyer_civil_status || '',
  contactNo: profile.buyer_contact_number || '',
  residencePhoneNumber: '',
  email: profile.buyer_email || '',
  tin: profile.buyer_tin || '',
  presentAddress: profile.buyer_present_address || '',
  presentZipCode: '',
  permanentAddress: profile.buyer_permanent_address || '',
  permanentZipCode: '',
  employmentStatus: profile.buyer_employment_status || '',
  employerBusinessName: profile.buyer_employer_business_name || '',
  employerZipCode: '',
  natureOfWorkBusiness: profile.buyer_nature_of_work_business || '',
  occupationPositionTitle: profile.buyer_occupation_position || '',
  monthlyIncome: profile.buyer_monthly_income ? money(profile.buyer_monthly_income) : '',
  employerBusinessAddress: profile.buyer_employer_business_address || '',
  secondBuyerRole: profile.buyer_type === 'spouses' ? 'spouse' : 'co-owner',
  secondBuyerName: profile.second_buyer_full_name || '',
  secondBuyerBirthDate: plainDate(profile.second_buyer_birth_date) === '-' ? '' : plainDate(profile.second_buyer_birth_date),
  secondBuyerPlaceOfBirth: profile.second_buyer_place_of_birth || '',
  secondBuyerComputedAge: '-',
  secondBuyerCitizenship: profile.second_buyer_citizenship || '',
  secondBuyerGender: profile.second_buyer_gender || '',
  secondBuyerCivilStatus: profile.second_buyer_civil_status || '',
  secondBuyerContactNo: profile.second_buyer_contact_number || '',
  secondBuyerResidencePhoneNumber: '',
  secondBuyerEmail: profile.second_buyer_email || '',
  secondBuyerTin: profile.second_buyer_tin || '',
  secondBuyerPresentAddress: profile.second_buyer_present_address || '',
  secondBuyerPresentZipCode: '',
  secondBuyerPermanentAddress: profile.second_buyer_permanent_address || '',
  secondBuyerPermanentZipCode: '',
  secondBuyerEmploymentStatus: profile.second_buyer_employment_status || '',
  secondBuyerEmployerBusinessName: profile.second_buyer_employer_business_name || '',
  secondBuyerEmployerZipCode: '',
  secondBuyerNatureOfWorkBusiness: profile.second_buyer_nature_of_work_business || '',
  secondBuyerOccupationPositionTitle: profile.second_buyer_occupation_position || '',
  secondBuyerMonthlyIncome: profile.second_buyer_monthly_income ? money(profile.second_buyer_monthly_income) : '',
  secondBuyerEmployerBusinessAddress: profile.second_buyer_employer_business_address || '',
  seller: sellerName || '-',
});

const mapProfileListing = (row = {}, project = {}, documents = []) => {
  const area = Number(row.lot_project_listing_area_sqm || 0);
  const pricePerSqm = Number(row.lot_project_listing_price_per_sqm || 0);
  const netSellingPrice = Number(row.lot_project_listing_net_selling_price || 0);
  const lmfRate = Number(row.lot_project_listing_lmf_rate || 0);
  const lmfAmount = Number(row.lot_project_listing_lmf_amount || 0);
  const tcp = Number(row.lot_project_listing_tcp || 0);
  const reservationFee = Number(row.lot_project_listing_reservation_fee || 0);
  const annualInterestRate = Number(row.annual_interest_rate || 0);
  const totalPaid = Number(row.total_paid || 0);
  const balance = Math.max(tcp - totalPaid, 0);
  const paymentCount = Number(row.payment_count || 0);
  const submittedDocuments = documents.filter((doc) => doc.status === 'Submitted' || doc.status === 'Approved').length;
  const approvedDocuments = documents.filter((doc) => doc.status === 'Approved').length;
  const requiredDocuments = documents.filter((doc) => doc.requirement === 'Required').length;
  const missingRequired = documents.filter((doc) => doc.requirement === 'Required' && doc.status === 'Missing').length;
  const listingStatus = getListingStatusLabel(row.lot_project_listing_status, row.lot_project_listing_sold_substatus);

  return {
    ...row,
    id: row.lot_project_listing_id,
    lot_project_listing_id: row.lot_project_listing_id,
    unit_id: row.lot_project_listing_unit_id,
    unitCode: row.lot_project_listing_unit_id,
    project_name: project.lot_project_name,
    projectName: project.lot_project_name,
    project_location: project.lot_project_location,
    locationCode: project.lot_project_location_code,
    administrator: project.lot_project_administrator_name || '-',
    cadastral_lot_no: row.cadastral_lots || '-',
    old_unit_ids: row.lot_project_listing_old_unit_ids || '-',
    lot_type: normalizeLotType(row.lot_project_listing_unit_type),
    listing_status: listingStatus,
    rawStatus: row.lot_project_listing_status,
    soldSubstatus: row.lot_project_listing_sold_substatus,
    status: listingStatus,
    lot_area_sqm: `${area} sqm`,
    lotAreaSqm: area,
    area,
    price_per_sqm: money(pricePerSqm),
    pricePerSqm,
    net_selling_price: money(netSellingPrice),
    netSellingPrice,
    lmf_rate: `${lmfRate}%`,
    lmfRate,
    legalMiscRate: lmfRate,
    lmf_amount: money(lmfAmount),
    lmfAmount,
    tcp: money(tcp),
    tcpAmount: tcp,
    reservationFee,
    annualInterestRate,
    interestRate: `${annualInterestRate.toFixed(2)}%`,
    buyer_name: row.buyer_full_name || '-',
    spouse_co_owner: row.second_buyer_full_name || '-',
    email: row.buyer_email || '-',
    contact_no: row.buyer_contact_number || '-',
    address: row.buyer_present_address || '-',
    region: '-',
    assigned_user: row.assigned_user_name || '-',
    due_day: row.first_due_date ? plainDate(row.first_due_date) : '-',
    total_paid: money(totalPaid),
    totalPaid,
    balance: money(balance),
    balanceAmount: balance,
    payment_status: paymentCount === 0 ? 'Unpaid' : balance <= 0 ? 'Paid' : 'Partial',
    payment_count: String(paymentCount),
    latest_payment_date: row.latest_payment_date ? plainDate(row.latest_payment_date) : '-',
    latest_payment_amount: money(row.latest_payment_amount || 0),
    seller: row.seller_name || '-',
    seller_role: row.seller_role || '-',
    reports_under: row.reports_under || '-',
    commission_rate: row.commission_rate ? `${Number(row.commission_rate)}%` : '-',
    commission_amount: money(row.gross_commission_amount || 0),
    released_amount: money(row.released_amount || 0),
    remaining_commission: money(Math.max(Number(row.gross_commission_amount || 0) - Number(row.released_amount || 0), 0)),
    commission_status: row.commission_status || '-',
    total_documents: String(documents.length),
    required_documents: String(requiredDocuments),
    submitted_documents: String(submittedDocuments),
    approved_documents: String(approvedDocuments),
    missing_required: String(missingRequired),
    document_status: missingRequired > 0 ? 'Incomplete' : documents.length ? 'Complete' : 'No checklist',
    created_at: formatDateTime(row.lot_project_listing_created_at),
    updated_at: formatDateTime(row.lot_project_listing_updated_at),
    client_unit_created: formatDateTime(row.lot_project_client_profile_created_at),
    client_unit_updated: formatDateTime(row.lot_project_client_profile_updated_at),
  };
};

const getListingDocuments = async (connection, lotProjectId, listingId, clientProfileId) => {
  const hasListingDocuments = await tableExists(connection, 'lot_project_listing_documents');
  const hasClientDocuments = await tableExists(connection, 'lot_project_client_documents');

  if (!hasListingDocuments) return [];

  const clientDocumentJoin = hasClientDocuments && clientProfileId
    ? `
        LEFT JOIN lot_project_client_documents cd
          ON cd.document_id = d.document_id
          AND cd.lot_project_listing_id = lpd.lot_project_listing_id
          AND cd.lot_project_client_profile_id = ?
      `
    : `LEFT JOIN (SELECT NULL AS document_id, NULL AS lot_project_client_document_file_name, NULL AS lot_project_client_document_file_url, 'Missing' AS lot_project_client_document_status) cd ON 1 = 0`;

  const params = hasClientDocuments && clientProfileId
    ? [clientProfileId, lotProjectId, listingId]
    : [lotProjectId, listingId];

  const [rows] = await connection.query(
    `
      SELECT
        lpd.lot_project_listing_document_id,
        lpd.document_id,
        lpd.lot_project_listing_document_is_required,
        d.document_name,
        d.document_description,
        cd.lot_project_client_document_file_name,
        cd.lot_project_client_document_file_url,
        cd.lot_project_client_document_status
      FROM lot_project_listing_documents lpd
      INNER JOIN documents d ON d.document_id = lpd.document_id
      ${clientDocumentJoin}
      WHERE lpd.lot_project_id = ?
        AND lpd.lot_project_listing_id = ?
        AND lpd.lot_project_listing_document_status = 'active'
      ORDER BY lpd.lot_project_listing_document_is_required DESC, d.document_name ASC
    `,
    params
  );

  return rows.map((document) => ({
    id: document.lot_project_listing_document_id,
    document_id: document.document_id,
    name: document.document_name,
    description: document.document_description || 'Document requirement',
    requirement: document.lot_project_listing_document_is_required ? 'Required' : 'Optional',
    status: document.lot_project_client_document_status || 'Missing',
    fileName: document.lot_project_client_document_file_name || '-',
    fileUrl: document.lot_project_client_document_file_url || '',
    images: document.lot_project_client_document_file_url ? [document.lot_project_client_document_file_url] : [],
  }));
};

const getListingSoaRows = async (connection, lotProjectId, listingId) => {
  if (!(await tableExists(connection, 'lot_project_payment_schedules'))) return [];

  const [rows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payment_schedules
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
      ORDER BY due_date ASC, lot_project_payment_schedule_id ASC
    `,
    [lotProjectId, listingId]
  );

  return rows.map((row) => ({
    id: row.lot_project_payment_schedule_id,
    dueDate: plainDate(row.due_date),
    description: row.description,
    beginningBalance: Number(row.beginning_balance || 0),
    dueAmount: Number(row.due_amount || 0),
    penalty: Number(row.penalty_amount || 0),
    datePaid: row.date_paid ? plainDate(row.date_paid) : '-',
    amountPaid: Number(row.amount_paid || 0),
    referenceId: row.reference_id || '-',
    status: row.schedule_status || 'Unpaid',
    endingBalance: Number(row.ending_balance || 0),
  }));
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
          schedule_summary.first_due_date,
          CONCAT_WS(' ', seller.first_name, seller.middle_name, seller.last_name) AS seller_name,
          seller.role AS seller_role,
          CONCAT_WS(' ', sellerReports.first_name, sellerReports.middle_name, sellerReports.last_name) AS reports_under,
          commission.commission_rate,
          commission.gross_commission_amount,
          commission.released_commission_amount AS released_amount,
          commission.commission_status,
          NULL AS assigned_user_name
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
          SELECT lot_project_listing_id, MIN(due_date) AS first_due_date
          FROM lot_project_payment_schedules
          GROUP BY lot_project_listing_id
        ) schedule_summary ON schedule_summary.lot_project_listing_id = l.lot_project_listing_id
        LEFT JOIN (
          SELECT
            lot_project_listing_id,
            accredited_seller_id,
            commission_rate,
            gross_commission_amount,
            released_commission_amount,
            commission_status
          FROM lot_project_commissions
          WHERE commission_seller_type IN ('main_seller', 'selling_agent')
          GROUP BY lot_project_listing_id, accredited_seller_id, commission_rate, gross_commission_amount, released_commission_amount, commission_status
        ) commission ON commission.lot_project_listing_id = l.lot_project_listing_id
        LEFT JOIN accredited_sellers acs ON acs.accredited_seller_id = commission.accredited_seller_id
        LEFT JOIN users seller ON seller.id = acs.user_id
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
    const soaRows = await getListingSoaRows(connection, project.lot_project_id, row.lot_project_listing_id);
    const cadastralLots = await getProjectCadastralLots(project.lot_project_id);
    const defaultDocuments = await getProjectDefaultDocuments(project.lot_project_id);
    const sellerName = row.seller_name || '-';

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
        listing: mapProfileListing(row, project, documents),
        client: mapClientProfile(row, sellerName),
        soaRows,
        documents,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateLotProjectListing = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });

    const unitCode = String(req.body.unitCode || req.body.unit_id || '').trim().toUpperCase();
    const pricePerSqm = Number(req.body.pricePerSqm ?? req.body.price_per_sqm ?? 0);
    const lotAreaSqm = Number(req.body.lotAreaSqm ?? req.body.area ?? 0);
    const legalMiscRate = Number(req.body.legalMiscRate ?? req.body.lmfRate ?? 0);
    const reservationFee = Number(req.body.reservationFee ?? 0);
    const annualInterestRate = Number(req.body.annualInterestRate ?? 0);
    const listingStatus = normalizeListingStatusPayload(req.body.status || req.body.rawStatus || req.body.listing_status);

    if (!unitCode) return res.status(400).json({ message: 'Unit ID is required.' });
    if (!unitCode.startsWith(`${project.lot_project_location_code}-`)) {
      return res.status(400).json({ message: `Unit ID must start with ${project.lot_project_location_code}-.` });
    }
    if (pricePerSqm <= 0) return res.status(400).json({ message: 'Price per SQM must be greater than 0.' });
    if (lotAreaSqm <= 0) return res.status(400).json({ message: 'Lot area SQM must be greater than 0.' });

    const lookup = getListingLookupWhere(listingLookup);
    const netSellingPrice = pricePerSqm * lotAreaSqm;
    const lmfAmount = netSellingPrice * (legalMiscRate / 100);
    const tcp = netSellingPrice + lmfAmount;
    const hasAnnualInterestRate = await columnExists(connection, 'lot_project_listings', 'annual_interest_rate');
    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');

    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
        SELECT lot_project_listing_id
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

    const updateColumns = [
      'lot_project_listing_unit_type = ?',
      'lot_project_listing_unit_id = ?',
      'lot_project_listing_old_unit_ids = ?',
      'lot_project_listing_area_sqm = ?',
      'lot_project_listing_price_per_sqm = ?',
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
      pricePerSqm,
      netSellingPrice,
      legalMiscRate,
      lmfAmount,
      tcp,
      reservationFee,
      listingStatus.status,
      listingStatus.soldSubstatus,
    ];

    if (hasAnnualInterestRate) {
      updateColumns.push('annual_interest_rate = ?');
      updateParams.push(annualInterestRate);
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

    await connection.commit();

    return res.json({
      success: true,
      message: `${unitCode} updated successfully.`,
      listing_id: existingListing.lot_project_listing_id,
      unit_id: unitCode,
    });
  } catch (error) {
    await connection.rollback();
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

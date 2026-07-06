import { db } from '../../db/connect.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

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

const computeAgeFromDate = (birthDate) => {
  if (!birthDate) return '-';

  const birth = new Date(birthDate);
  const today = new Date();

  if (Number.isNaN(birth.getTime())) return '-';

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? String(age) : '-';
};

const getClientCompletionStatus = (profile = {}) => {
  const buyerType = profile.buyer_type || 'single';
  const hasSecondBuyer = buyerType === 'spouses' || buyerType === 'and_account';

  const required = [
    profile.buyer_full_name,
    profile.buyer_contact_number,
    profile.buyer_email,
    profile.buyer_present_address,
  ];

  if (hasSecondBuyer) {
    required.push(
      profile.second_buyer_full_name,
      profile.second_buyer_contact_number,
      profile.second_buyer_email
    );
  }

  return required.some((value) => !String(value || '').trim()) ? 'incomplete' : 'complete';
};

const mapClientProfile = (profile = {}, sellerName = '-') => ({
  id: profile.lot_project_client_profile_id || null,
  lot_project_client_profile_id: profile.lot_project_client_profile_id || null,
  profileStatus: getClientCompletionStatus(profile),
  accountStatus: profile.lot_project_client_profile_status || 'active',
  buyerType: profile.buyer_type || 'single',
  buyerRole: 'Principal Buyer',
  buyerName: profile.buyer_full_name || '',
  birthDate: plainDate(profile.buyer_birth_date) === '-' ? '' : plainDate(profile.buyer_birth_date),
  placeOfBirth: profile.buyer_place_of_birth || '',
  computedAge: computeAgeFromDate(profile.buyer_birth_date),
  citizenship: profile.buyer_citizenship || '',
  gender: profile.buyer_gender || '',
  civilStatus: profile.buyer_civil_status || '',
  contactNo: profile.buyer_contact_number || '',
  residencePhoneNumber: profile.buyer_residence_phone_number || '',
  email: profile.buyer_email || '',
  tin: profile.buyer_tin || '',
  presentAddress: profile.buyer_present_address || '',
  presentZipCode: profile.buyer_present_zip_code || '',
  permanentAddress: profile.buyer_permanent_address || '',
  permanentZipCode: profile.buyer_permanent_zip_code || '',
  employmentStatus: profile.buyer_employment_status || '',
  employerBusinessName: profile.buyer_employer_business_name || '',
  employerZipCode: profile.buyer_employer_zip_code || '',
  natureOfWorkBusiness: profile.buyer_nature_of_work_business || '',
  occupationPositionTitle: profile.buyer_occupation_position || '',
  monthlyIncome: profile.buyer_monthly_income ? money(profile.buyer_monthly_income) : '',
  employerBusinessAddress: profile.buyer_employer_business_address || '',
  secondBuyerRole: profile.second_buyer_role || (profile.buyer_type === 'spouses' ? 'spouse' : 'co_owner'),
  secondBuyerName: profile.second_buyer_full_name || '',
  secondBuyerBirthDate: plainDate(profile.second_buyer_birth_date) === '-' ? '' : plainDate(profile.second_buyer_birth_date),
  secondBuyerPlaceOfBirth: profile.second_buyer_place_of_birth || '',
  secondBuyerComputedAge: computeAgeFromDate(profile.second_buyer_birth_date),
  secondBuyerCitizenship: profile.second_buyer_citizenship || '',
  secondBuyerGender: profile.second_buyer_gender || '',
  secondBuyerCivilStatus: profile.second_buyer_civil_status || '',
  secondBuyerContactNo: profile.second_buyer_contact_number || '',
  secondBuyerResidencePhoneNumber: profile.second_buyer_residence_phone_number || '',
  secondBuyerEmail: profile.second_buyer_email || '',
  secondBuyerTin: profile.second_buyer_tin || '',
  secondBuyerPresentAddress: profile.second_buyer_present_address || '',
  secondBuyerPresentZipCode: profile.second_buyer_present_zip_code || '',
  secondBuyerPermanentAddress: profile.second_buyer_permanent_address || '',
  secondBuyerPermanentZipCode: profile.second_buyer_permanent_zip_code || '',
  secondBuyerEmploymentStatus: profile.second_buyer_employment_status || '',
  secondBuyerEmployerBusinessName: profile.second_buyer_employer_business_name || '',
  secondBuyerEmployerZipCode: profile.second_buyer_employer_zip_code || '',
  secondBuyerNatureOfWorkBusiness: profile.second_buyer_nature_of_work_business || '',
  secondBuyerOccupationPositionTitle: profile.second_buyer_occupation_position || '',
  secondBuyerMonthlyIncome: profile.second_buyer_monthly_income ? money(profile.second_buyer_monthly_income) : '',
  secondBuyerEmployerBusinessAddress: profile.second_buyer_employer_business_address || '',
  seller: sellerName || '-',
});

const canEditBuyerProfileForListing = (status) => {
  const statusKey = String(status || '').trim().toLowerCase();
  return Boolean(statusKey && !['available', 'hold'].includes(statusKey));
};

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
  const hasClientProfile = Boolean(row.lot_project_client_profile_id || row.buyer_full_name);
  const canEditBuyerProfile = canEditBuyerProfileForListing(row.lot_project_listing_status);
  const canUsePayments = hasClientProfile && canEditBuyerProfile;

  return {
    ...row,
    id: row.lot_project_listing_id,
    lot_project_listing_id: row.lot_project_listing_id,
    lot_project_client_profile_id: row.lot_project_client_profile_id || null,
    clientProfileId: row.lot_project_client_profile_id || null,
    hasClientProfile,
    canEditBuyerProfile,
    canUsePayments,
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

const roundMoneyValue = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeDateInput = (value) => {
  if (!value || value === '-') return new Date().toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};

const addMonthsToDate = (value, months = 0) => {
  const base = new Date(`${normalizeDateInput(value)}T00:00:00`);
  const result = Number.isNaN(base.getTime()) ? new Date() : new Date(base);
  const originalDay = result.getDate();

  result.setMonth(result.getMonth() + Number(months || 0));

  if (result.getDate() !== originalDay) {
    result.setDate(0);
  }

  return result.toISOString().slice(0, 10);
};

const getOrdinalLabel = (number) => {
  const value = Number(number || 0);
  const lastTwo = value % 100;

  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;

  const last = value % 10;
  if (last === 1) return `${value}st`;
  if (last === 2) return `${value}nd`;
  if (last === 3) return `${value}rd`;
  return `${value}th`;
};

const getScheduleTotalDue = (row = {}) =>
  roundMoneyValue(Number(row.dueAmount || 0) + Number(row.interest || 0) + Number(row.penalty || 0));

const appendPaymentReference = (row, payment) => {
  const reference = payment.referenceId || payment.lot_project_payment_reference_id || '-';
  const paidDate = payment.paymentDate || payment.lot_project_payment_date || '-';

  row.datePaid = paidDate && paidDate !== '-' ? normalizeDateInput(paidDate) : '-';

  if (!row.referenceId || row.referenceId === '-') {
    row.referenceId = reference;
  } else if (reference && reference !== '-' && !String(row.referenceId).split(', ').includes(reference)) {
    row.referenceId = `${row.referenceId}, ${reference}`;
  }
};

const getPaymentAmountValue = (payment = {}) =>
  roundMoneyValue(payment.amount ?? payment.lot_project_payment_amount ?? 0);

const createBalloonPrincipalRow = (payment = {}, index = 1) => {
  const paymentId = payment.paymentId || payment.id || payment.lot_project_payment_id || index;
  const paidDate = payment.paymentDate || payment.lot_project_payment_date || new Date();
  const amountPaid = getPaymentAmountValue(payment);
  const referenceId = payment.referenceId || payment.lot_project_payment_reference_id || '-';

  return {
    id: `balloon-${paymentId}`,
    scheduleType: 'balloon',
    sequence: 100000 + Number(index || 0),
    dueDate: normalizeDateInput(paidDate),
    description: 'Balloon Payment',
    beginningBalance: 0,
    dueAmount: 0,
    interest: 0,
    penalty: 0,
    datePaid: normalizeDateInput(paidDate),
    amountPaid,
    referenceId,
    status: amountPaid > 0 ? 'Paid' : 'Unpaid',
    endingBalance: 0,
  };
};

const getRowSortOrder = (row = {}) => {
  const order = {
    reservation: 1,
    downpayment: 2,
    monthly: 3,
    full_payment: 3,
    balloon: 4,
  };

  return order[row.scheduleType] || 9;
};

const sortComputedRows = (rows = []) =>
  [...rows].sort((a, b) => {
    const dateCompare = String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
    if (dateCompare !== 0) return dateCompare;

    const orderCompare = getRowSortOrder(a) - getRowSortOrder(b);
    if (orderCompare !== 0) return orderCompare;

    return Number(a.sequence || 0) - Number(b.sequence || 0);
  });

const getComputedSoaTerms = (listingRow = {}, existingScheduleRows = []) => {
  const tcp = roundMoneyValue(listingRow.lot_project_listing_tcp || listingRow.tcp || 0);
  const firstExistingRow = existingScheduleRows[0] || {};
  const existingReservationRow = existingScheduleRows.find((row) =>
    String(row.description || '').toLowerCase().includes('reservation')
  );
  const existingDownpaymentRows = existingScheduleRows.filter((row) =>
    String(row.description || '').toLowerCase().includes('downpayment')
  );
  const existingMonthlyRows = existingScheduleRows.filter((row) =>
    String(row.description || '').toLowerCase().includes('monthly')
  );

  const reservationFee = roundMoneyValue(
    listingRow.reservation_fee ||
      listingRow.soa_reservation_fee ||
      existingReservationRow?.due_amount ||
      listingRow.lot_project_listing_reservation_fee ||
      0
  );

  const downpaymentPercentage = Number(
    listingRow.downpayment_percentage || listingRow.soa_downpayment_percentage || 30
  );
  const dpDiscountPercentage = Number(
    listingRow.dp_discount_percentage || listingRow.soa_dp_discount_percentage || 0
  );

  const inferredDownpaymentTotal = existingDownpaymentRows.reduce(
    (sum, row) => sum + Number(row.due_amount || 0),
    0
  );
  const computedDownpaymentTotal = roundMoneyValue(
    tcp * (downpaymentPercentage / 100) * (1 - dpDiscountPercentage / 100)
  );

  const downpaymentTotal = roundMoneyValue(inferredDownpaymentTotal || computedDownpaymentTotal);

  const downpaymentTerms = Math.max(
    Number(
      listingRow.downpayment_terms ??
        listingRow.soa_downpayment_terms ??
        (existingDownpaymentRows.length || 3)
    ),
    0
  );

  const monthlyTerms = Math.max(
    Number(
      listingRow.monthly_terms ??
        listingRow.soa_monthly_terms ??
        (existingMonthlyRows.length || 36)
    ),
    1
  );

  const startingDate = normalizeDateInput(
    listingRow.soa_starting_date || listingRow.starting_date || firstExistingRow.due_date || new Date()
  );
  const firstDueDate = normalizeDateInput(
    listingRow.soa_first_due_date || listingRow.first_due_date || firstExistingRow.due_date || startingDate
  );

  const annualInterestRate = Number(
    listingRow.soa_annual_interest_rate ?? listingRow.annual_interest_rate ?? 0
  );

  const financedBalance = Math.max(tcp - reservationFee - downpaymentTotal, 0);
  const inferredMonthlyPrincipal = Number(existingMonthlyRows[0]?.due_amount || 0);
  const monthlyPrincipal = roundMoneyValue(
    inferredMonthlyPrincipal || (monthlyTerms > 0 ? financedBalance / monthlyTerms : financedBalance)
  );

  return {
    tcp,
    reservationFee,
    downpaymentPercentage,
    downpaymentTotal,
    downpaymentTerms,
    monthlyTerms,
    monthlyPrincipal,
    annualInterestRate,
    startingDate,
    firstDueDate,
    modeOfPayment: listingRow.soa_mode_of_payment || listingRow.mode_of_payment || 'installment',
  };
};

const createComputedSoaRows = (terms = {}) => {
  const rows = [];
  let sequence = 1;

  if (terms.reservationFee > 0) {
    rows.push({
      id: `computed-${sequence}`,
      scheduleType: 'reservation',
      sequence,
      dueDate: terms.startingDate,
      description: 'Reservation Fee',
      beginningBalance: terms.tcp,
      dueAmount: terms.reservationFee,
      interest: 0,
      penalty: 0,
      datePaid: '-',
      amountPaid: 0,
      referenceId: '-',
      status: 'Unpaid',
      endingBalance: terms.tcp,
    });
    sequence += 1;
  }

  if (String(terms.modeOfPayment || '').toLowerCase() === 'cash') {
    const cashBalance = Math.max(terms.tcp - terms.reservationFee, 0);

    if (cashBalance > 0) {
      rows.push({
        id: `computed-${sequence}`,
        scheduleType: 'full_payment',
        sequence,
        dueDate: terms.firstDueDate,
        description: 'Full Payment',
        beginningBalance: terms.tcp,
        dueAmount: roundMoneyValue(cashBalance),
        interest: 0,
        penalty: 0,
        datePaid: '-',
        amountPaid: 0,
        referenceId: '-',
        status: 'Unpaid',
        endingBalance: terms.tcp,
      });
    }

    return rows;
  }

  const dpTerms = terms.downpaymentTerms <= 0 ? 1 : terms.downpaymentTerms;
  const baseDownpayment = dpTerms > 0 ? roundMoneyValue(terms.downpaymentTotal / dpTerms) : 0;
  let downpaymentRemainder = terms.downpaymentTotal;

  for (let index = 1; index <= dpTerms; index += 1) {
    if (downpaymentRemainder <= 0) break;

    const isLast = index === dpTerms;
    const dueAmount = roundMoneyValue(isLast ? downpaymentRemainder : baseDownpayment);
    downpaymentRemainder = roundMoneyValue(downpaymentRemainder - dueAmount);

    rows.push({
      id: `computed-${sequence}`,
      scheduleType: 'downpayment',
      sequence,
      dueDate: addMonthsToDate(terms.firstDueDate, index - 1),
      description: dpTerms === 1 ? 'Downpayment' : `${getOrdinalLabel(index)} Downpayment`,
      beginningBalance: terms.tcp,
      dueAmount,
      interest: 0,
      penalty: 0,
      datePaid: '-',
      amountPaid: 0,
      referenceId: '-',
      status: 'Unpaid',
      endingBalance: terms.tcp,
    });
    sequence += 1;
  }

  for (let index = 1; index <= terms.monthlyTerms; index += 1) {
    const dueDate = addMonthsToDate(terms.firstDueDate, dpTerms + index - 1);
    rows.push({
      id: `computed-${sequence}`,
      scheduleType: 'monthly',
      sequence,
      dueDate,
      description: `${getOrdinalLabel(index)} Monthly Payment`,
      beginningBalance: terms.tcp,
      dueAmount: terms.monthlyPrincipal,
      interest: 0,
      penalty: 0,
      datePaid: '-',
      amountPaid: 0,
      referenceId: '-',
      status: 'Unpaid',
      endingBalance: terms.tcp,
    });
    sequence += 1;
  }

  return rows;
};

const getPaymentTargetRows = (rows, paymentType) => {
  const cleanType = String(paymentType || '').toLowerCase();

  if (cleanType === 'reservation') return rows.filter((row) => row.scheduleType === 'reservation');
  if (cleanType === 'downpayment') return rows.filter((row) => row.scheduleType === 'downpayment');
  if (cleanType === 'monthly_amortization') return rows.filter((row) => row.scheduleType === 'monthly');
  if (cleanType === 'advance_payment') return rows.filter((row) => row.scheduleType === 'monthly');
  if (cleanType === 'balloon') return rows.filter((row) => row.scheduleType === 'monthly');
  if (cleanType === 'full_payment') return rows;

  return rows;
};

const allocatePaymentsToComputedRows = (rows = [], payments = []) => {
  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = String(a.paymentDate || a.lot_project_payment_date || '');
    const dateB = String(b.paymentDate || b.lot_project_payment_date || '');
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return Number(a.paymentId || a.id || a.lot_project_payment_id || 0) - Number(b.paymentId || b.id || b.lot_project_payment_id || 0);
  });

  let balloonCounter = 0;

  for (const payment of sortedPayments) {
    const type = payment.paymentTypeValue || normalizePaymentType(payment.paymentType || payment.type);
    let remaining = getPaymentAmountValue(payment);

    if (type === 'balloon') {
      balloonCounter += 1;
      rows.push(createBalloonPrincipalRow(payment, balloonCounter));
      continue;
    }

    const targetRows = getPaymentTargetRows(rows, type);

    for (const row of targetRows) {
      if (remaining <= 0) break;

      const unpaid = Math.max(getScheduleTotalDue(row) - Number(row.amountPaid || 0), 0);
      if (unpaid <= 0) continue;

      const appliedAmount = roundMoneyValue(Math.min(remaining, unpaid));
      row.amountPaid = roundMoneyValue(Number(row.amountPaid || 0) + appliedAmount);
      appendPaymentReference(row, payment);
      remaining = roundMoneyValue(remaining - appliedAmount);
    }
  }

  return sortComputedRows(rows);
};


const recomputeComputedSoaBalances = (rows = [], terms = {}) => {
  const today = new Date().toISOString().slice(0, 10);
  let runningBalance = roundMoneyValue(terms.tcp || 0);
  let projectedMonthlyBalance = null;
  const visibleRows = [];

  for (const row of sortComputedRows(rows)) {
    const scheduleType = row.scheduleType;
    let amountPaid = roundMoneyValue(Number(row.amountPaid || 0));

    if (runningBalance <= 0 && amountPaid <= 0) break;

    row.beginningBalance = runningBalance;

    if (scheduleType === 'balloon') {
      row.dueAmount = 0;
      row.interest = 0;
      row.penalty = 0;

      const principalPaid = roundMoneyValue(Math.min(amountPaid, runningBalance));
      runningBalance = roundMoneyValue(Math.max(runningBalance - principalPaid, 0));
      projectedMonthlyBalance = null;

      row.amountPaid = principalPaid;
      row.endingBalance = runningBalance;
      row.status = principalPaid > 0 ? 'Paid' : 'Unpaid';

      visibleRows.push({
        id: row.id,
        dueDate: row.dueDate,
        description: row.description,
        beginningBalance: row.beginningBalance,
        dueAmount: row.dueAmount,
        interest: row.interest || 0,
        penalty: row.penalty || 0,
        datePaid: row.datePaid || '-',
        amountPaid: row.amountPaid || 0,
        referenceId: row.referenceId || '-',
        status: row.status,
        endingBalance: row.endingBalance,
      });

      if (runningBalance <= 0) break;
      continue;
    }

    if (scheduleType === 'monthly') {
      const baseMonthlyPrincipal = roundMoneyValue(Number(terms.monthlyPrincipal || row.dueAmount || 0));

      if (amountPaid <= 0) {
        if (projectedMonthlyBalance === null) projectedMonthlyBalance = runningBalance;
        if (projectedMonthlyBalance <= 0) break;

        row.dueAmount = roundMoneyValue(Math.min(baseMonthlyPrincipal, projectedMonthlyBalance));
        projectedMonthlyBalance = roundMoneyValue(Math.max(projectedMonthlyBalance - row.dueAmount, 0));
      } else {
        row.dueAmount = roundMoneyValue(Math.min(Number(row.dueAmount || 0), runningBalance));
        projectedMonthlyBalance = null;
      }
    }

    if (scheduleType === 'full_payment') {
      row.dueAmount = roundMoneyValue(Math.min(Number(row.dueAmount || 0), runningBalance));
      projectedMonthlyBalance = null;
    }

    if (scheduleType === 'monthly' && Number(terms.annualInterestRate || 0) > 0 && runningBalance > 0) {
      row.interest = roundMoneyValue(runningBalance * (Number(terms.annualInterestRate || 0) / 100 / 12));
    }

    const totalDue = getScheduleTotalDue(row);
    amountPaid = roundMoneyValue(Number(row.amountPaid || 0));
    const principalPaid = scheduleType === 'full_payment'
      ? roundMoneyValue(Math.min(amountPaid, runningBalance))
      : roundMoneyValue(Math.min(amountPaid, Number(row.dueAmount || 0), runningBalance));

    runningBalance = roundMoneyValue(Math.max(runningBalance - principalPaid, 0));
    row.endingBalance = runningBalance;

    if (amountPaid <= 0) {
      row.status = row.dueDate && row.dueDate < today ? 'Overdue' : 'Unpaid';
    } else if (amountPaid + 0.009 < totalDue) {
      row.status = 'Partial';
    } else {
      row.status = row.datePaid !== '-' && row.dueDate && row.datePaid < row.dueDate ? 'Advance' : 'Paid';
    }

    if (amountPaid > 0) projectedMonthlyBalance = null;

    visibleRows.push({
      id: row.id,
      dueDate: row.dueDate,
      description: row.description,
      beginningBalance: row.beginningBalance,
      dueAmount: row.dueAmount,
      interest: row.interest || 0,
      penalty: row.penalty || 0,
      datePaid: row.datePaid || '-',
      amountPaid: row.amountPaid || 0,
      referenceId: row.referenceId || '-',
      status: row.status,
      endingBalance: row.endingBalance,
    });

    if (runningBalance <= 0 && amountPaid > 0) break;
  }

  return visibleRows;
};


const getExistingSoaScheduleRows = async (connection, lotProjectId, listingId) => {
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

  return rows;
};

const canGenerateListingSoa = (listingRow = {}) => {
  const rawStatus = String(
    listingRow.lot_project_listing_status ||
      listingRow.rawStatus ||
      listingRow.status ||
      ''
  )
    .trim()
    .toLowerCase();

  const hasBuyerProfile = Boolean(
    listingRow.lot_project_client_profile_id ||
      String(listingRow.buyer_full_name || '').trim()
  );

  if (!hasBuyerProfile) return false;
  if (rawStatus === 'available' || rawStatus === 'hold') return false;

  return true;
};

const getListingSoaRows = async (connection, lotProjectId, listingId, listingRow = {}, payments = []) => {
  if (!canGenerateListingSoa(listingRow)) return [];

  const existingScheduleRows = await getExistingSoaScheduleRows(connection, lotProjectId, listingId);
  const terms = getComputedSoaTerms(listingRow, existingScheduleRows);
  const computedRows = createComputedSoaRows(terms);
  const rowsWithPayments = allocatePaymentsToComputedRows(computedRows, payments);

  return recomputeComputedSoaBalances(rowsWithPayments, terms);
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
    const payments = await getListingPayments(connection, project.lot_project_id, row.lot_project_listing_id);
    const soaRows = await getListingSoaRows(connection, project.lot_project_id, row.lot_project_listing_id, row, payments);
    const cadastralLots = await getProjectCadastralLots(project.lot_project_id);
    const defaultDocuments = await getProjectDefaultDocuments(project.lot_project_id);
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
        listing: mapProfileListing(row, project, documents),
        client: clientProfile,
        soaRows,
        payments,
        documents,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


const getRequestToken = (req) => {
  const authorization = String(req.headers?.authorization || '').trim();

  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return (
    req.cookies?.token ||
    req.cookies?.authToken ||
    req.cookies?.auth_token ||
    req.cookies?.access_token ||
    null
  );
};

const getAuthenticatedUser = async (req) => {
  const token = getRequestToken(req);
  if (!token || !process.env.JWT_SECRET) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.user_id || decoded.userId;

    if (!userId) return null;

    const [rows] = await db.query(
      `
        SELECT id, first_name, middle_name, last_name, email, role, password_hash, status
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

    const user = rows[0];
    if (!user || user.status !== 'active') return null;
    return user;
  } catch {
    return null;
  }
};

const getUserFullName = (user = {}) => {
  const name = [user.first_name, user.middle_name, user.last_name]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');

  return name || user.email || '-';
};

const getListingForPayment = async (connection, project, listingLookup) => {
  const lookup = getListingLookupWhere(listingLookup);
  const [rows] = await connection.query(
    `
      SELECT
        l.lot_project_listing_id,
        l.lot_project_id,
        l.lot_project_listing_unit_id,
        l.lot_project_listing_tcp,
        cp.lot_project_client_profile_id,
        cp.buyer_full_name
      FROM lot_project_listings l
      LEFT JOIN lot_project_client_profiles cp
        ON cp.lot_project_listing_id = l.lot_project_listing_id
      WHERE l.lot_project_id = ?
        AND ${lookup.sql}
      LIMIT 1
    `,
    [project.lot_project_id, ...lookup.params]
  );

  return rows[0] || null;
};

const normalizePaymentType = (value = '') => {
  const clean = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');

  if (clean === 'reservation') return 'reservation';
  if (clean === 'downpayment' || clean === 'down payment') return 'downpayment';
  if (clean === 'monthly' || clean === 'monthly amortization') return 'monthly_amortization';
  if (clean === 'advance payment' || clean === 'advance') return 'advance_payment';
  if (clean === 'balloon' || clean === 'balloon payment') return 'balloon';
  if (clean === 'full payment' || clean === 'full') return 'full_payment';
  return 'other';
};

const getPaymentTypeLabel = (value = '') => {
  const labels = {
    reservation: 'Reservation',
    downpayment: 'Downpayment',
    monthly_amortization: 'Monthly',
    advance_payment: 'Advance Payment',
    balloon: 'Balloon',
    full_payment: 'Full Payment',
    legal_misc: 'Other',
    other: 'Other',
  };

  return labels[String(value || '').toLowerCase()] || 'Other';
};

const normalizePaymentMethod = (value = '') => {
  const clean = String(value || 'Cash').trim().toLowerCase();

  if (clean === 'cash') return 'Cash';
  if (clean === 'bank transfer' || clean === 'bank') return 'Bank Transfer';
  if (clean === 'online transfer' || clean === 'online payment' || clean === 'gcash') return 'Online Payment';
  if (clean === 'check' || clean === 'cheque') return 'Check';
  return 'Other';
};

const getNextCashReference = async (connection, unitCode) => {
  const dateKey = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const cleanUnit = String(unitCode || 'UNIT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const prefix = `CASH-${dateKey}-${cleanUnit}`;

  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM lot_project_payments
      WHERE lot_project_payment_reference_id LIKE ?
    `,
    [`${prefix}-%`]
  );

  const nextNumber = String(Number(rows[0]?.total || 0) + 1).padStart(4, '0');
  return `${prefix}-${nextNumber}`;
};

const mapPaymentRow = (row = {}) => ({
  id: row.lot_project_payment_id,
  paymentId: row.lot_project_payment_id,
  soaRowId: row.lot_project_payment_schedule_id,
  paymentType: getPaymentTypeLabel(row.lot_project_payment_type),
  paymentTypeValue: row.lot_project_payment_type,
  scheduleDescription: row.schedule_description || '-',
  type: getPaymentTypeLabel(row.lot_project_payment_type),
  method: row.lot_project_payment_method || '-',
  amount: Number(row.lot_project_payment_amount || 0),
  paymentDate: plainDate(row.lot_project_payment_date),
  referenceId: row.lot_project_payment_reference_id || '-',
  verifiedBy: row.verified_by_name || '-',
  verifiedAt: formatDateTime(row.lot_project_payment_verified_at),
  status: row.lot_project_payment_status || 'Verified',
  createdAt: formatDateTime(row.lot_project_payment_created_at),
  updatedAt: formatDateTime(row.lot_project_payment_updated_at),
});

const getListingPayments = async (connection, lotProjectId, listingId) => {
  if (!(await tableExists(connection, 'lot_project_payments'))) return [];

  const [rows] = await connection.query(
    `
      SELECT
        p.*,
        ps.description AS schedule_description,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS verified_by_name
      FROM lot_project_payments p
      LEFT JOIN lot_project_payment_schedules ps
        ON ps.lot_project_payment_schedule_id = p.lot_project_payment_schedule_id
      LEFT JOIN users u
        ON u.id = p.lot_project_payment_verified_by_user_id
      WHERE p.lot_project_id = ?
        AND p.lot_project_listing_id = ?
      ORDER BY p.lot_project_payment_date DESC, p.lot_project_payment_id DESC
    `,
    [lotProjectId, listingId]
  );

  return rows.map(mapPaymentRow);
};

const recomputeListingScheduleBalances = async (connection, listing) => {
  const [rows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payment_schedules
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
      ORDER BY due_date ASC, lot_project_payment_schedule_id ASC
    `,
    [listing.lot_project_id, listing.lot_project_listing_id]
  );

  let runningBalance = Number(listing.lot_project_listing_tcp || 0);

  for (const row of rows) {
    const beginningBalance = runningBalance;
    const paidAmount = Number(row.amount_paid || 0);
    runningBalance = Math.max(runningBalance - paidAmount, 0);

    await connection.query(
      `
        UPDATE lot_project_payment_schedules
        SET beginning_balance = ?,
            ending_balance = ?
        WHERE lot_project_payment_schedule_id = ?
      `,
      [beginningBalance, runningBalance, row.lot_project_payment_schedule_id]
    );
  }
};

const applyPaymentToSchedules = async (connection, listing, paymentId, preferredScheduleId, amount, paymentDate, referenceId) => {
  if (!(await tableExists(connection, 'lot_project_payment_allocations'))) {
    throw new Error('lot_project_payment_allocations table does not exist. Run the payments SOA migration first.');
  }

  const [scheduleRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payment_schedules
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
      ORDER BY
        CASE WHEN lot_project_payment_schedule_id = ? THEN 0 ELSE 1 END,
        due_date ASC,
        lot_project_payment_schedule_id ASC
    `,
    [listing.lot_project_id, listing.lot_project_listing_id, preferredScheduleId || 0]
  );

  if (!scheduleRows.length) {
    throw new Error('No SOA schedule row is available for this listing.');
  }

  let remaining = Number(amount || 0);

  for (const row of scheduleRows) {
    if (remaining <= 0) break;

    const totalDue = Number(row.due_amount || 0) + Number(row.penalty_amount || 0);
    const currentPaid = Number(row.amount_paid || 0);
    const unpaidForRow = Math.max(totalDue - currentPaid, 0);

    if (unpaidForRow <= 0) continue;

    const appliedAmount = Math.min(remaining, unpaidForRow);
    const nextPaid = currentPaid + appliedAmount;
    const isPaid = nextPaid >= totalDue;
    const paidBeforeDue = paymentDate && row.due_date && new Date(paymentDate) < new Date(row.due_date);
    const nextStatus = isPaid ? (paidBeforeDue ? 'Advance' : 'Paid') : 'Partial';

    await connection.query(
      `
        UPDATE lot_project_payment_schedules
        SET amount_paid = ?,
            date_paid = ?,
            reference_id = ?,
            schedule_status = ?
        WHERE lot_project_payment_schedule_id = ?
      `,
      [nextPaid, paymentDate, referenceId, nextStatus, row.lot_project_payment_schedule_id]
    );

    await connection.query(
      `
        INSERT INTO lot_project_payment_allocations (
          lot_project_payment_id,
          lot_project_payment_schedule_id,
          applied_amount
        ) VALUES (?, ?, ?)
      `,
      [paymentId, row.lot_project_payment_schedule_id, appliedAmount]
    );

    remaining -= appliedAmount;
  }

  if (remaining > 0) {
    throw new Error('Payment amount exceeds the remaining unpaid SOA balance.');
  }

  await recomputeListingScheduleBalances(connection, listing);
};

const reversePaymentAllocations = async (connection, listing, paymentId) => {
  if (!(await tableExists(connection, 'lot_project_payment_allocations'))) return;

  const [allocations] = await connection.query(
    `
      SELECT lot_project_payment_schedule_id, applied_amount
      FROM lot_project_payment_allocations
      WHERE lot_project_payment_id = ?
    `,
    [paymentId]
  );

  for (const allocation of allocations) {
    const [scheduleRows] = await connection.query(
      `
        SELECT amount_paid, due_amount, penalty_amount
        FROM lot_project_payment_schedules
        WHERE lot_project_payment_schedule_id = ?
        LIMIT 1
      `,
      [allocation.lot_project_payment_schedule_id]
    );

    const schedule = scheduleRows[0];
    if (!schedule) continue;

    const nextPaid = Math.max(Number(schedule.amount_paid || 0) - Number(allocation.applied_amount || 0), 0);
    const totalDue = Number(schedule.due_amount || 0) + Number(schedule.penalty_amount || 0);
    const nextStatus = nextPaid <= 0 ? 'Unpaid' : nextPaid >= totalDue ? 'Paid' : 'Partial';

    await connection.query(
      `
        UPDATE lot_project_payment_schedules
        SET amount_paid = ?,
            date_paid = CASE WHEN ? <= 0 THEN NULL ELSE date_paid END,
            reference_id = CASE WHEN ? <= 0 THEN NULL ELSE reference_id END,
            schedule_status = ?
        WHERE lot_project_payment_schedule_id = ?
      `,
      [nextPaid, nextPaid, nextPaid, nextStatus, allocation.lot_project_payment_schedule_id]
    );
  }

  await connection.query(
    `DELETE FROM lot_project_payment_allocations WHERE lot_project_payment_id = ?`,
    [paymentId]
  );

  await recomputeListingScheduleBalances(connection, listing);
};

const getPaymentById = async (connection, project, listing, paymentId) => {
  const [rows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payments
      WHERE lot_project_payment_id = ?
        AND lot_project_id = ?
        AND lot_project_listing_id = ?
      LIMIT 1
    `,
    [paymentId, project.lot_project_id, listing.lot_project_listing_id]
  );

  return rows[0] || null;
};

const dateOrNull = (value) => {
  const clean = String(value || '').trim();
  return clean ? clean.slice(0, 10) : null;
};

const parseMoneyValue = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const numberValue = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

const cleanBuyerType = (value) => {
  const clean = String(value || 'single').trim();
  return ['single', 'spouses', 'and_account'].includes(clean) ? clean : 'single';
};

const cleanSecondBuyerRole = (value, buyerType) => {
  const clean = String(value || '').trim();
  if (['spouse', 'co_owner', 'second_buyer'].includes(clean)) return clean;
  return buyerType === 'spouses' ? 'spouse' : 'co_owner';
};

const addIfColumnExists = async (connection, tableName, columns, values, columnName, value) => {
  if (await columnExists(connection, tableName, columnName)) {
    columns.push(columnName);
    values.push(value);
  }
};

export const updateLotProjectClientProfile = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });
    if (!(await tableExists(connection, 'lot_project_client_profiles'))) {
      return res.status(500).json({ message: 'lot_project_client_profiles table does not exist.' });
    }

    const lookup = getListingLookupWhere(listingLookup);
    const [listingRows] = await connection.query(
      `
        SELECT
          l.lot_project_listing_id,
          l.lot_project_listing_status
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const listing = listingRows[0];
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (!canEditBuyerProfileForListing(listing.lot_project_listing_status)) {
      return res.status(400).json({
        message: 'Reserve this unit first before editing the buyer profile.',
      });
    }

    const buyerType = cleanBuyerType(req.body.buyerType || req.body.buyer_type);
    const hasSecondBuyer = buyerType === 'spouses' || buyerType === 'and_account';
    const buyerName = String(req.body.buyerName || req.body.buyer_full_name || '').trim();
    const secondBuyerName = String(req.body.secondBuyerName || req.body.second_buyer_full_name || '').trim();

    if (!buyerName) return res.status(400).json({ message: 'Principal buyer full name is required.' });
    if (hasSecondBuyer && !secondBuyerName) {
      return res.status(400).json({ message: 'Second buyer / spouse full name is required.' });
    }

    const tableName = 'lot_project_client_profiles';
    const columns = [
      'lot_project_id',
      'lot_project_listing_id',
      'buyer_type',
      'buyer_full_name',
      'buyer_birth_date',
      'buyer_place_of_birth',
      'buyer_citizenship',
      'buyer_gender',
      'buyer_civil_status',
      'buyer_contact_number',
      'buyer_email',
      'buyer_tin',
      'buyer_present_address',
      'buyer_permanent_address',
      'buyer_employment_status',
      'buyer_employer_business_name',
      'buyer_employer_business_address',
      'buyer_nature_of_work_business',
      'buyer_occupation_position',
      'buyer_monthly_income',
      'second_buyer_full_name',
      'second_buyer_birth_date',
      'second_buyer_place_of_birth',
      'second_buyer_citizenship',
      'second_buyer_gender',
      'second_buyer_civil_status',
      'second_buyer_contact_number',
      'second_buyer_email',
      'second_buyer_tin',
      'second_buyer_present_address',
      'second_buyer_permanent_address',
      'second_buyer_employment_status',
      'second_buyer_employer_business_name',
      'second_buyer_employer_business_address',
      'second_buyer_nature_of_work_business',
      'second_buyer_occupation_position',
      'second_buyer_monthly_income',
      'lot_project_client_profile_status',
    ];

    const values = [
      project.lot_project_id,
      listing.lot_project_listing_id,
      buyerType,
      buyerName,
      dateOrNull(req.body.birthDate || req.body.buyer_birth_date),
      toNullable(req.body.placeOfBirth || req.body.buyer_place_of_birth),
      toNullable(req.body.citizenship || req.body.buyer_citizenship),
      toNullable(req.body.gender || req.body.buyer_gender),
      toNullable(req.body.civilStatus || req.body.buyer_civil_status),
      toNullable(req.body.contactNo || req.body.buyer_contact_number),
      toNullable(req.body.email || req.body.buyer_email),
      toNullable(req.body.tin || req.body.buyer_tin),
      toNullable(req.body.presentAddress || req.body.buyer_present_address),
      toNullable(req.body.permanentAddress || req.body.buyer_permanent_address),
      toNullable(req.body.employmentStatus || req.body.buyer_employment_status),
      toNullable(req.body.employerBusinessName || req.body.buyer_employer_business_name),
      toNullable(req.body.employerBusinessAddress || req.body.buyer_employer_business_address),
      toNullable(req.body.natureOfWorkBusiness || req.body.buyer_nature_of_work_business),
      toNullable(req.body.occupationPositionTitle || req.body.buyer_occupation_position),
      parseMoneyValue(req.body.monthlyIncome || req.body.buyer_monthly_income),
      hasSecondBuyer ? secondBuyerName : null,
      hasSecondBuyer ? dateOrNull(req.body.secondBuyerBirthDate || req.body.second_buyer_birth_date) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerPlaceOfBirth || req.body.second_buyer_place_of_birth) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerCitizenship || req.body.second_buyer_citizenship) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerGender || req.body.second_buyer_gender) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerCivilStatus || req.body.second_buyer_civil_status) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerContactNo || req.body.second_buyer_contact_number) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerEmail || req.body.second_buyer_email) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerTin || req.body.second_buyer_tin) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerPresentAddress || req.body.second_buyer_present_address) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerPermanentAddress || req.body.second_buyer_permanent_address) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerEmploymentStatus || req.body.second_buyer_employment_status) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerEmployerBusinessName || req.body.second_buyer_employer_business_name) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerEmployerBusinessAddress || req.body.second_buyer_employer_business_address) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerNatureOfWorkBusiness || req.body.second_buyer_nature_of_work_business) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerOccupationPositionTitle || req.body.second_buyer_occupation_position) : null,
      hasSecondBuyer ? parseMoneyValue(req.body.secondBuyerMonthlyIncome || req.body.second_buyer_monthly_income) : 0,
      'active',
    ];

    await addIfColumnExists(connection, tableName, columns, values, 'buyer_residence_phone_number', toNullable(req.body.residencePhoneNumber));
    await addIfColumnExists(connection, tableName, columns, values, 'buyer_present_zip_code', toNullable(req.body.presentZipCode));
    await addIfColumnExists(connection, tableName, columns, values, 'buyer_permanent_zip_code', toNullable(req.body.permanentZipCode));
    await addIfColumnExists(connection, tableName, columns, values, 'buyer_employer_zip_code', toNullable(req.body.employerZipCode));
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_role', hasSecondBuyer ? cleanSecondBuyerRole(req.body.secondBuyerRole, buyerType) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_residence_phone_number', hasSecondBuyer ? toNullable(req.body.secondBuyerResidencePhoneNumber) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_present_zip_code', hasSecondBuyer ? toNullable(req.body.secondBuyerPresentZipCode) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_permanent_zip_code', hasSecondBuyer ? toNullable(req.body.secondBuyerPermanentZipCode) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_employer_zip_code', hasSecondBuyer ? toNullable(req.body.secondBuyerEmployerZipCode) : null);

    const updateAssignments = columns
      .filter((column) => !['lot_project_id', 'lot_project_listing_id'].includes(column))
      .map((column) => `${column} = VALUES(${column})`);

    await connection.query(
      `
        INSERT INTO lot_project_client_profiles (${columns.join(', ')})
        VALUES (${columns.map(() => '?').join(', ')})
        ON DUPLICATE KEY UPDATE ${updateAssignments.join(', ')}
      `,
      values
    );

    return res.json({
      success: true,
      message: `${buyerName} buyer profile saved successfully.`,
      listing_id: listing.lot_project_listing_id,
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


export const createLotProjectListingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });
    if (!(await tableExists(connection, 'lot_project_payments'))) {
      return res.status(500).json({ message: 'lot_project_payments table does not exist.' });
    }

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (!listing.lot_project_client_profile_id) {
      return res.status(400).json({ message: 'This listing has no buyer profile yet.' });
    }

    const amount = parseMoneyValue(req.body.amount);
    const paymentDate = dateOrNull(req.body.paymentDate || req.body.payment_date) || new Date().toISOString().slice(0, 10);
    const paymentType = normalizePaymentType(req.body.paymentType || req.body.payment_type);
    const paymentMethod = normalizePaymentMethod(req.body.method || req.body.paymentMethod || req.body.payment_method);
    const scheduleId = toNullableNumber(req.body.soaRowId || req.body.paymentScheduleId || req.body.lot_project_payment_schedule_id);

    if (amount <= 0) return res.status(400).json({ message: 'Payment amount must be greater than 0.' });

    const referenceId = paymentMethod === 'Cash'
      ? await getNextCashReference(connection, listing.lot_project_listing_unit_id)
      : toNullable(req.body.referenceId || req.body.reference_id);

    if (paymentMethod !== 'Cash' && !referenceId) {
      return res.status(400).json({ message: 'Reference ID is required for non-cash payments.' });
    }

    await connection.beginTransaction();

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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, NOW())
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        scheduleId,
        paymentType,
        paymentMethod,
        amount,
        paymentDate,
        referenceId,
        user?.id || null,
      ]
    );

    const paymentId = paymentResult.insertId;

    await connection.query(
      `
        INSERT INTO lot_project_payment_logs (
          lot_project_payment_id,
          action_type,
          action_description,
          action_by_user_id
        ) VALUES (?, 'created', ?, ?)
      `,
      [paymentId, `${getPaymentTypeLabel(paymentType)} payment created and verified for ${listing.lot_project_listing_unit_id}.`, user?.id || null]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `${getPaymentTypeLabel(paymentType)} payment saved and verified successfully.`,
      payment_id: paymentId,
      reference_id: referenceId,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateLotProjectListingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const paymentId = Number(req.params.paymentId || 0);
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!paymentId) return res.status(400).json({ message: 'Payment id is required.' });

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const existingPayment = await getPaymentById(connection, project, listing, paymentId);
    if (!existingPayment) return res.status(404).json({ message: 'Payment not found.' });

    const amount = parseMoneyValue(req.body.amount);
    const paymentDate = dateOrNull(req.body.paymentDate || req.body.payment_date) || plainDate(existingPayment.lot_project_payment_date);
    const paymentType = normalizePaymentType(req.body.paymentType || req.body.payment_type || existingPayment.lot_project_payment_type);
    const paymentMethod = normalizePaymentMethod(req.body.method || req.body.paymentMethod || req.body.payment_method || existingPayment.lot_project_payment_method);
    const scheduleId = toNullableNumber(req.body.soaRowId || req.body.paymentScheduleId || req.body.lot_project_payment_schedule_id || existingPayment.lot_project_payment_schedule_id);

    if (amount <= 0) return res.status(400).json({ message: 'Payment amount must be greater than 0.' });

    const referenceId = paymentMethod === 'Cash'
      ? (existingPayment.lot_project_payment_reference_id || await getNextCashReference(connection, listing.lot_project_listing_unit_id))
      : toNullable(req.body.referenceId || req.body.reference_id);

    if (paymentMethod !== 'Cash' && !referenceId) {
      return res.status(400).json({ message: 'Reference ID is required for non-cash payments.' });
    }

    await connection.beginTransaction();

    if (await tableExists(connection, 'lot_project_payment_allocations')) {
      await connection.query(
        `DELETE FROM lot_project_payment_allocations WHERE lot_project_payment_id = ?`,
        [paymentId]
      );
    }

    await connection.query(
      `
        UPDATE lot_project_payments
        SET lot_project_payment_schedule_id = ?,
            lot_project_payment_type = ?,
            lot_project_payment_method = ?,
            lot_project_payment_amount = ?,
            lot_project_payment_date = ?,
            lot_project_payment_reference_id = ?,
            lot_project_payment_status = 'Verified',
            lot_project_payment_verified_by_user_id = ?,
            lot_project_payment_verified_at = NOW()
        WHERE lot_project_payment_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
      `,
      [
        scheduleId,
        paymentType,
        paymentMethod,
        amount,
        paymentDate,
        referenceId,
        user?.id || null,
        paymentId,
        project.lot_project_id,
        listing.lot_project_listing_id,
      ]
    );

    await connection.query(
      `
        INSERT INTO lot_project_payment_logs (
          lot_project_payment_id,
          action_type,
          action_description,
          action_by_user_id
        ) VALUES (?, 'updated', ?, ?)
      `,
      [paymentId, `${getPaymentTypeLabel(paymentType)} payment updated by ${getUserFullName(user)}.`, user.id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `${getPaymentTypeLabel(paymentType)} payment updated successfully.`,
      payment_id: paymentId,
      reference_id: referenceId,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const deleteLotProjectListingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const paymentId = Number(req.params.paymentId || 0);
    const project = await getProjectBySlug(slug);
    const superAdminPassword = String(req.body.superAdminPassword || req.body.password || '').trim();

    if (!user) return res.status(401).json({ message: 'Please login before deleting a payment.' });
    if (user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only the logged-in super admin can delete a payment.' });
    }
    if (!superAdminPassword) {
      return res.status(400).json({ message: 'Super admin password is required.' });
    }

    const isPasswordCorrect = await bcrypt.compare(superAdminPassword, user.password_hash || '');
    if (!isPasswordCorrect) {
      return res.status(403).json({ message: 'Super admin password is incorrect.' });
    }

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!paymentId) return res.status(400).json({ message: 'Payment id is required.' });

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const existingPayment = await getPaymentById(connection, project, listing, paymentId);
    if (!existingPayment) return res.status(404).json({ message: 'Payment not found.' });

    await connection.beginTransaction();

    if (await tableExists(connection, 'lot_project_payment_allocations')) {
      await connection.query(
        `DELETE FROM lot_project_payment_allocations WHERE lot_project_payment_id = ?`,
        [paymentId]
      );
    }

    await connection.query(
      `
        DELETE FROM lot_project_payments
        WHERE lot_project_payment_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
      `,
      [paymentId, project.lot_project_id, listing.lot_project_listing_id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `Payment ${existingPayment.lot_project_payment_reference_id || paymentId} deleted successfully.`,
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

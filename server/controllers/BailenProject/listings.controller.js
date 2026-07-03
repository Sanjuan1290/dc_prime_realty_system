import { db } from '../../db/connect.js';
import { getMainProject, getProjectDocuments, toNumber } from '../../utils/bailenHelpers.js';

const getError = (error) => error?.message || 'Something went wrong.';

const buildListingSearchWhere = (query) => {
  const where = [];
  const params = [];
  if (query.search) {
    const key = `%${String(query.search).trim()}%`;
    where.push(`(
      bl.unit_code LIKE ? OR bl.old_unit_ids LIKE ? OR cp.buyer_name LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR pcln.bailen_cadastral_lot_number LIKE ?
    )`);
    params.push(key, key, key, key, key, key);
  }
  if (query.lot_type && query.lot_type !== 'all') { where.push('bl.lot_type = ?'); params.push(query.lot_type); }
  if (query.status && query.status !== 'all') { where.push('bl.status = ?'); params.push(query.status); }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
};

export const getListings = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const { whereSql, params } = buildListingSearchWhere(req.query);

    const fromSql = `
      FROM bailen_listings bl
      LEFT JOIN bailen_client_profiles cp ON cp.bailen_listing_id = bl.bailen_listing_id
      LEFT JOIN users u ON u.id = cp.seller_user_id
      LEFT JOIN bailen_listing_cadastral_lots blcl ON blcl.bailen_listing_id = bl.bailen_listing_id
      LEFT JOIN project_bailen_cadastral_lot_numbers pcln ON pcln.bailen_cadastral_lot_number_id = blcl.bailen_cadastral_lot_number_id
      ${whereSql}
    `;

    const [[countRow]] = await db.query(`SELECT COUNT(DISTINCT bl.bailen_listing_id) AS total ${fromSql}`, params);
    const [rows] = await db.query(`
      SELECT
        bl.*, cp.buyer_name,
        GROUP_CONCAT(DISTINCT pcln.bailen_cadastral_lot_number ORDER BY pcln.bailen_cadastral_lot_number SEPARATOR ',') AS cadastral_lot_numbers
      ${fromSql}
      GROUP BY bl.bailen_listing_id
      ORDER BY bl.updated_at DESC, bl.bailen_listing_id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const [[summary]] = await db.query(`
      SELECT COUNT(*) AS total, SUM(status='available') AS available, SUM(status='hold') AS hold, SUM(status='sold') AS sold, COALESCE(SUM(tcp),0) AS total_tcp
      FROM bailen_listings
    `);

    const total = Number(countRow.total || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return res.json({ data: rows, summary, pagination: { page, limit, total, totalPages, hasPrev: page > 1, hasNext: page < totalPages } });
  } catch (error) {
    return res.status(500).json({ message: getError(error) });
  }
};

export const getCreateOptions = async (req, res) => {
  try {
    const project = await getMainProject();
    if (!project) return res.status(404).json({ message: 'Bailen project not found.' });
    const [lots] = await db.query('SELECT * FROM project_bailen_cadastral_lot_numbers WHERE project_bailen_id = ? ORDER BY bailen_cadastral_lot_number ASC', [project.project_bailen_id]);
    const [documents] = await db.query('SELECT * FROM documents WHERE document_status = "active" ORDER BY document_name ASC');
    const projectDefaultDocuments = await getProjectDocuments(project.project_bailen_id);
    return res.json({ project, cadastral_lot_numbers: lots, documents, project_default_documents: projectDefaultDocuments });
  } catch (error) {
    return res.status(500).json({ message: getError(error) });
  }
};

export const createListing = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      project_bailen_id,
      unit_code,
      old_unit_ids,
      lot_type = 'inner',
      lot_area_sqm = 0,
      price_per_sqm = 0,
      legal_misc_rate = 10,
      net_selling_price,
      lmf_amount,
      tcp,
      reservation_fee = 50000,
      annual_interest_rate = 0,
      status = 'available',
      cadastral_lot_number_ids = [],
      document_requirements = [],
    } = req.body;

    if (!project_bailen_id) return res.status(400).json({ message: 'Project is required.' });
    if (!unit_code?.trim()) return res.status(400).json({ message: 'Unit ID is required.' });

    await connection.beginTransaction();

    const [result] = await connection.query(`
      INSERT INTO bailen_listings (
        project_bailen_id, unit_code, old_unit_ids, lot_type, lot_area_sqm, price_per_sqm, legal_misc_rate,
        net_selling_price, lmf_amount, tcp, reservation_fee, annual_interest_rate, status, document_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      project_bailen_id,
      unit_code.trim().toUpperCase(),
      old_unit_ids?.trim() || null,
      lot_type,
      toNumber(lot_area_sqm),
      toNumber(price_per_sqm),
      toNumber(legal_misc_rate, 10),
      toNumber(net_selling_price),
      toNumber(lmf_amount),
      toNumber(tcp),
      toNumber(reservation_fee, 50000),
      toNumber(annual_interest_rate),
      status,
      document_requirements.length ? 'custom' : 'project_default',
    ]);

    const listingId = result.insertId;
    for (const lotId of cadastral_lot_number_ids) {
      if (lotId) await connection.query('INSERT IGNORE INTO bailen_listing_cadastral_lots (bailen_listing_id, bailen_cadastral_lot_number_id) VALUES (?, ?)', [listingId, lotId]);
    }

    let requirements = document_requirements;
    if (!requirements.length) {
      const [defaults] = await connection.query('SELECT document_id, requirement, status FROM project_bailen_default_documents WHERE project_bailen_id = ?', [project_bailen_id]);
      requirements = defaults;
    }

    for (const doc of requirements) {
      if (doc.document_id) {
        await connection.query(
          'INSERT IGNORE INTO bailen_listing_document_requirements (bailen_listing_id, document_id, requirement, status) VALUES (?, ?, ?, ?)',
          [listingId, doc.document_id, doc.requirement || 'required', doc.status || 'active']
        );
      }
    }

    await connection.commit();
    return res.status(201).json({ message: 'Listing added successfully.', bailen_listing_id: listingId });
  } catch (error) {
    await connection.rollback();
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Unit ID already exists in this project.' });
    return res.status(500).json({ message: getError(error) });
  } finally {
    connection.release();
  }
};

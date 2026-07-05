import { db } from '../../db/connect.js';

const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'Duplicate project slug or location code.';
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
  return clean ? clean : null;
};

const toActiveStatus = (value) => (value === 'inactive' ? 'inactive' : 'active');

const getDefaultRateByRole = (role) => {
  if (role === 'broker_network_manager') return 8;
  if (role === 'broker') return 7;
  if (role === 'manager') return 5;
  if (role === 'agent') return 3;
  return 0;
};

const normalizeProjectPayload = (body = {}) => {
  const name = String(body.lot_project_name || body.name || '').trim();

  return {
    name,
    slug: slugify(body.lot_project_slug || body.slug || name),
    location: String(body.lot_project_location || body.location || '').trim(),
    locationCode: String(body.lot_project_location_code || body.locationCode || '').trim().toUpperCase(),
    administrator: toNullable(body.lot_project_administrator_name || body.administrator),
    taxDeclarationNo: toNullable(body.lot_project_tax_declaration_no || body.taxDeclarationNo),
    pin: toNullable(body.lot_project_pin || body.pin),
    status: toActiveStatus(body.lot_project_status || body.status),
    cadastralLots: Array.isArray(body.cadastralLots)
      ? body.cadastralLots.map((item) => String(item).trim()).filter(Boolean)
      : [],
    defaultDocuments: Array.isArray(body.defaultDocuments)
      ? body.defaultDocuments
      : Array.isArray(body.documents)
        ? body.documents
        : Array.isArray(body.selectedDocuments)
          ? body.selectedDocuments
          : [],
  };
};

const mapProjectRows = (projects = [], cadastralRows = []) => {
  const cadastralMap = new Map();

  cadastralRows.forEach((row) => {
    if (!cadastralMap.has(row.lot_project_id)) {
      cadastralMap.set(row.lot_project_id, []);
    }

    cadastralMap.get(row.lot_project_id).push(row.lot_project_cadastral_lot_number);
  });

  return projects.map((project) => {
    const cadastralLots = cadastralMap.get(project.lot_project_id) || [];

    return {
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
      defaultDocs: Number(project.default_documents_count || 0),
      requiredDocs: Number(project.required_documents_count || 0),
    };
  });
};

export const getLotProjects = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || 'all');

    const where = [];
    const params = [];

    if (search) {
      where.push(`
        (
          lp.lot_project_name LIKE ? OR
          lp.lot_project_location LIKE ? OR
          lp.lot_project_location_code LIKE ? OR
          lp.lot_project_slug LIKE ?
        )
      `);

      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    if (status !== 'all') {
      where.push(`lp.lot_project_status = ?`);
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [projects] = await db.query(
      `
        SELECT
          lp.*,
          COUNT(DISTINCT lpdd.lot_project_default_document_id) AS default_documents_count,
          COALESCE(SUM(lpdd.lot_project_default_document_is_required = 1), 0) AS required_documents_count
        FROM lot_projects lp
        LEFT JOIN lot_project_default_documents lpdd
          ON lpdd.lot_project_id = lp.lot_project_id
          AND lpdd.lot_project_default_document_status = 'active'
        ${whereSql}
        GROUP BY lp.lot_project_id
        ORDER BY lp.lot_project_created_at DESC, lp.lot_project_id DESC
      `,
      params
    );

    const [cadastralRows] = await db.query(`
      SELECT
        lot_project_id,
        lot_project_cadastral_lot_number
      FROM lot_project_cadastral_lot_numbers
      ORDER BY lot_project_cadastral_lot_number ASC
    `);

    const [summaryRows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(lot_project_status = 'active') AS active,
        SUM(lot_project_status = 'inactive') AS inactive
      FROM lot_projects
    `);

    return res.json({
      success: true,
      data: mapProjectRows(projects, cadastralRows),
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        active: Number(summaryRows[0]?.active || 0),
        inactive: Number(summaryRows[0]?.inactive || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
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
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const getLotProjectBySlug = async (req, res) => {
  try {
    const slug = String(req.params.projectSlug || '').trim();

    const [projectRows] = await db.query(
      `
        SELECT *
        FROM lot_projects
        WHERE lot_project_slug = ?
        LIMIT 1
      `,
      [slug]
    );

    const project = projectRows[0];

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Lot project not found.',
      });
    }

    const [cadastralLots] = await db.query(
      `
        SELECT *
        FROM lot_project_cadastral_lot_numbers
        WHERE lot_project_id = ?
        ORDER BY lot_project_cadastral_lot_number ASC
      `,
      [project.lot_project_id]
    );

    const [defaultDocuments] = await db.query(
      `
        SELECT
          lpdd.*,
          d.document_name,
          d.document_description,
          d.document_status
        FROM lot_project_default_documents lpdd
        INNER JOIN documents d ON d.document_id = lpdd.document_id
        WHERE lpdd.lot_project_id = ?
        ORDER BY d.document_name ASC
      `,
      [project.lot_project_id]
    );

    const [settingsRows] = await db.query(
      `
        SELECT *
        FROM lot_project_settings
        WHERE lot_project_id = ?
        LIMIT 1
      `,
      [project.lot_project_id]
    );

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
        settings: settingsRows[0] || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};

export const createLotProject = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const payload = normalizeProjectPayload(req.body);

    if (!payload.name) {
      return res.status(400).json({ success: false, message: 'Project name is required.' });
    }

    if (!payload.location) {
      return res.status(400).json({ success: false, message: 'Project location is required.' });
    }

    if (!payload.locationCode) {
      return res.status(400).json({ success: false, message: 'Location code is required.' });
    }

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
      [
        payload.name,
        payload.slug,
        payload.location,
        payload.locationCode,
        payload.administrator,
        payload.taxDeclarationNo,
        payload.pin,
        payload.status,
      ]
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
          VALUES ${cleanDocuments.map(() => '(?, ?, ?, "active")').join(', ')}
        `,
        cleanDocuments.flatMap((document) => [
          lotProjectId,
          document.document_id,
          document.is_required,
        ])
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
      [
        lotProjectId,
        'D&C Prime Realty',
        'dcprimerealty@gmail.com',
        '0912-345-6789',
        'D&C Prime Realty',
        'dcprimerealty@gmail.com',
        '(046) 866-0616',
      ]
    );

    await connection.query(
      `
        INSERT INTO seller_group_lot_project_rates (
          seller_group_id,
          lot_project_id,
          seller_group_pool_rate,
          seller_group_lot_project_rate_status
        )
        SELECT
          seller_group_id,
          ?,
          8.00,
          'active'
        FROM seller_groups
        WHERE seller_group_status = 'active'
      `,
      [lotProjectId]
    );

    await connection.query(
      `
        INSERT INTO accredited_seller_lot_project_rates (
          accredited_seller_id,
          lot_project_id,
          accredited_seller_project_rate,
          accredited_seller_lot_project_rate_status
        )
        SELECT
          a.accredited_seller_id,
          ?,
          CASE
            WHEN u.role = 'broker_network_manager' THEN 8.00
            WHEN u.role = 'broker' THEN 7.00
            WHEN u.role = 'manager' THEN 5.00
            WHEN u.role = 'agent' THEN 3.00
            ELSE 0.00
          END,
          'active'
        FROM accredited_sellers a
        INNER JOIN users u ON u.id = a.user_id
        WHERE a.accredited_seller_status = 'active'
      `,
      [lotProjectId]
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
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateLotProject = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const lotProjectId = Number(req.params.id);
    const payload = normalizeProjectPayload(req.body);

    if (!lotProjectId) {
      return res.status(400).json({ success: false, message: 'Invalid lot project id.' });
    }

    if (!payload.name) {
      return res.status(400).json({ success: false, message: 'Project name is required.' });
    }

    await connection.beginTransaction();

    await connection.query(
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
      [
        payload.name,
        payload.slug,
        payload.location,
        payload.locationCode,
        payload.administrator,
        payload.taxDeclarationNo,
        payload.pin,
        payload.status,
        lotProjectId,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: 'Lot project updated successfully.',
      routePath: `/lot-projects/${payload.slug}`,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const toggleLotProjectStatus = async (req, res) => {
  try {
    const lotProjectId = Number(req.params.id);

    if (!lotProjectId) {
      return res.status(400).json({ success: false, message: 'Invalid lot project id.' });
    }

    const [rows] = await db.query(
      `
        SELECT lot_project_status
        FROM lot_projects
        WHERE lot_project_id = ?
        LIMIT 1
      `,
      [lotProjectId]
    );

    const project = rows[0];

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    const nextStatus = req.body.status || (project.lot_project_status === 'active' ? 'inactive' : 'active');

    await db.query(
      `
        UPDATE lot_projects
        SET lot_project_status = ?
        WHERE lot_project_id = ?
      `,
      [toActiveStatus(nextStatus), lotProjectId]
    );

    return res.json({
      success: true,
      message: `Lot project is now ${toActiveStatus(nextStatus)}.`,
      status: toActiveStatus(nextStatus),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
};
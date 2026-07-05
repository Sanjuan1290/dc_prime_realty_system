import { db } from '../../db/connect.js';

const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'Duplicate project name, slug, or location code.';
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

  await connection.query(
    `DELETE FROM ${tableName} WHERE lot_project_id = ?`,
    [lotProjectId]
  );
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
      return res.status(404).json({ message: 'Lot project not found.' });
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

export const createLotProject = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const payload = normalizeProjectPayload(req.body);

    if (!payload.name) {
      return res.status(400).json({ message: 'Project name is required.' });
    }

    if (!payload.location) {
      return res.status(400).json({ message: 'Project location is required.' });
    }

    if (!payload.locationCode) {
      return res.status(400).json({ message: 'Location code is required.' });
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
        is_required:
          document.requirement === 'optional' || document.is_required === false ? 0 : 1,
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
        cleanDocuments.flatMap((document) => [
          lotProjectId,
          document.document_id,
          document.is_required,
          document.status,
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

export const toggleLotProjectStatus = async (req, res) => {
  try {
    const lotProjectId = Number(req.params.id);

    if (!lotProjectId) {
      return res.status(400).json({ message: 'Invalid lot project id.' });
    }

    const nextStatus = toActiveStatus(req.body.status);

    const [result] = await db.query(
      `
        UPDATE lot_projects
        SET lot_project_status = ?
        WHERE lot_project_id = ?
      `,
      [nextStatus, lotProjectId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Lot project not found.' });
    }

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

    if (!lotProjectId) {
      return res.status(400).json({ message: 'Invalid lot project id.' });
    }

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

    await connection.query(
      `
        DELETE FROM lot_projects
        WHERE lot_project_id = ?
      `,
      [lotProjectId]
    );

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

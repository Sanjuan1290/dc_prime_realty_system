import { db } from '../../db/connect.js';

const getErrorMessage = (error) => error?.message || 'Something went wrong.';

const toNullableString = (value) => {
  const nextValue = String(value ?? '').trim();
  return nextValue ? nextValue : null;
};

const normalizeLotNumbers = (lotNumbers = []) => {
  const values = Array.isArray(lotNumbers) ? lotNumbers : String(lotNumbers || '').split(',');

  return [
    ...new Set(
      values
        .map((lot) => {
          if (typeof lot === 'object' && lot !== null) {
            return String(
              lot.bailen_cadastral_lot_number ||
                lot.cadastral_lot_number ||
                lot.value ||
                ''
            ).trim();
          }

          return String(lot || '').trim();
        })
        .filter(Boolean)
    ),
  ];
};

const normalizeIdList = (values = []) => {
  const nextValues = Array.isArray(values) ? values : [];

  return [
    ...new Set(
      nextValues
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    ),
  ];
};

const formatMoney = (value) => Number(value || 0).toFixed(2);

const getDefaultProjectId = async (conn = db) => {
  const [rows] = await conn.query(
    `
      SELECT project_bailen_id
      FROM project_bailen
      ORDER BY project_bailen_id ASC
      LIMIT 1
    `
  );

  return Number(rows[0]?.project_bailen_id || 0);
};

const assertCadastralStatusColumn = async (conn = db) => {
  const [rows] = await conn.query(
    `
      SELECT COUNT(*) AS column_exists
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'project_bailen_cadastral_lot_numbers'
        AND COLUMN_NAME = 'bailen_cadastral_lot_number_status'
    `
  );

  if (!Number(rows[0]?.column_exists || 0)) {
    const error = new Error(
      'Missing bailen_cadastral_lot_number_status column. Run database/2026_07_03_bailen_cadastral_soft_delete.sql first.'
    );
    error.statusCode = 500;
    throw error;
  }
};

const getProjectById = async (conn, projectId) => {
  const [rows] = await conn.query(
    `
      SELECT
        project_bailen_id,
        project_bailen_name,
        project_bailen_location,
        project_bailen_location_code,
        project_bailen_administrator_name,
        project_bailen_tax_declaration_no,
        project_bailen_pin,
        project_bailen_status,
        project_bailen_created_at,
        project_bailen_updated_at
      FROM project_bailen
      WHERE project_bailen_id = ?
      LIMIT 1
    `,
    [projectId]
  );

  return rows[0] || null;
};

const getProjectLots = async (conn, projectId) => {
  const [rows] = await conn.query(
    `
      SELECT
        pcln.bailen_cadastral_lot_number_id,
        pcln.project_bailen_id,
        pcln.bailen_cadastral_lot_number,
        pcln.bailen_cadastral_lot_number_status,
        pcln.bailen_cadastral_lot_number_created_at,
        pcln.bailen_cadastral_lot_number_updated_at,
        COUNT(blcl.listing_cadastral_lot_id) AS used_count,
        GROUP_CONCAT(bl.unit_code ORDER BY bl.unit_code SEPARATOR ', ') AS used_by_units
      FROM project_bailen_cadastral_lot_numbers pcln
      LEFT JOIN bailen_listing_cadastral_lots blcl
        ON blcl.bailen_cadastral_lot_number_id = pcln.bailen_cadastral_lot_number_id
      LEFT JOIN bailen_listings bl
        ON bl.bailen_listing_id = blcl.bailen_listing_id
      WHERE pcln.project_bailen_id = ?
      GROUP BY
        pcln.bailen_cadastral_lot_number_id,
        pcln.project_bailen_id,
        pcln.bailen_cadastral_lot_number,
        pcln.bailen_cadastral_lot_number_status,
        pcln.bailen_cadastral_lot_number_created_at,
        pcln.bailen_cadastral_lot_number_updated_at
      ORDER BY pcln.bailen_cadastral_lot_number ASC
    `,
    [projectId]
  );

  return rows.map((row) => ({
    ...row,
    used_count: Number(row.used_count || 0),
    used_by_units: row.used_by_units || '',
  }));
};

const getProjectTemplates = async (conn, projectId) => {
  const [rows] = await conn.query(
    `
      SELECT
        dt.template_id,
        dt.template_name,
        dt.template_description,
        dt.template_status
      FROM project_bailen_document_templates pbdt
      INNER JOIN document_templates dt
        ON dt.template_id = pbdt.template_id
      WHERE pbdt.project_bailen_id = ?
      ORDER BY dt.template_name ASC
    `,
    [projectId]
  );

  return rows;
};

const getProjectDefaultDocuments = async (conn, projectId) => {
  const [rows] = await conn.query(
    `
      SELECT
        pdd.project_bailen_default_document_id,
        pdd.project_bailen_id,
        pdd.document_id,
        pdd.requirement,
        pdd.status,
        d.document_name,
        d.document_description,
        d.document_is_required,
        d.document_status
      FROM project_bailen_default_documents pdd
      INNER JOIN documents d
        ON d.document_id = pdd.document_id
      WHERE pdd.project_bailen_id = ?
      ORDER BY
        FIELD(pdd.requirement, 'required', 'optional'),
        d.document_name ASC
    `,
    [projectId]
  );

  return rows;
};

const getProjectPayload = async (conn, projectId) => {
  await assertCadastralStatusColumn(conn);

  const project = await getProjectById(conn, projectId);

  if (!project) return null;

  const [lots, templates, defaultDocuments] = await Promise.all([
    getProjectLots(conn, projectId),
    getProjectTemplates(conn, projectId),
    getProjectDefaultDocuments(conn, projectId),
  ]);

  const activeLots = lots.filter((lot) => lot.bailen_cadastral_lot_number_status === 'active');
  const requiredDocuments = defaultDocuments.filter(
    (document) => document.requirement === 'required' && document.status === 'active'
  );
  const optionalDocuments = defaultDocuments.filter(
    (document) => document.requirement === 'optional' && document.status === 'active'
  );

  return {
    ...project,
    cadastral_lots: lots,
    active_cadastral_lots: activeLots,
    project_bailen_cadastral_lot_numbers: activeLots.map(
      (lot) => lot.bailen_cadastral_lot_number
    ),
    document_templates: templates,
    default_documents: defaultDocuments,
    project_bailen_document_template: templates.map((template) => template.template_name).join(', ') || '-',
    project_bailen_default_documents: defaultDocuments.length,
    project_bailen_required_documents: requiredDocuments.length,
    project_bailen_optional_documents: optionalDocuments.length,
  };
};

const syncProjectCadastralLots = async (conn, projectId, lotNumbers = []) => {
  const nextLots = normalizeLotNumbers(lotNumbers);

  const [existingLots] = await conn.query(
    `
      SELECT
        bailen_cadastral_lot_number_id,
        bailen_cadastral_lot_number,
        bailen_cadastral_lot_number_status
      FROM project_bailen_cadastral_lot_numbers
      WHERE project_bailen_id = ?
    `,
    [projectId]
  );

  const existingMap = new Map(
    existingLots.map((lot) => [lot.bailen_cadastral_lot_number, lot])
  );

  for (const lotNumber of nextLots) {
    const existing = existingMap.get(lotNumber);

    if (existing) {
      await conn.query(
        `
          UPDATE project_bailen_cadastral_lot_numbers
          SET bailen_cadastral_lot_number_status = 'active'
          WHERE bailen_cadastral_lot_number_id = ?
        `,
        [existing.bailen_cadastral_lot_number_id]
      );
    } else {
      await conn.query(
        `
          INSERT INTO project_bailen_cadastral_lot_numbers (
            project_bailen_id,
            bailen_cadastral_lot_number,
            bailen_cadastral_lot_number_status
          ) VALUES (?, ?, 'active')
        `,
        [projectId, lotNumber]
      );
    }
  }

  const nextLotSet = new Set(nextLots);

  for (const lot of existingLots) {
    if (nextLotSet.has(lot.bailen_cadastral_lot_number)) continue;

    await conn.query(
      `
        UPDATE project_bailen_cadastral_lot_numbers
        SET bailen_cadastral_lot_number_status = 'inactive'
        WHERE bailen_cadastral_lot_number_id = ?
      `,
      [lot.bailen_cadastral_lot_number_id]
    );
  }
};

const syncProjectTemplates = async (conn, projectId, templateIds = []) => {
  const nextTemplateIds = normalizeIdList(templateIds);

  await conn.query(
    'DELETE FROM project_bailen_document_templates WHERE project_bailen_id = ?',
    [projectId]
  );

  for (const templateId of nextTemplateIds) {
    await conn.query(
      `
        INSERT IGNORE INTO project_bailen_document_templates (
          project_bailen_id,
          template_id
        ) VALUES (?, ?)
      `,
      [projectId, templateId]
    );
  }
};

const syncProjectDefaultDocuments = async (conn, projectId, documents = []) => {
  if (!Array.isArray(documents)) return;

  await conn.query(
    'DELETE FROM project_bailen_default_documents WHERE project_bailen_id = ?',
    [projectId]
  );

  for (const document of documents) {
    const documentId = Number(document.document_id || document.id);
    if (!documentId) continue;

    const requirement = document.requirement === 'optional' ? 'optional' : 'required';
    const status = document.status === 'inactive' ? 'inactive' : 'active';

    await conn.query(
      `
        INSERT IGNORE INTO project_bailen_default_documents (
          project_bailen_id,
          document_id,
          requirement,
          status
        ) VALUES (?, ?, ?, ?)
      `,
      [projectId, documentId, requirement, status]
    );
  }
};

export const viewProjectDetails = async (req, res) => {
  try {
    const routeProjectId = Number(req.params.id || 0);
    const projectId = routeProjectId || (await getDefaultProjectId());

    if (!projectId) {
      return res.status(404).json({ message: 'Bailen project not found.' });
    }

    const project = await getProjectPayload(db, projectId);

    if (!project) {
      return res.status(404).json({ message: 'Bailen project not found.' });
    }

    return res.json({ data: project });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const getActiveCadastralLots = async (req, res) => {
  try {
    const routeProjectId = Number(req.params.id || 0);
    const projectId = routeProjectId || (await getDefaultProjectId());

    if (!projectId) {
      return res.status(404).json({ message: 'Bailen project not found.' });
    }

    await assertCadastralStatusColumn();

    const [rows] = await db.query(
      `
        SELECT
          bailen_cadastral_lot_number_id,
          bailen_cadastral_lot_number
        FROM project_bailen_cadastral_lot_numbers
        WHERE project_bailen_id = ?
          AND bailen_cadastral_lot_number_status = 'active'
        ORDER BY bailen_cadastral_lot_number ASC
      `,
      [projectId]
    );

    return res.json({ data: rows });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const getRecentUnitRecords = async (req, res) => {
  try {
    const projectId = Number(req.query.project_id || req.params.id || 0) || (await getDefaultProjectId());
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 50);

    const [rows] = await db.query(
      `
        SELECT
          bl.bailen_listing_id,
          bl.unit_code,
          bl.old_unit_ids,
          bl.lot_type,
          bl.lot_area_sqm,
          bl.price_per_sqm,
          bl.net_selling_price,
          bl.lmf_amount,
          bl.tcp,
          bl.reservation_fee,
          bl.status,
          bl.sold_substatus,
          bl.buyer_profile_status,
          bl.document_status,
          bl.created_at,
          bl.updated_at,
          cp.buyer_name,
          GROUP_CONCAT(pcln.bailen_cadastral_lot_number ORDER BY pcln.bailen_cadastral_lot_number SEPARATOR ', ') AS cadastral_lots
        FROM bailen_listings bl
        LEFT JOIN bailen_client_profiles cp
          ON cp.bailen_listing_id = bl.bailen_listing_id
        LEFT JOIN bailen_listing_cadastral_lots blcl
          ON blcl.bailen_listing_id = bl.bailen_listing_id
        LEFT JOIN project_bailen_cadastral_lot_numbers pcln
          ON pcln.bailen_cadastral_lot_number_id = blcl.bailen_cadastral_lot_number_id
        WHERE bl.project_bailen_id = ?
        GROUP BY
          bl.bailen_listing_id,
          cp.buyer_name
        ORDER BY bl.updated_at DESC, bl.bailen_listing_id DESC
        LIMIT ?
      `,
      [projectId, limit]
    );

    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getProjectDashboard = async (req, res) => {
  try {
    const projectId = Number(req.query.project_id || 0) || (await getDefaultProjectId());

    if (!projectId) {
      return res.status(404).json({ message: 'Bailen project not found.' });
    }

    const project = await getProjectPayload(db, projectId);

    if (!project) {
      return res.status(404).json({ message: 'Bailen project not found.' });
    }

    const [summaryRows] = await db.query(
      `
        SELECT
          COUNT(*) AS total_units,
          SUM(status = 'available') AS available_units,
          SUM(status = 'hold') AS hold_units,
          SUM(status = 'sold') AS sold_units,
          SUM(status = 'pending_for_cancellation') AS pending_cancellation_units,
          SUM(status = 'cancelled') AS cancelled_units,
          SUM(status = 'superseded') AS superseded_units,
          COALESCE(SUM(tcp), 0) AS total_inventory_value,
          COALESCE(SUM(CASE WHEN status = 'sold' THEN tcp ELSE 0 END), 0) AS sold_value
        FROM bailen_listings
        WHERE project_bailen_id = ?
      `,
      [projectId]
    );

    const [recentRows] = await db.query(
      `
        SELECT
          bl.bailen_listing_id,
          bl.unit_code,
          bl.lot_type,
          bl.lot_area_sqm,
          bl.tcp,
          bl.status,
          bl.sold_substatus,
          bl.buyer_profile_status,
          bl.document_status,
          cp.buyer_name,
          GROUP_CONCAT(pcln.bailen_cadastral_lot_number ORDER BY pcln.bailen_cadastral_lot_number SEPARATOR ', ') AS cadastral_lots
        FROM bailen_listings bl
        LEFT JOIN bailen_client_profiles cp
          ON cp.bailen_listing_id = bl.bailen_listing_id
        LEFT JOIN bailen_listing_cadastral_lots blcl
          ON blcl.bailen_listing_id = bl.bailen_listing_id
        LEFT JOIN project_bailen_cadastral_lot_numbers pcln
          ON pcln.bailen_cadastral_lot_number_id = blcl.bailen_cadastral_lot_number_id
        WHERE bl.project_bailen_id = ?
        GROUP BY
          bl.bailen_listing_id,
          cp.buyer_name
        ORDER BY bl.updated_at DESC, bl.bailen_listing_id DESC
        LIMIT 8
      `,
      [projectId]
    );

    const summary = summaryRows[0] || {};

    return res.json({
      data: {
        project,
        summary: {
          total_units: Number(summary.total_units || 0),
          available_units: Number(summary.available_units || 0),
          hold_units: Number(summary.hold_units || 0),
          sold_units: Number(summary.sold_units || 0),
          pending_cancellation_units: Number(summary.pending_cancellation_units || 0),
          cancelled_units: Number(summary.cancelled_units || 0),
          superseded_units: Number(summary.superseded_units || 0),
          total_inventory_value: Number(summary.total_inventory_value || 0),
          sold_value: Number(summary.sold_value || 0),
        },
        recent_units: recentRows,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const editProject = async (req, res) => {
  const projectId = Number(req.params.id || 0);

  if (!projectId) {
    return res.status(400).json({ message: 'Invalid project ID.' });
  }

  const {
    project_bailen_name,
    project_bailen_location,
    project_bailen_location_code,
    project_bailen_administrator_name,
    project_bailen_tax_declaration_no,
    project_bailen_pin,
    project_bailen_status = 'active',
    cadastral_lot_numbers = [],
    template_ids,
    default_documents,
  } = req.body;

  if (!String(project_bailen_name || '').trim()) {
    return res.status(400).json({ message: 'Project name is required.' });
  }

  if (!String(project_bailen_location || '').trim()) {
    return res.status(400).json({ message: 'Project location is required.' });
  }

  if (!String(project_bailen_location_code || '').trim()) {
    return res.status(400).json({ message: 'Location code is required.' });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    await assertCadastralStatusColumn(conn);

    const [projectExists] = await conn.query(
      'SELECT project_bailen_id FROM project_bailen WHERE project_bailen_id = ? LIMIT 1',
      [projectId]
    );

    if (!projectExists.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Bailen project not found.' });
    }

    await conn.query(
      `
        UPDATE project_bailen
        SET
          project_bailen_name = ?,
          project_bailen_location = ?,
          project_bailen_location_code = ?,
          project_bailen_administrator_name = ?,
          project_bailen_tax_declaration_no = ?,
          project_bailen_pin = ?,
          project_bailen_status = ?
        WHERE project_bailen_id = ?
      `,
      [
        String(project_bailen_name || '').trim(),
        String(project_bailen_location || '').trim(),
        String(project_bailen_location_code || '').trim().toUpperCase(),
        toNullableString(project_bailen_administrator_name),
        toNullableString(project_bailen_tax_declaration_no),
        toNullableString(project_bailen_pin),
        project_bailen_status === 'inactive' ? 'inactive' : 'active',
        projectId,
      ]
    );

    await syncProjectCadastralLots(conn, projectId, cadastral_lot_numbers);

    if (Array.isArray(template_ids)) {
      await syncProjectTemplates(conn, projectId, template_ids);
    }

    if (Array.isArray(default_documents)) {
      await syncProjectDefaultDocuments(conn, projectId, default_documents);
    }

    await conn.commit();

    const project = await getProjectPayload(db, projectId);

    return res.json({
      message: 'Project updated successfully.',
      data: project,
    });
  } catch (error) {
    await conn.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    conn.release();
  }
};

export const printPriceList = async (req, res) => {
  try {
    const routeProjectId = Number(req.params.id || 0);
    const projectId = routeProjectId || (await getDefaultProjectId());

    if (!projectId) {
      return res.status(404).send('Bailen project not found.');
    }

    const project = await getProjectById(db, projectId);

    if (!project) {
      return res.status(404).send('Bailen project not found.');
    }

    const [rows] = await db.query(
      `
        SELECT
          bl.unit_code,
          bl.old_unit_ids,
          bl.lot_type,
          bl.lot_area_sqm,
          bl.price_per_sqm,
          bl.net_selling_price,
          bl.lmf_amount,
          bl.tcp,
          bl.reservation_fee,
          bl.status,
          GROUP_CONCAT(pcln.bailen_cadastral_lot_number ORDER BY pcln.bailen_cadastral_lot_number SEPARATOR ', ') AS cadastral_lots
        FROM bailen_listings bl
        LEFT JOIN bailen_listing_cadastral_lots blcl
          ON blcl.bailen_listing_id = bl.bailen_listing_id
        LEFT JOIN project_bailen_cadastral_lot_numbers pcln
          ON pcln.bailen_cadastral_lot_number_id = blcl.bailen_cadastral_lot_number_id
        WHERE bl.project_bailen_id = ?
          AND bl.status IN ('available', 'hold')
        GROUP BY bl.bailen_listing_id
        ORDER BY bl.unit_code ASC
      `,
      [projectId]
    );

    const tableRows = rows
      .map(
        (row) => `
          <tr>
            <td>${row.unit_code || '-'}</td>
            <td>${row.old_unit_ids || '-'}</td>
            <td>${row.cadastral_lots || '-'}</td>
            <td>${row.lot_type || '-'}</td>
            <td class="right">${Number(row.lot_area_sqm || 0).toLocaleString()} sqm</td>
            <td class="right">PHP ${formatMoney(row.price_per_sqm)}</td>
            <td class="right">PHP ${formatMoney(row.net_selling_price)}</td>
            <td class="right">PHP ${formatMoney(row.lmf_amount)}</td>
            <td class="right">PHP ${formatMoney(row.tcp)}</td>
            <td>${row.status || '-'}</td>
          </tr>
        `
      )
      .join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${project.project_bailen_name} Price List</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
            .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 18px; }
            h1 { font-size: 22px; margin: 0 0 6px; }
            p { margin: 3px 0; font-size: 12px; color: #334155; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #f1f5f9; text-align: left; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
            .right { text-align: right; }
            .footer { margin-top: 20px; font-size: 11px; color: #475569; }
            @media print { body { margin: 12mm; } button { display: none; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()">Print</button>
          <div class="header">
            <div>
              <h1>${project.project_bailen_name}</h1>
              <p>${project.project_bailen_location || ''}</p>
              <p>Location Code: ${project.project_bailen_location_code || '-'}</p>
            </div>
            <div>
              <p><strong>Administrator:</strong> ${project.project_bailen_administrator_name || '-'}</p>
              <p><strong>Tax Declaration No.:</strong> ${project.project_bailen_tax_declaration_no || '-'}</p>
              <p><strong>PIN:</strong> ${project.project_bailen_pin || '-'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Old Unit IDs</th>
                <th>Cadastral Lots</th>
                <th>Type</th>
                <th>Area</th>
                <th>Price / sqm</th>
                <th>NSP</th>
                <th>LMF</th>
                <th>TCP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="10">No available or hold units found.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            Generated ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}. Prices are subject to final admin confirmation.
          </div>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error) {
    return res.status(500).send(getErrorMessage(error));
  }
};

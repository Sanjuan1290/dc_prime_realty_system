import {
  db,
  getErrorMessage,
  slugify,
  toNullable,
  toNullableNumber,
  toActiveStatus,
  tableExists,
  columnExists,
  money,
  plainDate,
  formatDateTime,
  toDisplayValue,
  safeDeleteByProjectId,
  normalizeProjectPayload,
  getListingStatusLabel,
  normalizeLotType,
  lotTypeLabel,
  normalizeListingStatusPayload,
  formatDocumentsLabel,
  mapListingRow,
  mapProjectRows,
  getProjectBySlug,
  getProjectDefaultDocuments,
  getProjectCadastralLots,
  getListingLookupWhere,
  computeAgeFromDate,
  getClientCompletionStatus,
  mapClientProfile,
  canEditBuyerProfileForListing,
  mapProfileListing,
  getListingDocuments,
  roundMoneyValue,
  normalizeDateInput,
  addMonthsToDate,
  getOrdinalLabel,
  getScheduleTotalDue,
  appendPaymentReference,
  getPaymentAmountValue,
  createBalloonPrincipalRow,
  getRowSortOrder,
  sortComputedRows,
  getComputedSoaTerms,
  createComputedSoaRows,
  getPaymentTargetRows,
  allocatePaymentsToComputedRows,
  recomputeComputedSoaBalances,
  getExistingSoaScheduleRows,
  canGenerateListingSoa,
  getListingSoaRows,
  getRequestToken,
  getAuthenticatedUser,
  getUserFullName,
  getListingForPayment,
  normalizePaymentType,
  getPaymentTypeLabel,
  normalizePaymentMethod,
  getNextCashReference,
  mapPaymentRow,
  getListingPayments,
  recomputeListingScheduleBalances,
  applyPaymentToSchedules,
  reversePaymentAllocations,
  getPaymentById,
  dateOrNull,
  parseMoneyValue,
  cleanBuyerType,
  cleanSecondBuyerRole,
  addIfColumnExists,
} from '../Lot_Projects/_shared/lotProject.shared.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { createProjectStorageCode } from '../../services/storageCodes.service.js';
import { resolveDocumentRequiredFlag, resolveDocumentResponsibleParty } from '../../utils/documentRequirement.js';
import { getAccessibleProjectIds, grantAdminProjectAccess } from '../../services/projectAccess.service.js';

export const getSystemDashboardSummary = async (req, res) => {
  try {
    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser);
    const accessSql = accessibleProjectIds === null
      ? ''
      : accessibleProjectIds.length
        ? `WHERE lp.lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})`
        : 'WHERE 1 = 0';
    const params = accessibleProjectIds === null ? [] : accessibleProjectIds;

    const [rows] = await db.query(`
      SELECT
        lp.lot_project_id,
        lp.lot_project_name,
        lp.lot_project_slug,
        lp.lot_project_location,
        lp.lot_project_location_code,
        lp.lot_project_status,
        COUNT(l.lot_project_listing_id) AS total_units,
        COALESCE(SUM(l.lot_project_listing_status = 'available'), 0) AS available_units,
        COALESCE(SUM(l.lot_project_listing_status = 'hold'), 0) AS hold_units,
        COALESCE(SUM(
          l.lot_project_listing_status = 'sold'
          AND COALESCE(l.lot_project_listing_sold_substatus, 'active') = 'active'
        ), 0) AS sold_active_units,
        COALESCE(SUM(
          l.lot_project_listing_status = 'sold'
          AND l.lot_project_listing_sold_substatus = 'fully_paid'
        ), 0) AS fully_paid_units,
        COALESCE(SUM(l.lot_project_listing_status = 'pending_for_cancellation'), 0) AS pending_cancellation_units,
        COALESCE(SUM(l.lot_project_listing_status = 'cancelled'), 0) AS cancelled_units
      FROM lot_projects lp
      LEFT JOIN lot_project_listings l
        ON l.lot_project_id = lp.lot_project_id
      ${accessSql}
      GROUP BY
        lp.lot_project_id,
        lp.lot_project_name,
        lp.lot_project_slug,
        lp.lot_project_location,
        lp.lot_project_location_code,
        lp.lot_project_status
      ORDER BY
        (lp.lot_project_status = 'active') DESC,
        lp.lot_project_name ASC
    `, params);

    const projects = rows.map((row) => ({
      id: Number(row.lot_project_id),
      name: row.lot_project_name,
      slug: row.lot_project_slug,
      location: row.lot_project_location,
      locationCode: row.lot_project_location_code,
      status: row.lot_project_status,
      totalUnits: Number(row.total_units || 0),
      available: Number(row.available_units || 0),
      hold: Number(row.hold_units || 0),
      soldActive: Number(row.sold_active_units || 0),
      fullyPaid: Number(row.fully_paid_units || 0),
      pendingCancellation: Number(row.pending_cancellation_units || 0),
      cancelled: Number(row.cancelled_units || 0),
      routePath: `/portal/lot-projects/${row.lot_project_slug}`,
    }));

    const summary = projects.reduce((totals, project) => {
      totals.totalProjects += 1;
      if (project.status === 'active') totals.activeProjects += 1;
      if (project.status === 'inactive') totals.inactiveProjects += 1;
      totals.totalUnits += project.totalUnits;
      totals.available += project.available;
      totals.hold += project.hold;
      totals.soldActive += project.soldActive;
      totals.fullyPaid += project.fullyPaid;
      totals.pendingCancellation += project.pendingCancellation;
      totals.cancelled += project.cancelled;
      return totals;
    }, {
      totalProjects: 0,
      activeProjects: 0,
      inactiveProjects: 0,
      totalUnits: 0,
      available: 0,
      hold: 0,
      soldActive: 0,
      fullyPaid: 0,
      pendingCancellation: 0,
      cancelled: 0,
    });

    return res.json({
      success: true,
      data: { summary, projects },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getLotProjects = async (req, res) => {
  try {
    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser);
    const accessSql = accessibleProjectIds === null
      ? ''
      : accessibleProjectIds.length
        ? `WHERE lp.lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})`
        : 'WHERE 1 = 0';
    const [projects] = await db.query(`
      SELECT
        lp.*,
        COUNT(DISTINCT lpdd.lot_project_default_document_id) AS default_documents_count,
        COUNT(DISTINCT CASE WHEN lpdd.lot_project_default_document_is_required = 1 THEN lpdd.lot_project_default_document_id END) AS required_documents_count,
        COUNT(DISTINCT listing.lot_project_listing_id) AS listing_count
      FROM lot_projects lp
      LEFT JOIN lot_project_default_documents lpdd
        ON lpdd.lot_project_id = lp.lot_project_id
        AND lpdd.lot_project_default_document_status = 'active'
      LEFT JOIN lot_project_listings listing
        ON listing.lot_project_id = lp.lot_project_id
      ${accessSql}
      GROUP BY lp.lot_project_id
      ORDER BY lp.lot_project_created_at DESC, lp.lot_project_id DESC
    `, accessibleProjectIds === null ? [] : accessibleProjectIds);

    const [cadastralRows] = await db.query(`
      SELECT
        c.lot_project_cadastral_lot_number_id,
        c.lot_project_id,
        c.lot_project_cadastral_lot_number,
        COUNT(DISTINCT listing.lot_project_listing_id) AS usedCount
      FROM lot_project_cadastral_lot_numbers c
      LEFT JOIN lot_project_listing_cadastral_lots link
        ON link.lot_project_cadastral_lot_number_id = c.lot_project_cadastral_lot_number_id
      LEFT JOIN lot_project_listings listing
        ON listing.lot_project_listing_id = link.lot_project_listing_id
      ${accessibleProjectIds === null ? '' : accessibleProjectIds.length ? `WHERE c.lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})` : 'WHERE 1 = 0'}
      GROUP BY c.lot_project_cadastral_lot_number_id, c.lot_project_id, c.lot_project_cadastral_lot_number
      ORDER BY c.lot_project_cadastral_lot_number ASC
    `, accessibleProjectIds === null ? [] : accessibleProjectIds);

    return res.json({
      success: true,
      data: mapProjectRows(projects, cadastralRows),
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

// Keep the workspace option query and response mapper together so every
// project card receives the same location fields used by the full project API.
export const LOT_PROJECT_OPTIONS_QUERY = `
  SELECT
    lot_project_id,
    lot_project_storage_code,
    lot_project_name,
    lot_project_slug,
    lot_project_location,
    lot_project_location_code,
    lot_project_status
  FROM lot_projects
  WHERE lot_project_status = 'active'
  ORDER BY lot_project_name ASC
`;

export const mapLotProjectOption = (project = {}) => ({
  ...project,
  id: project.lot_project_id,
  label: project.lot_project_name,
  value: project.lot_project_id,
  storageCode: project.lot_project_storage_code || null,
  slug: project.lot_project_slug,
  location: project.lot_project_location,
  locationCode: project.lot_project_location_code,
  routePath: `/portal/lot-projects/${project.lot_project_slug}`,
});

export const getLotProjectOptions = async (req, res) => {
  try {
    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser);
    const accessSql = accessibleProjectIds === null
      ? ''
      : accessibleProjectIds.length
        ? ` AND lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})`
        : ' AND 1 = 0';
    const query = LOT_PROJECT_OPTIONS_QUERY.replace("WHERE lot_project_status = 'active'", `WHERE lot_project_status = 'active'${accessSql}`);
    const [rows] = await db.query(query, accessibleProjectIds === null ? [] : accessibleProjectIds);

    return res.json({
      success: true,
      data: rows.map(mapLotProjectOption),
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
    const [listingCountRows] = await db.query(
      `SELECT COUNT(*) AS listing_count FROM lot_project_listings WHERE lot_project_id = ?`,
      [project.lot_project_id]
    );
    const listingCount = Number(listingCountRows[0]?.listing_count || 0);

    return res.json({
      success: true,
      data: {
        ...project,
        id: project.lot_project_id,
        storageCode: project.lot_project_storage_code || null,
        type: 'lot',
        name: project.lot_project_name,
        slug: project.lot_project_slug,
        location: project.lot_project_location,
        locationCode: project.lot_project_location_code,
        administrator: project.lot_project_administrator_name,
        taxDeclarationNo: project.lot_project_tax_declaration_no,
        titleNumber: project.lot_project_title_number,
        pin: project.lot_project_pin,
        status: project.lot_project_status,
        routePath: `/portal/lot-projects/${project.lot_project_slug}`,
        listing_count: listingCount,
        listingCount,
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
          lot_project_title_number,
          lot_project_pin,
          lot_project_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [payload.name, payload.slug, payload.location, payload.locationCode, payload.administrator, payload.taxDeclarationNo, payload.titleNumber, payload.pin, payload.status]
    );

    const lotProjectId = projectResult.insertId;
    const storageCode = createProjectStorageCode(lotProjectId);
    if (await columnExists(connection, 'lot_projects', 'lot_project_storage_code')) {
      await connection.query(
        `UPDATE lot_projects SET lot_project_storage_code = ? WHERE lot_project_id = ?`,
        [storageCode, lotProjectId]
      );
    }

    // A scoped Admin who creates a project automatically receives access to it.
    if (req.authUser?.role === 'admin') {
      await grantAdminProjectAccess(connection, {
        userId: req.authUser.id,
        projectId: lotProjectId,
        changedByUserId: req.authUser.id,
      });
    }

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
        is_required: resolveDocumentRequiredFlag(document),
        responsible_party: resolveDocumentResponsibleParty(document),
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
            lot_project_default_document_responsible_party,
            lot_project_default_document_status
          )
          VALUES ${cleanDocuments.map(() => '(?, ?, ?, ?, ?)').join(', ')}
        `,
        cleanDocuments.flatMap((document) => [lotProjectId, document.document_id, document.is_required, document.responsible_party, document.status])
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

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Projects',
      entityType: 'lot_project',
      entityId: String(lotProjectId),
      entityLabel: payload.name,
      title: 'Created lot project',
      description: `Created lot project ${payload.name}.`,
      metadata: { slug: payload.slug, locationCode: payload.locationCode, storageCode, status: payload.status },
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Lot project created successfully.',
      lot_project_id: lotProjectId,
      storage_code: storageCode,
      routePath: `/portal/lot-projects/${payload.slug}`,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

const normalizeRequestedCadastralLots = (values = []) =>
  Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((lot) => String(lot ?? '').trim())
      .filter(Boolean)
  ));

const buildLotProjectEditGuardState = async (
  connection,
  lotProjectId,
  existingProject,
  { locationCode = '', cadastralLots = [] } = {}
) => {
  const [listingCountRows] = await connection.query(
    `SELECT COUNT(*) AS listing_count FROM lot_project_listings WHERE lot_project_id = ?`,
    [lotProjectId]
  );
  const listingCount = Number(listingCountRows[0]?.listing_count || 0);
  const normalizedLocationCode = String(locationCode || '').trim().toUpperCase();
  const existingLocationCode = String(existingProject?.lot_project_location_code || '').trim().toUpperCase();
  const locationCodeChanged = normalizedLocationCode !== existingLocationCode;

  const [existingCadastralRows] = await connection.query(
    `
      SELECT
        c.lot_project_cadastral_lot_number_id,
        c.lot_project_cadastral_lot_number,
        COUNT(DISTINCT listing.lot_project_listing_id) AS used_count
      FROM lot_project_cadastral_lot_numbers c
      LEFT JOIN lot_project_listing_cadastral_lots link
        ON link.lot_project_cadastral_lot_number_id = c.lot_project_cadastral_lot_number_id
      LEFT JOIN lot_project_listings listing
        ON listing.lot_project_listing_id = link.lot_project_listing_id
      WHERE c.lot_project_id = ?
      GROUP BY c.lot_project_cadastral_lot_number_id, c.lot_project_cadastral_lot_number
    `,
    [lotProjectId]
  );

  const requestedCadastralLots = normalizeRequestedCadastralLots(cadastralLots);
  const requestedCadastralSet = new Set(requestedCadastralLots);
  const removedCadastralRows = existingCadastralRows.filter(
    (row) => !requestedCadastralSet.has(String(row.lot_project_cadastral_lot_number))
  );
  const inUseRemoval = removedCadastralRows.find((row) => Number(row.used_count || 0) > 0) || null;

  return {
    listingCount,
    locationCodeChanged,
    existingCadastralRows,
    requestedCadastralLots,
    removedCadastralRows,
    inUseRemoval,
  };
};

const getLotProjectEditGuardError = ({ listingCount, locationCodeChanged, inUseRemoval } = {}) => {
  if (locationCodeChanged && Number(listingCount || 0) > 0) {
    return {
      status: 409,
      body: {
        code: 'PROJECT_LOCATION_CODE_LOCKED',
        listingCount: Number(listingCount || 0),
        message: "Location Code can't be changed because this project already has listings. Existing Unit IDs use this location code as their prefix.",
      },
    };
  }

  if (inUseRemoval) {
    const cadastralLotNumber = String(inUseRemoval.lot_project_cadastral_lot_number || '').trim();
    return {
      status: 409,
      body: {
        code: 'CADASTRAL_LOT_IN_USE',
        cadastralLotNumber,
        usedCount: Number(inUseRemoval.used_count || 0),
        message: `Cadastral Lot ${cadastralLotNumber} can't be removed because it is currently assigned to a listing. Reassign the listing first.`,
      },
    };
  }

  return null;
};

export const preflightLotProjectUpdate = async (req, res) => {
  try {
    const lotProjectId = Number(req.params.id);
    const locationCode = String(req.body?.locationCode || '').trim().toUpperCase();
    const cadastralLots = normalizeRequestedCadastralLots(req.body?.cadastralLots);

    if (!lotProjectId) return res.status(400).json({ message: 'Invalid lot project id.' });
    if (!locationCode) return res.status(400).json({ message: 'Location code is required.' });
    if (!Array.isArray(req.body?.cadastralLots)) {
      return res.status(400).json({ message: 'Cadastral lot validation data is invalid. Refresh the page and try again.' });
    }

    const [projectRows] = await db.query(
      `SELECT * FROM lot_projects WHERE lot_project_id = ? LIMIT 1`,
      [lotProjectId]
    );
    const existingProject = projectRows[0];
    if (!existingProject) return res.status(404).json({ message: 'Lot project not found.' });

    const guardState = await buildLotProjectEditGuardState(db, lotProjectId, existingProject, {
      locationCode,
      cadastralLots,
    });
    const guardError = getLotProjectEditGuardError(guardState);
    if (guardError) return res.status(guardError.status).json(guardError.body);

    return res.json({
      success: true,
      data: {
        valid: true,
        listingCount: guardState.listingCount,
      },
    });
  } catch (error) {
    return res.status(Number(error?.statusCode || 500)).json({ message: error?.message || getErrorMessage(error) });
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

    const [projectRows] = await connection.query(
      `SELECT * FROM lot_projects WHERE lot_project_id = ? LIMIT 1 FOR UPDATE`,
      [lotProjectId]
    );
    const existingProject = projectRows[0];
    if (!existingProject) {
      await connection.rollback();
      return res.status(404).json({ message: 'Lot project not found.' });
    }

    // Project name is descriptive data; changing it must not silently rename the
    // route slug. Preserve the existing slug unless the API explicitly receives
    // a slug field for a deliberate route migration.
    const slugWasSubmitted = Object.prototype.hasOwnProperty.call(req.body, 'slug')
      || Object.prototype.hasOwnProperty.call(req.body, 'lot_project_slug');
    const stableSlug = slugWasSubmitted ? payload.slug : existingProject.lot_project_slug;

    const guardState = await buildLotProjectEditGuardState(connection, lotProjectId, existingProject, payload);
    const guardError = getLotProjectEditGuardError(guardState);
    if (guardError) {
      await connection.rollback();
      return res.status(guardError.status).json(guardError.body);
    }

    const {
      listingCount,
      locationCodeChanged,
      existingCadastralRows,
      requestedCadastralLots,
      removedCadastralRows,
    } = guardState;

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
          lot_project_title_number = ?,
          lot_project_pin = ?,
          lot_project_status = ?
        WHERE lot_project_id = ?
      `,
      [payload.name, stableSlug, payload.location, payload.locationCode, payload.administrator, payload.taxDeclarationNo, payload.titleNumber, payload.pin, payload.status, lotProjectId]
    );

    // Cadastral master rows are stable identifiers. Keep unchanged rows in place,
    // insert only new values, and refuse to remove any value used by a listing.
    const existingCadastralMap = new Map(
      existingCadastralRows.map((row) => [String(row.lot_project_cadastral_lot_number), row])
    );

    const removableIds = removedCadastralRows.map((row) => Number(row.lot_project_cadastral_lot_number_id)).filter(Boolean);
    if (removableIds.length) {
      await connection.query(
        `DELETE FROM lot_project_cadastral_lot_numbers WHERE lot_project_id = ? AND lot_project_cadastral_lot_number_id IN (${removableIds.map(() => '?').join(', ')})`,
        [lotProjectId, ...removableIds]
      );
    }

    const addedCadastralLots = requestedCadastralLots.filter((lot) => !existingCadastralMap.has(lot));
    if (addedCadastralLots.length) {
      await connection.query(
        `
          INSERT INTO lot_project_cadastral_lot_numbers (
            lot_project_id,
            lot_project_cadastral_lot_number
          ) VALUES ${addedCadastralLots.map(() => '(?, ?)').join(', ')}
        `,
        addedCadastralLots.flatMap((lot) => [lotProjectId, lot])
      );
    }

    // Default-document rows are also diffed/upserted instead of delete-all/reinsert.
    const cleanDocuments = payload.defaultDocuments
      .map((document) => ({
        document_id: Number(document.document_id || document.id),
        is_required: resolveDocumentRequiredFlag(document),
        responsible_party: resolveDocumentResponsibleParty(document),
        status: document.status === 'inactive' ? 'inactive' : 'active',
      }))
      .filter((document) => document.document_id);

    if (cleanDocuments.length > 0) {
      await connection.query(
        `DELETE FROM lot_project_default_documents WHERE lot_project_id = ? AND document_id NOT IN (${cleanDocuments.map(() => '?').join(', ')})`,
        [lotProjectId, ...cleanDocuments.map((document) => document.document_id)]
      );
      await connection.query(
        `
          INSERT INTO lot_project_default_documents (
            lot_project_id,
            document_id,
            lot_project_default_document_is_required,
            lot_project_default_document_responsible_party,
            lot_project_default_document_status
          ) VALUES ${cleanDocuments.map(() => '(?, ?, ?, ?, ?)').join(', ')}
          ON DUPLICATE KEY UPDATE
            lot_project_default_document_is_required = VALUES(lot_project_default_document_is_required),
            lot_project_default_document_responsible_party = VALUES(lot_project_default_document_responsible_party),
            lot_project_default_document_status = VALUES(lot_project_default_document_status),
            lot_project_default_document_updated_at = NOW()
        `,
        cleanDocuments.flatMap((document) => [lotProjectId, document.document_id, document.is_required, document.responsible_party, document.status])
      );
    } else {
      await connection.query(`DELETE FROM lot_project_default_documents WHERE lot_project_id = ?`, [lotProjectId]);
    }

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Projects',
      entityType: 'lot_project',
      entityId: String(lotProjectId),
      entityLabel: payload.name,
      title: 'Updated lot project',
      description: `Updated lot project ${payload.name}.`,
      metadata: {
        slug: stableSlug,
        locationCode: payload.locationCode,
        status: payload.status,
        listingCount,
        locationCodeChanged,
        cadastralAdded: addedCadastralLots,
        cadastralRemoved: removedCadastralRows.map((row) => row.lot_project_cadastral_lot_number),
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: 'Lot project updated successfully.',
      routePath: `/portal/lot-projects/${stableSlug}`,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
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

export const getLotProjectDocumentCompliance = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser, connection);
    const projectAccessPredicate = accessibleProjectIds === null
      ? ''
      : accessibleProjectIds.length
        ? ` AND lp.lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})`
        : ' AND 1 = 0';
    const projectAccessParams = accessibleProjectIds === null ? [] : accessibleProjectIds;

    const requiredTables = [
      'lot_projects',
      'lot_project_listings',
      'lot_project_listing_documents',
      'lot_project_client_profiles',
      'lot_project_client_documents',
    ];

    for (const tableName of requiredTables) {
      if (!(await tableExists(connection, tableName))) {
        return res.json({ success: true, data: { projects: [], units: [] } });
      }
    }

    const baseFromSql = `
      FROM lot_project_listings l
      INNER JOIN lot_projects lp
        ON lp.lot_project_id = l.lot_project_id
      INNER JOIN lot_project_client_profiles cp
        ON cp.lot_project_listing_id = l.lot_project_listing_id AND cp.lot_project_client_profile_status = 'active'
      INNER JOIN lot_project_listing_documents ld
        ON ld.lot_project_listing_id = l.lot_project_listing_id
       AND ld.lot_project_listing_document_status = 'active'
      LEFT JOIN lot_project_client_documents cd
        ON cd.lot_project_listing_id = l.lot_project_listing_id
       AND cd.lot_project_client_profile_id = cp.lot_project_client_profile_id
       AND cd.document_id = ld.document_id
      WHERE l.lot_project_listing_status IN ('sold', 'pending_for_cancellation')
        AND cp.lot_project_client_profile_status IN ('active', 'closed')
        ${projectAccessPredicate}
    `;

    const [projectRows] = await connection.query(
      `
        SELECT
          lp.lot_project_id,
          lp.lot_project_name,
          lp.lot_project_slug,
          COUNT(DISTINCT cp.lot_project_client_profile_id) AS total_accounts,
          COUNT(DISTINCT CASE
            WHEN ld.lot_project_listing_document_is_required = 1
              AND COALESCE(cd.lot_project_client_document_status, 'Missing') IN ('Missing', 'Rejected')
            THEN cp.lot_project_client_profile_id
          END) AS accounts_with_pending_documents,
          COUNT(ld.lot_project_listing_document_id) AS total_documents,
          COALESCE(SUM(COALESCE(cd.lot_project_client_document_status, 'Missing') IN ('Submitted', 'Approved')), 0) AS submitted_documents,
          COALESCE(SUM(COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Approved'), 0) AS approved_documents,
          COALESCE(SUM(COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Submitted'), 0) AS awaiting_approval_documents,
          COALESCE(SUM(
            ld.lot_project_listing_document_is_required = 1
            AND COALESCE(cd.lot_project_client_document_status, 'Missing') IN ('Missing', 'Rejected')
          ), 0) AS pending_required_documents,
          COALESCE(SUM(
            ld.lot_project_listing_document_is_required = 1
            AND COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Missing'
          ), 0) AS missing_required_documents,
          COALESCE(SUM(
            ld.lot_project_listing_document_is_required = 1
            AND COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Rejected'
          ), 0) AS rejected_required_documents
        ${baseFromSql}
        GROUP BY lp.lot_project_id, lp.lot_project_name, lp.lot_project_slug
        ORDER BY lp.lot_project_name ASC
      `,
      projectAccessParams
    );

    const [unitRows] = await connection.query(
      `
        SELECT
          lp.lot_project_id,
          lp.lot_project_name,
          lp.lot_project_slug,
          l.lot_project_listing_id,
          l.lot_project_listing_unit_id,
          l.lot_project_listing_status,
          l.lot_project_listing_sold_substatus,
          cp.lot_project_client_profile_id,
          cp.buyer_full_name,
          COUNT(ld.lot_project_listing_document_id) AS total_documents,
          COALESCE(SUM(COALESCE(cd.lot_project_client_document_status, 'Missing') IN ('Submitted', 'Approved')), 0) AS submitted_documents,
          COALESCE(SUM(COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Approved'), 0) AS approved_documents,
          COALESCE(SUM(COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Submitted'), 0) AS awaiting_approval_documents,
          COALESCE(SUM(
            ld.lot_project_listing_document_is_required = 1
            AND COALESCE(cd.lot_project_client_document_status, 'Missing') IN ('Missing', 'Rejected')
          ), 0) AS pending_required_documents,
          COALESCE(SUM(
            ld.lot_project_listing_document_is_required = 1
            AND COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Missing'
          ), 0) AS missing_required_documents,
          COALESCE(SUM(
            ld.lot_project_listing_document_is_required = 1
            AND COALESCE(cd.lot_project_client_document_status, 'Missing') = 'Rejected'
          ), 0) AS rejected_required_documents
        ${baseFromSql}
        GROUP BY
          lp.lot_project_id,
          lp.lot_project_name,
          lp.lot_project_slug,
          l.lot_project_listing_id,
          l.lot_project_listing_unit_id,
          l.lot_project_listing_status,
          l.lot_project_listing_sold_substatus,
          cp.lot_project_client_profile_id,
          cp.buyer_full_name
        ORDER BY pending_required_documents DESC, lp.lot_project_name ASC, l.lot_project_listing_unit_id ASC
      `,
      projectAccessParams
    );

    const mapCounts = (row) => ({
      totalDocuments: Number(row.total_documents || 0),
      submittedDocuments: Number(row.submitted_documents || 0),
      approvedDocuments: Number(row.approved_documents || 0),
      awaitingApprovalDocuments: Number(row.awaiting_approval_documents || 0),
      pendingRequiredDocuments: Number(row.pending_required_documents || 0),
      missingRequiredDocuments: Number(row.missing_required_documents || 0),
      rejectedRequiredDocuments: Number(row.rejected_required_documents || 0),
    });

    const completedAccountsByProject = new Map();

    unitRows.forEach((row) => {
      const counts = mapCounts(row);
      const isDocumentComplete = counts.totalDocuments > 0
        && counts.approvedDocuments === counts.totalDocuments;

      if (!isDocumentComplete) return;

      const projectId = Number(row.lot_project_id || 0);
      completedAccountsByProject.set(
        projectId,
        Number(completedAccountsByProject.get(projectId) || 0) + 1
      );
    });

    return res.json({
      success: true,
      data: {
        projects: projectRows.map((row) => ({
          projectId: row.lot_project_id,
          projectName: row.lot_project_name,
          projectSlug: row.lot_project_slug,
          totalAccounts: Number(row.total_accounts || 0),
          accountsWithCompletedDocuments: Number(completedAccountsByProject.get(Number(row.lot_project_id)) || 0),
          accountsWithPendingDocuments: Number(row.accounts_with_pending_documents || 0),
          ...mapCounts(row),
        })),
        units: unitRows.map((row) => {
          const counts = mapCounts(row);
          return {
            projectId: row.lot_project_id,
            projectName: row.lot_project_name,
            projectSlug: row.lot_project_slug,
            listingId: row.lot_project_listing_id,
            unitId: row.lot_project_listing_unit_id,
            listingStatus: row.lot_project_listing_status,
            soldSubstatus: row.lot_project_listing_sold_substatus,
            clientProfileId: row.lot_project_client_profile_id,
            buyerName: row.buyer_full_name || '-',
            ...counts,
            completionPercentage: counts.totalDocuments > 0
              ? Math.round((counts.submittedDocuments / counts.totalDocuments) * 10000) / 100
              : 0,
          };
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


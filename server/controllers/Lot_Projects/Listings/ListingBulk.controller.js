import {
  db, getProjectBySlug, getErrorMessage, mapListingRow, tableExists,
} from '../_shared/lotProject.shared.js';
import { calculateContractPricing } from '../_shared/listingPricing.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import { createOperationalReview } from '../../../services/operationalReview.service.js';
import { hasBuyerFormSchema, revokeOpenBuyerFormLinks } from '../BuyerForms/buyerForm.shared.js';
import { syncListingDocumentCloudinaryUnitFolder, rollbackListingDocumentCloudinaryMoves } from './Listings.controller.js';
import { BULK_FIELDS, normalizedListing, normalizeBulkInput, listingChanges, statusFilterSQL, validateBulkListing } from './listingBulkFields.js';

const MAX_BATCH_ROWS = 5000;
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const hasChanged = (item) => Object.keys(item.changes).length > 0;
const listSnapshot = (listing) => ({ ...normalizedListing(listing), listingId: Number(listing.lot_project_listing_id), status: listing.lot_project_listing_status, soldSubstatus: listing.lot_project_listing_sold_substatus });

const cadastralSQL = `(
 SELECT GROUP_CONCAT(c.lot_project_cadastral_lot_number ORDER BY c.lot_project_cadastral_lot_number SEPARATOR ', ')
 FROM lot_project_listing_cadastral_lots rel
 JOIN lot_project_cadastral_lot_numbers c ON c.lot_project_cadastral_lot_number_id = rel.lot_project_cadastral_lot_number_id
 WHERE rel.lot_project_listing_id = l.lot_project_listing_id
) AS cadastral_lots`;

const loadListings = async (connection, projectId, ids = null, status = 'all', forUpdate = false) => {
  const filter = statusFilterSQL(status);
  const idSQL = ids ? `AND l.lot_project_listing_id IN (${ids.map(() => '?').join(', ')})` : '';
  const [rows] = await connection.query(
    `SELECT l.*, ${cadastralSQL} FROM lot_project_listings l
     WHERE l.lot_project_id = ? ${idSQL} ${filter.sql}
     ORDER BY l.lot_project_listing_id ASC ${forUpdate ? 'FOR UPDATE' : ''}`,
    [projectId, ...(ids || []), ...filter.params]
  );
  return rows;
};

export const getBulkListingExport = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || ''));
    if (!project) throw fail('Project not found.', 404);
    const status = String(req.query.status || 'all');
    const rows = await loadListings(connection, project.lot_project_id, null, status);
    // Do not expose buyer data or private documents in exported spreadsheets.
    return res.json({ success: true, data: rows.map(mapListingRow), project: {
      id: project.lot_project_id, name: project.lot_project_name, locationCode: project.lot_project_location_code,
    }, status });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: getErrorMessage(error) });
  } finally { connection.release(); }
};

export const auditBulkListingExport = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || ''));
    if (!project) throw fail('Project not found.', 404);
    const status = String(req.body?.status || 'all');
    const format = String(req.body?.format || 'inventory');
    if (!['inventory', 'editable'].includes(format)) throw fail('Invalid Excel export format.');
    const listingCount = (await loadListings(connection, project.lot_project_id, null, status)).length;
    await writeAuditLog(connection, req, { action: 'export', module: 'Listings', entityType: 'lot_project',
      entityId: String(project.lot_project_id), entityLabel: project.lot_project_name,
      title: 'Exported listing inventory',
      description: `Exported ${listingCount} ${status} listing(s) as ${format === 'editable' ? 'editable' : 'reference'} Excel.`,
      metadata: { status, format, listingCount },
    });
    return res.json({ success: true, listingCount });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) }); }
  finally { connection.release(); }
};

const planRows = async (connection, project, rows, { forUpdate = false } = {}) => {
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_BATCH_ROWS) throw fail(`Select 1–${MAX_BATCH_ROWS} listing rows per batch.`);
  const ids = rows.map((row) => Number(row.listingId));
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) throw fail('Listing IDs must be unique positive integers.');
  const allRows = await loadListings(connection, project.lot_project_id, ids, 'all', forUpdate);
  if (allRows.length !== ids.length) throw fail('One or more listings no longer exist in the selected project.', 409);
  const byId = new Map(allRows.map((row) => [Number(row.lot_project_listing_id), row]));
  const allCadastral = new Map();
  const [lots] = await connection.query('SELECT lot_project_cadastral_lot_number, lot_project_cadastral_lot_number_id FROM lot_project_cadastral_lot_numbers WHERE lot_project_id = ?', [project.lot_project_id]);
  for (const lot of lots) allCadastral.set(String(lot.lot_project_cadastral_lot_number).toUpperCase(), lot.lot_project_cadastral_lot_number_id);
  const planned = []; const errors = [];
  for (const row of rows) {
    const listing = byId.get(Number(row.listingId));
    const before = normalizedListing(listing);
    const excelRow = Number(row.excelRowNumber || 0);
    const rowErrors = [];
    let after = null;
    if (!row.original || !row.values || !row.expectedStatus) rowErrors.push('Missing original values, edited values, or status.');
    else {
      try {
        const original = normalizeBulkInput(row.original, {});
        if (BULK_FIELDS.some((field) => original[field] !== before[field])) rowErrors.push('Listing changed since the workbook was exported. Download a fresh template.');
        after = normalizeBulkInput(row.values, before);
        rowErrors.push(...validateBulkListing(after, project.lot_project_location_code));
        const priorIds = before.oldUnitIds ? before.oldUnitIds.split(', ').filter(Boolean) : [];
        const nextIds = new Set(after.oldUnitIds ? after.oldUnitIds.split(', ').filter(Boolean) : []);
        if (priorIds.some((id) => !nextIds.has(id))) rowErrors.push('Previously recorded Old Unit IDs must be retained.');
      } catch (error) { rowErrors.push(error.message); }
    }
    const expectedStatus = mapListingRow(listing).status;
    if (row.expectedStatus !== expectedStatus) rowErrors.push('Status changed since the workbook was exported.');
    if (after) {
      const changed = listingChanges(before, after);
      if (Object.keys(changed).length && !['available', 'hold'].includes(String(listing.lot_project_listing_status))) {
        rowErrors.push('Protected sale/cancellation listing: use the individual Edit Listing approval workflow; buyer contract fields are frozen.');
      }
      if (Object.keys(changed).length && Number(listing.current_account_id || 0) > 0) rowErrors.push('A current buyer account is linked to this listing.');
      const cadastralNames = after.cadastralLots ? after.cadastralLots.split(', ').filter(Boolean) : [];
      for (const name of cadastralNames) if (!allCadastral.has(name)) rowErrors.push(`Unknown cadastral lot: ${name}`);
      planned.push({ listing, before, after, changes: changed, cadastralNames, excelRowNumber: excelRow });
    }
    if (rowErrors.length) errors.push({ listingId: row.listingId, excelRowNumber: excelRow, unitCode: before.unitCode, errors: [...new Set(rowErrors)] });
  }
  const changed = planned.filter(hasChanged);
  const seenCodes = new Map();
  for (const item of changed) {
    const code = item.after.unitCode;
    if (seenCodes.has(code)) errors.push({ listingId: item.listing.lot_project_listing_id, excelRowNumber: item.excelRowNumber, errors: [`Duplicate Unit ID ${code} in this batch.`] });
    seenCodes.set(code, true);
  }
  if (changed.length) {
    // Check all current unit IDs and historical aliases, including aliases newly
    // added in the worksheet. Never allow one unit to claim another unit's ID.
    const [existingCodes] = await connection.query(
      `SELECT lot_project_listing_id, lot_project_listing_unit_id, lot_project_listing_old_unit_ids
       FROM lot_project_listings WHERE lot_project_id = ?`, [project.lot_project_id]
    );
    const claimedByOther = (candidate, id) => existingCodes.some((other) =>
      Number(other.lot_project_listing_id) !== Number(id)
        && (String(other.lot_project_listing_unit_id).toUpperCase() === candidate
          || String(other.lot_project_listing_old_unit_ids || '').toUpperCase().split(/[,;\n]+/).map((value) => value.trim()).includes(candidate))
    );
    for (const item of changed) {
      const id = item.listing.lot_project_listing_id;
      if (item.after.unitCode !== item.before.unitCode && claimedByOther(item.after.unitCode, id)) {
        errors.push({ listingId: id, excelRowNumber: item.excelRowNumber, errors: [`Unit ID ${item.after.unitCode} is already used by another listing or its Old Unit IDs.`] });
      }
      const originalAliases = new Set(item.before.oldUnitIds ? item.before.oldUnitIds.split(', ') : []);
      const newAliases = item.after.oldUnitIds ? item.after.oldUnitIds.split(', ').filter((alias) => !originalAliases.has(alias)) : [];
      for (const alias of newAliases) {
        if (claimedByOther(alias, id)) errors.push({ listingId: id, excelRowNumber: item.excelRowNumber, errors: [`Historical Unit ID ${alias} belongs to another listing.`] });
      }
    }
  }
  return { planned, changed, errors };
};

export const validateBulkListingEdit = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || ''));
    if (!project) throw fail('Project not found.', 404);
    const plan = await planRows(connection, project, req.body?.rows);
    return res.json({ success: true, valid: plan.errors.length === 0, errors: plan.errors,
      total: plan.planned.length, changedCount: plan.changed.length,
      unchangedCount: plan.planned.length - plan.changed.length,
      preview: plan.changed.map((item) => ({ listingId: item.listing.lot_project_listing_id, excelRowNumber: item.excelRowNumber,
        before: item.before, after: item.after, changes: item.changes })),
    });
  } catch (error) { return res.status(error.statusCode || 400).json({ message: getErrorMessage(error) }); }
  finally { connection.release(); }
};

export const applyBulkListingEdit = async (req, res) => {
  const connection = await db.getConnection();
  const completedCloudinaryMoves = [];
  let committed = false;
  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || ''));
    if (!project) throw fail('Project not found.', 404);
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5 || reason.length > 1000) throw fail('Enter a reason (5–1000 characters) for the adjustment.');
    if (!await tableExists(connection, 'lot_project_listing_bulk_batches') || !await tableExists(connection, 'lot_project_listing_bulk_rows')) {
      throw fail('Bulk listing database migration has not been applied (20261013_bulk_listing_updates.sql).', 503);
    }
    await connection.beginTransaction();
    const plan = await planRows(connection, project, req.body?.rows, { forUpdate: true });
    if (plan.errors.length) {
      await connection.rollback();
      return res.status(409).json({ message: 'Bulk update rejected; download a new template or correct the errors. No changes were saved.', errors: plan.errors });
    }
    if (!plan.changed.length) { await connection.rollback(); return res.status(400).json({ message: 'No listing values were changed.' }); }
    const filename = String(req.body?.filename || 'Bulk Edit Listings.xlsx').slice(0, 255);
    const [batchResult] = await connection.query(
      `INSERT INTO lot_project_listing_bulk_batches (lot_project_id, changed_by_user_id, source_filename, adjustment_reason, changed_count)
       VALUES (?, ?, ?, ?, ?)`, [project.lot_project_id, req.authUser?.id || null, filename, reason, plan.changed.length]
    );
    const batchId = Number(batchResult.insertId);
    for (const item of plan.changed) {
      const { listing, before, after, changes, cadastralNames } = item;
      const id = Number(listing.lot_project_listing_id);
      if (after.unitCode !== before.unitCode) {
        await syncListingDocumentCloudinaryUnitFolder(connection, id, before.unitCode, after.unitCode, completedCloudinaryMoves);
      }
      const price = calculateContractPricing({ lotAreaSqm: after.lotAreaSqm, pricePerSqm: after.installmentPricePerSqm, legalMiscRate: after.legalMiscRate });
      await connection.query(
        `UPDATE lot_project_listings SET lot_project_listing_unit_id = ?, lot_project_listing_old_unit_ids = ?,
          lot_project_listing_unit_type = ?, lot_project_listing_area_sqm = ?,
          lot_project_listing_price_per_sqm = ?, lot_project_listing_installment_price_per_sqm = ?,
          lot_project_listing_cash_price_per_sqm = ?, lot_project_listing_net_selling_price = ?,
          lot_project_listing_lmf_rate = ?, lot_project_listing_lmf_amount = ?, lot_project_listing_tcp = ?,
          lot_project_listing_reservation_fee = ?, annual_interest_rate = ?
         WHERE lot_project_listing_id = ? AND lot_project_id = ?`,
        [after.unitCode, after.oldUnitIds || null, after.lotType, after.lotAreaSqm, after.installmentPricePerSqm,
          after.installmentPricePerSqm, after.cashPricePerSqm, price.netSellingPrice, after.legalMiscRate,
          price.lmfAmount, price.tcp, after.reservationFee, after.annualInterestRate, id, project.lot_project_id]
      );
      if (before.cadastralLots !== after.cadastralLots) {
        await connection.query('DELETE FROM lot_project_listing_cadastral_lots WHERE lot_project_listing_id = ?', [id]);
        if (cadastralNames.length) {
          const [lotRows] = await connection.query(
            `SELECT lot_project_cadastral_lot_number_id FROM lot_project_cadastral_lot_numbers
             WHERE lot_project_id = ? AND UPPER(lot_project_cadastral_lot_number) IN (${cadastralNames.map(() => '?').join(',')})`,
            [project.lot_project_id, ...cadastralNames]
          );
          if (lotRows.length !== cadastralNames.length) throw fail('Cadastral lot list changed. Try again.', 409);
          for (const lot of lotRows) await connection.query(
            'INSERT INTO lot_project_listing_cadastral_lots (lot_project_listing_id, lot_project_cadastral_lot_number_id) VALUES (?,?)',
            [id, lot.lot_project_cadastral_lot_number_id]
          );
        }
      }
      if (after.unitCode !== before.unitCode && await hasBuyerFormSchema(connection)) {
        await revokeOpenBuyerFormLinks(connection, id, { status: 'superseded' });
        await connection.query('UPDATE lot_project_listings SET buyer_form_generation = buyer_form_generation + 1 WHERE lot_project_listing_id = ?', [id]);
      }
      const beforeSnapshot = { ...before, unitStatus: listing.lot_project_listing_status };
      const afterSnapshot = { ...after, unitStatus: listing.lot_project_listing_status };
      await connection.query(
        `INSERT INTO lot_project_listing_bulk_rows (batch_id, lot_project_listing_id, before_snapshot_json, after_snapshot_json, changed_fields_json) VALUES (?,?,?,?,?)`,
        [batchId, id, JSON.stringify(beforeSnapshot), JSON.stringify(afterSnapshot), JSON.stringify(changes)]
      );
      await writeAuditLog(connection, req, { action: 'update', module: 'Listings', entityType: 'lot_project_listing',
        entityId: String(id), entityLabel: after.unitCode, title: 'Bulk-edited listing',
        description: `Updated ${after.unitCode} from bulk listing batch ${batchId}. Reason: ${reason}`,
        metadata: { batchId, reason, before: beforeSnapshot, after: afterSnapshot, changes },
      });
      await createOperationalReview(connection, { actor: req.authUser, actionKey: 'listing.edit', department: 'operations',
        projectId: project.lot_project_id, entityType: 'lot_project_listing', entityId: id,
        entityLabel: `Unit ${after.unitCode} — ${project.lot_project_name}`, beforeSnapshot, afterSnapshot });
    }
    await writeAuditLog(connection, req, { action: 'import', module: 'Listings', entityType: 'lot_project_listing_bulk_batch',
      entityId: String(batchId), entityLabel: `Bulk listing batch ${batchId}`, title: 'Bulk listing adjustment completed',
      description: `${plan.changed.length} listings updated. Reason: ${reason}`, metadata: { batchId, reason, changedCount: plan.changed.length },
    });
    await connection.commit(); committed = true;
    return res.json({ success: true, batchId, changedCount: plan.changed.length, message: `Updated ${plan.changed.length} listings.` });
  } catch (error) {
    if (!committed) {
      try { await connection.rollback(); } catch { /* already rolled back */ }
      // Compensate external asset moves after rollback, as with individual edits.
      if (completedCloudinaryMoves.length) await rollbackListingDocumentCloudinaryMoves(completedCloudinaryMoves);
    }
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally { connection.release(); }
};

export const getBulkListingHistory = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || ''));
    if (!project) throw fail('Project not found.', 404);
    if (!await tableExists(connection, 'lot_project_listing_bulk_batches')) return res.json({ success: true, data: [] });
    const [rows] = await connection.query(
      `SELECT batch_id, source_filename, adjustment_reason, changed_count, created_at, changed_by_user_id
       FROM lot_project_listing_bulk_batches WHERE lot_project_id = ? ORDER BY batch_id DESC LIMIT 50`, [project.lot_project_id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) }); }
  finally { connection.release(); }
};

import {
  db,
  getErrorMessage,
  tableExists,
  columnExists,
  getProjectBySlug,
  getProjectDefaultDocuments,
  normalizeLotType,
  toNullable,
} from '../_shared/lotProject.shared.js'
import { calculateContractPricing } from '../_shared/listingPricing.js'
import { createListingStorageCode } from '../../../services/storageCodes.service.js'
import { writeAuditLog } from '../../System/auditLogs.controller.js'
import { replaceListingDocumentRequirements } from './Listings.controller.js'

const IMPORT_BATCH_TABLE = 'lot_project_listing_import_batches'
const IMPORT_ROW_TABLE = 'lot_project_listing_import_rows'
const MAX_IMPORT_ROWS = 5000

const clean = (value = '') => String(value ?? '').trim()
const cleanNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0
  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : Number.NaN
}
const safeJson = (value) => JSON.stringify(value ?? null)

const requireImportSchema = async (connection) => {
  const missing = []
  for (const table of [IMPORT_BATCH_TABLE, IMPORT_ROW_TABLE]) {
    if (!(await tableExists(connection, table))) missing.push(table)
  }
  if (!(await columnExists(connection, 'lot_project_listings', 'created_from_import_batch_id'))) {
    missing.push('lot_project_listings.created_from_import_batch_id')
  }
  if (missing.length) {
    const error = new Error(`Listing import database migration is incomplete. Missing: ${missing.join(', ')}. Run server/migrations/20260908_listing_imports.sql.`)
    error.statusCode = 500
    throw error
  }
}

const getProjectCadastralMap = async (connection, projectId) => {
  if (!(await tableExists(connection, 'lot_project_cadastral_lot_numbers'))) return new Map()
  const [rows] = await connection.query(
    `SELECT lot_project_cadastral_lot_number_id, lot_project_cadastral_lot_number
     FROM lot_project_cadastral_lot_numbers
     WHERE lot_project_id = ?`,
    [projectId]
  )
  return new Map(rows.map((row) => [clean(row.lot_project_cadastral_lot_number), Number(row.lot_project_cadastral_lot_number_id)]))
}

const normalizeImportRow = (rawRow = {}, index, project, cadastralMap) => {
  const excelRowNumber = Number(rawRow.excelRowNumber || rawRow.rowNumber || index + 2)
  const errors = []
  const projectCode = clean(project.lot_project_location_code).toUpperCase()
  const prefix = `${projectCode}-`
  const rawUnitNumber = clean(rawRow.unitNumber ?? rawRow.unitId ?? rawRow['Unit ID *'] ?? rawRow['Unit ID'] ?? rawRow.unit_id)
  const unitNumber = rawUnitNumber
  const unitCode = unitNumber && projectCode ? `${prefix}${unitNumber}`.toUpperCase() : ''
  const cadastralLots = [...new Set(
    clean(rawRow.cadastralLotNo ?? rawRow.cadastralLots ?? rawRow['Cadastral Lot No. *'] ?? rawRow['Cadastral Lot No.'])
      .split(',')
      .map((item) => clean(item))
      .filter(Boolean)
  )]
  const lotTypeInput = clean(rawRow.lotType ?? rawRow['Lot Type *'] ?? rawRow['Lot Type'] ?? 'Inner')
  const installmentPricePerSqm = cleanNumber(rawRow.installmentPricePerSqm ?? rawRow['Price / SQM — Installment *'] ?? rawRow['Price / SQM — Installment'] ?? rawRow['Price / SQM - Installment *'] ?? rawRow['Price / SQM - Installment'])
  const cashPricePerSqm = cleanNumber(rawRow.cashPricePerSqm ?? rawRow['Price / SQM — Cash *'] ?? rawRow['Price / SQM — Cash'] ?? rawRow['Price / SQM - Cash *'] ?? rawRow['Price / SQM - Cash'])
  const lotAreaSqm = cleanNumber(rawRow.lotAreaSqm ?? rawRow['Lot Area SQM *'] ?? rawRow['Lot Area SQM'])
  const reservationFee = cleanNumber(rawRow.reservationFee ?? rawRow['Reservation Fee'])
  const legalMiscRate = cleanNumber(rawRow.legalMiscRate ?? rawRow['Legal / Misc Rate (%)'])
  const annualInterestRate = cleanNumber(rawRow.annualInterestRate ?? rawRow['Annual Interest Rate (%)'])
  const oldUnitIds = clean(rawRow.oldUnitIds ?? rawRow['Old Unit IDs'])

  if (!projectCode) errors.push('This project does not have a location/project code. Set the project code before importing listings.')
  if (!unitNumber) errors.push('Unit ID is required.')
  if (projectCode && unitNumber.toUpperCase().startsWith(prefix)) errors.push(`Enter only the unit number after the locked ${prefix} prefix.`)
  if (/\s/.test(unitNumber)) errors.push('Unit ID cannot contain spaces.')
  if (!['inner', 'corner', 'end'].includes(lotTypeInput.toLowerCase())) errors.push('Lot Type must be Inner, Corner, or End.')
  if (!Number.isFinite(installmentPricePerSqm) || installmentPricePerSqm <= 0) errors.push('Installment price per SQM must be greater than 0.')
  if (!Number.isFinite(cashPricePerSqm) || cashPricePerSqm <= 0) errors.push('Cash price per SQM must be greater than 0.')
  if (!Number.isFinite(lotAreaSqm) || lotAreaSqm <= 0) errors.push('Lot Area SQM must be greater than 0.')
  if (!Number.isFinite(reservationFee) || reservationFee < 0) errors.push('Reservation Fee cannot be negative.')
  if (!Number.isFinite(legalMiscRate) || legalMiscRate < 0 || legalMiscRate > 100) errors.push('Legal / Misc Rate must be between 0 and 100.')
  if (!Number.isFinite(annualInterestRate) || annualInterestRate < 0 || annualInterestRate > 100) errors.push('Annual Interest Rate must be between 0 and 100.')
  if (!cadastralLots.length) errors.push('Cadastral Lot No. is required.')
  if (cadastralLots.length > 1) errors.push('Only one Cadastral Lot No. may be assigned per imported listing row.')
  const missingLots = cadastralLots.filter((lot) => !cadastralMap.has(lot))
  if (missingLots.length) errors.push(`Cadastral lot(s) ${missingLots.join(', ')} are not part of this project.`)

  return {
    excelRowNumber,
    raw: rawRow,
    normalized: {
      unitNumber,
      unitCode,
      oldUnitIds,
      cadastralLots,
      lotType: normalizeLotType(lotTypeInput),
      reservationFee,
      installmentPricePerSqm,
      cashPricePerSqm,
      lotAreaSqm,
      legalMiscRate,
      annualInterestRate,
      status: 'available',
    },
    errors,
  }
}

const validateRows = async (connection, project, inputRows = []) => {
  const rows = Array.isArray(inputRows) ? inputRows : []
  if (!rows.length) return { rows: [], errors: [{ row: 0, message: 'The Excel file does not contain any listing rows.' }] }
  if (rows.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ row: 0, message: `A single import may contain at most ${MAX_IMPORT_ROWS} listings.` }] }
  }

  const cadastralMap = await getProjectCadastralMap(connection, project.lot_project_id)
  const normalizedRows = rows.map((row, index) => normalizeImportRow(row, index, project, cadastralMap))
  const seen = new Map()

  for (const row of normalizedRows) {
    const unitCode = row.normalized.unitCode
    if (!unitCode) continue
    if (seen.has(unitCode)) {
      row.errors.push(`Duplicate Unit ID in this import. It also appears on Excel row ${seen.get(unitCode)}.`)
    } else {
      seen.set(unitCode, row.excelRowNumber)
    }
  }

  const unitCodes = normalizedRows.map((row) => row.normalized.unitCode).filter(Boolean)
  if (unitCodes.length) {
    const [existing] = await connection.query(
      `SELECT lot_project_listing_unit_id
       FROM lot_project_listings
       WHERE lot_project_id = ?
         AND lot_project_listing_unit_id IN (${unitCodes.map(() => '?').join(', ')})`,
      [project.lot_project_id, ...unitCodes]
    )
    const existingSet = new Set(existing.map((row) => clean(row.lot_project_listing_unit_id).toUpperCase()))
    for (const row of normalizedRows) {
      if (existingSet.has(row.normalized.unitCode)) row.errors.push(`${row.normalized.unitCode} already exists in this project.`)
    }
  }

  return {
    rows: normalizedRows,
    errors: normalizedRows.flatMap((row) => row.errors.map((message) => ({ row: row.excelRowNumber, unitCode: row.normalized.unitCode, message }))),
    cadastralOptions: [...cadastralMap.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  }
}

export const validateLotProjectListingImport = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const project = await getProjectBySlug(clean(req.params.projectSlug))
    if (!project) return res.status(404).json({ message: 'Lot project not found.' })
    const result = await validateRows(connection, project, req.body?.rows)
    return res.json({
      success: true,
      data: {
        project: {
          id: project.lot_project_id,
          name: project.lot_project_name,
          locationCode: project.lot_project_location_code,
        },
        totalRows: result.rows.length,
        validRows: result.rows.filter((row) => !row.errors.length).length,
        invalidRows: result.rows.filter((row) => row.errors.length).length,
        errors: result.errors,
        rows: result.rows.map((row) => ({
          excelRowNumber: row.excelRowNumber,
          ...row.normalized,
          errors: row.errors,
        })),
        cadastralOptions: result.cadastralOptions,
      },
    })
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally {
    connection.release()
  }
}

const insertImportedListing = async (connection, project, batchId, row, defaultDocuments) => {
  const value = row.normalized
  const pricing = calculateContractPricing({
    lotAreaSqm: value.lotAreaSqm,
    pricePerSqm: value.installmentPricePerSqm,
    legalMiscRate: value.legalMiscRate,
  })

  const [result] = await connection.query(
    `INSERT INTO lot_project_listings (
      lot_project_id,
      lot_project_listing_unit_type,
      lot_project_listing_unit_id,
      lot_project_listing_old_unit_ids,
      lot_project_listing_area_sqm,
      lot_project_listing_price_per_sqm,
      lot_project_listing_installment_price_per_sqm,
      lot_project_listing_cash_price_per_sqm,
      lot_project_listing_net_selling_price,
      lot_project_listing_lmf_rate,
      lot_project_listing_lmf_amount,
      lot_project_listing_tcp,
      lot_project_listing_reservation_fee,
      annual_interest_rate,
      lot_project_listing_status,
      lot_project_listing_sold_substatus,
      created_from_import_batch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', NULL, ?)`,
    [
      project.lot_project_id,
      value.lotType,
      value.unitCode,
      toNullable(value.oldUnitIds),
      value.lotAreaSqm,
      value.installmentPricePerSqm,
      value.installmentPricePerSqm,
      value.cashPricePerSqm,
      pricing.netSellingPrice,
      value.legalMiscRate,
      pricing.lmfAmount,
      pricing.tcp,
      value.reservationFee,
      value.annualInterestRate,
      batchId,
    ]
  )
  const listingId = Number(result.insertId)
  const storageCode = createListingStorageCode(listingId)
  await connection.query(
    `UPDATE lot_project_listings SET lot_project_listing_storage_code = ? WHERE lot_project_listing_id = ?`,
    [storageCode, listingId]
  )

  if (value.cadastralLots.length && await tableExists(connection, 'lot_project_listing_cadastral_lots')) {
    const [lotRows] = await connection.query(
      `SELECT lot_project_cadastral_lot_number_id, lot_project_cadastral_lot_number
       FROM lot_project_cadastral_lot_numbers
       WHERE lot_project_id = ? AND lot_project_cadastral_lot_number IN (${value.cadastralLots.map(() => '?').join(', ')})`,
      [project.lot_project_id, ...value.cadastralLots]
    )
    if (lotRows.length !== value.cadastralLots.length) throw new Error(`Cadastral lot validation changed while importing ${value.unitCode}. Please validate the file again.`)
    await connection.query(
      `INSERT INTO lot_project_listing_cadastral_lots (lot_project_listing_id, lot_project_cadastral_lot_number_id)
       VALUES ${lotRows.map(() => '(?, ?)').join(', ')}`,
      lotRows.flatMap((lot) => [listingId, lot.lot_project_cadastral_lot_number_id])
    )
  }

  await replaceListingDocumentRequirements(connection, project.lot_project_id, listingId, defaultDocuments)
  return { listingId, storageCode, pricing }
}

export const importLotProjectListings = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const project = await getProjectBySlug(clean(req.params.projectSlug))
    if (!project) return res.status(404).json({ message: 'Lot project not found.' })
    await requireImportSchema(connection)
    const requiredListingColumns = [
      'lot_project_listing_installment_price_per_sqm',
      'lot_project_listing_cash_price_per_sqm',
      'annual_interest_rate',
      'lot_project_listing_storage_code',
    ]
    const missingListingColumns = []
    for (const column of requiredListingColumns) {
      if (!(await columnExists(connection, 'lot_project_listings', column))) missingListingColumns.push(column)
    }
    if (missingListingColumns.length) {
      return res.status(500).json({
        message: `Listing import prerequisites are incomplete. Missing listing column(s): ${missingListingColumns.join(', ')}. Apply the existing listing pricing/storage migrations first.`,
      })
    }

    const validation = await validateRows(connection, project, req.body?.rows)
    if (validation.errors.length) {
      return res.status(400).json({
        message: `Import blocked. Fix ${validation.errors.length} validation error(s) and upload the file again.`,
        errors: validation.errors,
      })
    }

    const filename = clean(req.body?.filename || 'listing-import.xlsx').slice(0, 255)
    const fileSha256 = clean(req.body?.fileSha256).toLowerCase()
    if (fileSha256 && !/^[a-f0-9]{64}$/.test(fileSha256)) return res.status(400).json({ message: 'Invalid Excel file hash.' })
    const defaultDocuments = await getProjectDefaultDocuments(project.lot_project_id)

    await connection.beginTransaction()
    const temporaryReference = `IMP-TMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const [batchResult] = await connection.query(
      `INSERT INTO ${IMPORT_BATCH_TABLE} (
        batch_reference, lot_project_id, original_filename, file_sha256,
        total_rows, valid_rows, imported_rows, import_status, imported_by_user_id, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 'validated', ?, NOW())`,
      [temporaryReference, project.lot_project_id, filename, fileSha256 || null, validation.rows.length, validation.rows.length, req.authUser?.id || null]
    )
    const batchId = Number(batchResult.insertId)
    const batchReference = `IMP-${new Date().getFullYear()}-${String(batchId).padStart(6, '0')}`
    await connection.query(`UPDATE ${IMPORT_BATCH_TABLE} SET batch_reference = ? WHERE lot_project_listing_import_batch_id = ?`, [batchReference, batchId])

    const imported = []
    for (const row of validation.rows) {
      const inserted = await insertImportedListing(connection, project, batchId, row, defaultDocuments)
      await connection.query(
        `INSERT INTO ${IMPORT_ROW_TABLE} (
          lot_project_listing_import_batch_id, excel_row_number, lot_project_listing_id,
          unit_id_snapshot, original_input_json, normalized_input_json,
          validation_status, validation_errors_json, imported_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'imported', NULL, NOW())`,
        [batchId, row.excelRowNumber, inserted.listingId, row.normalized.unitCode, safeJson(row.raw), safeJson(row.normalized)]
      )

      await writeAuditLog(connection, req, {
        action: 'import',
        module: 'Listings',
        entityType: 'lot_project_listing',
        entityId: String(inserted.listingId),
        entityLabel: `Unit ${row.normalized.unitCode} — ${project.lot_project_name}`,
        title: 'Imported listing from Excel',
        description: `Created ${row.normalized.unitCode} from ${filename}.`,
        metadata: {
          source: 'excel_import', batchId, batchReference, filename, excelRowNumber: row.excelRowNumber,
          ...row.normalized,
          storageCode: inserted.storageCode,
          installmentNetSellingPrice: inserted.pricing.netSellingPrice,
          installmentLmfAmount: inserted.pricing.lmfAmount,
          installmentTcp: inserted.pricing.tcp,
          documentSource: 'project_defaults',
          documentCount: defaultDocuments.length,
        },
      })
      imported.push({ listingId: inserted.listingId, unitCode: row.normalized.unitCode })
    }

    await connection.query(
      `UPDATE ${IMPORT_BATCH_TABLE}
       SET imported_rows = ?, import_status = 'imported', imported_at = NOW()
       WHERE lot_project_listing_import_batch_id = ?`,
      [imported.length, batchId]
    )

    await writeAuditLog(connection, req, {
      action: 'import',
      module: 'Listing Imports',
      entityType: 'lot_project_listing_import_batch',
      entityId: String(batchId),
      entityLabel: `${batchReference} — ${filename}`,
      title: 'Imported listing batch',
      description: `Imported ${imported.length} listing(s) into ${project.lot_project_name}.`,
      metadata: { batchReference, filename, fileSha256: fileSha256 || null, projectId: project.lot_project_id, projectName: project.lot_project_name, importedRows: imported.length },
    })

    await connection.commit()
    return res.status(201).json({
      success: true,
      message: `${imported.length} listing(s) imported successfully.`,
      data: { batchId, batchReference, filename, importedRows: imported.length, listings: imported },
    })
  } catch (error) {
    try { await connection.rollback() } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally {
    connection.release()
  }
}

export const getLotProjectListingImports = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const project = await getProjectBySlug(clean(req.params.projectSlug))
    if (!project) return res.status(404).json({ message: 'Lot project not found.' })
    await requireImportSchema(connection)
    const [rows] = await connection.query(
      `SELECT batch.*, TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS imported_by_name,
              TRIM(CONCAT_WS(' ', ru.first_name, ru.middle_name, ru.last_name)) AS reverted_by_name
       FROM ${IMPORT_BATCH_TABLE} batch
       LEFT JOIN users u ON u.id = batch.imported_by_user_id
       LEFT JOIN users ru ON ru.id = batch.reverted_by_user_id
       WHERE batch.lot_project_id = ?
       ORDER BY batch.created_at DESC, batch.lot_project_listing_import_batch_id DESC
       LIMIT 100`,
      [project.lot_project_id]
    )
    return res.json({ success: true, data: rows })
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally { connection.release() }
}

export const getLotProjectListingImportBatch = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const project = await getProjectBySlug(clean(req.params.projectSlug))
    if (!project) return res.status(404).json({ message: 'Lot project not found.' })
    await requireImportSchema(connection)
    const batchId = Number(req.params.batchId || 0)
    const [[batch]] = await connection.query(
      `SELECT * FROM ${IMPORT_BATCH_TABLE} WHERE lot_project_listing_import_batch_id = ? AND lot_project_id = ? LIMIT 1`,
      [batchId, project.lot_project_id]
    )
    if (!batch) return res.status(404).json({ message: 'Import batch not found.' })
    const [rows] = await connection.query(
      `SELECT import_row.*, listing.lot_project_listing_status, listing.current_account_id
       FROM ${IMPORT_ROW_TABLE} import_row
       LEFT JOIN lot_project_listings listing ON listing.lot_project_listing_id = import_row.lot_project_listing_id
       WHERE import_row.lot_project_listing_import_batch_id = ?
       ORDER BY import_row.excel_row_number ASC`,
      [batchId]
    )
    return res.json({ success: true, data: { batch, rows } })
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally { connection.release() }
}

const getListingProtection = async (connection, listingId) => {
  const reasons = []
  const tables = [
    ['lot_project_accounts', 'buyer account'],
    ['lot_project_client_profiles', 'buyer profile'],
    ['lot_project_reservation_history', 'reservation history'],
    ['lot_project_payments', 'payment record'],
  ]
  for (const [table, label] of tables) {
    if (!(await tableExists(connection, table)) || !(await columnExists(connection, table, 'lot_project_listing_id'))) continue
    const [[countRow]] = await connection.query(`SELECT COUNT(*) AS total FROM ${table} WHERE lot_project_listing_id = ?`, [listingId])
    if (Number(countRow?.total || 0) > 0) reasons.push(label)
  }
  if (await tableExists(connection, 'lot_project_reservation_corrections')) {
    const [[correctionRow]] = await connection.query(
      `SELECT COUNT(*) AS total FROM lot_project_reservation_corrections
       WHERE source_listing_id = ? OR destination_listing_id = ?`,
      [listingId, listingId]
    )
    if (Number(correctionRow?.total || 0) > 0) reasons.push('reservation correction history')
  }
  return reasons
}

const removeImportedListing = async (connection, listingId) => {
  const dependentTables = ['lot_project_listing_documents', 'lot_project_listing_cadastral_lots', 'lot_project_notification_logs']
  for (const table of dependentTables) {
    if ((await tableExists(connection, table)) && (await columnExists(connection, table, 'lot_project_listing_id'))) {
      await connection.query(`DELETE FROM ${table} WHERE lot_project_listing_id = ?`, [listingId])
    }
  }
  const [result] = await connection.query(`DELETE FROM lot_project_listings WHERE lot_project_listing_id = ?`, [listingId])
  return Number(result.affectedRows || 0)
}

export const revertLotProjectListingImport = async (req, res) => {
  const connection = await db.getConnection()
  try {
    const project = await getProjectBySlug(clean(req.params.projectSlug))
    if (!project) return res.status(404).json({ message: 'Lot project not found.' })
    await requireImportSchema(connection)
    const batchId = Number(req.params.batchId || 0)
    const reason = clean(req.body?.reason)
    const mode = clean(req.body?.mode || 'all').toLowerCase()
    const requestedListingIds = new Set((Array.isArray(req.body?.listingIds) ? req.body.listingIds : []).map(Number).filter(Boolean))
    if (!reason) return res.status(400).json({ message: 'Reason for removing the imported listing(s) is required.' })
    if (!['all', 'safe_only', 'selected'].includes(mode)) return res.status(400).json({ message: 'Invalid import reversal mode.' })
    if (mode === 'selected' && !requestedListingIds.size) return res.status(400).json({ message: 'Select at least one imported listing to remove.' })

    await connection.beginTransaction()
    const [[batch]] = await connection.query(
      `SELECT * FROM ${IMPORT_BATCH_TABLE}
       WHERE lot_project_listing_import_batch_id = ? AND lot_project_id = ?
       LIMIT 1 FOR UPDATE`,
      [batchId, project.lot_project_id]
    )
    if (!batch) { await connection.rollback(); return res.status(404).json({ message: 'Import batch not found.' }) }

    const [rows] = await connection.query(
      `SELECT import_row.*, listing.lot_project_listing_status, listing.current_account_id
       FROM ${IMPORT_ROW_TABLE} import_row
       LEFT JOIN lot_project_listings listing ON listing.lot_project_listing_id = import_row.lot_project_listing_id
       WHERE import_row.lot_project_listing_import_batch_id = ?
         AND import_row.validation_status = 'imported'
       ORDER BY import_row.excel_row_number ASC
       FOR UPDATE`,
      [batchId]
    )
    const candidates = mode === 'selected'
      ? rows.filter((row) => requestedListingIds.has(Number(row.lot_project_listing_id)))
      : rows

    const safeRows = []
    const protectedRows = []
    for (const row of candidates) {
      const listingId = Number(row.lot_project_listing_id || 0)
      if (!listingId) continue
      const reasons = await getListingProtection(connection, listingId)
      if (String(row.lot_project_listing_status || '').toLowerCase() !== 'available') reasons.push(`status is ${row.lot_project_listing_status || 'unknown'}`)
      if (Number(row.current_account_id || 0) > 0) reasons.push('current buyer account')
      if (reasons.length) protectedRows.push({ listingId, unitCode: row.unit_id_snapshot, reasons: [...new Set(reasons)] })
      else safeRows.push(row)
    }

    if (['all', 'selected'].includes(mode) && protectedRows.length) {
      await connection.rollback()
      return res.status(409).json({
        message: mode === 'all'
          ? `This import cannot be fully undone because ${protectedRows.length} listing(s) contain protected activity. No listings were removed.`
          : `The selected listings cannot be removed because ${protectedRows.length} selection(s) contain protected activity. No selected listings were removed.`,
        protectedListings: protectedRows,
        safeListingCount: safeRows.length,
      })
    }

    if (!safeRows.length) {
      await connection.rollback()
      return res.status(409).json({ message: 'No selected imported listings are safe to remove.', protectedListings: protectedRows })
    }

    const removed = []
    for (const row of safeRows) {
      const listingId = Number(row.lot_project_listing_id)
      const normalized = typeof row.normalized_input_json === 'object' ? row.normalized_input_json : JSON.parse(row.normalized_input_json || '{}')
      const affected = await removeImportedListing(connection, listingId)
      if (affected !== 1) throw new Error(`Imported listing ${row.unit_id_snapshot} changed while the reversal was running.`)
      await connection.query(
        `UPDATE ${IMPORT_ROW_TABLE}
         SET validation_status = 'removed', removed_at = NOW(), removed_by_user_id = ?, lot_project_listing_id = NULL
         WHERE lot_project_listing_import_row_id = ?`,
        [req.authUser?.id || null, row.lot_project_listing_import_row_id]
      )
      await writeAuditLog(connection, req, {
        action: 'delete', module: 'Listings', entityType: 'lot_project_listing', entityId: String(listingId),
        entityLabel: `Unit ${row.unit_id_snapshot} — ${project.lot_project_name}`,
        title: 'Removed imported listing',
        description: `Removed ${row.unit_id_snapshot} from import batch ${batch.batch_reference}.`,
        metadata: { source: 'import_reversal', batchId, batchReference: batch.batch_reference, reason, originalListing: normalized },
      })
      removed.push({ listingId, unitCode: row.unit_id_snapshot })
    }

    const [[remainingRow]] = await connection.query(
      `SELECT COUNT(*) AS total FROM ${IMPORT_ROW_TABLE}
       WHERE lot_project_listing_import_batch_id = ? AND validation_status = 'imported'`,
      [batchId]
    )
    const remaining = Number(remainingRow.total || 0)
    const nextStatus = remaining === 0 ? 'reverted' : 'partially_reverted'
    await connection.query(
      `UPDATE ${IMPORT_BATCH_TABLE}
       SET removed_rows = removed_rows + ?, import_status = ?, reverted_by_user_id = ?, reverted_at = NOW(), revert_reason = ?
       WHERE lot_project_listing_import_batch_id = ?`,
      [removed.length, nextStatus, req.authUser?.id || null, reason, batchId]
    )
    await writeAuditLog(connection, req, {
      action: 'delete', module: 'Listing Imports', entityType: 'lot_project_listing_import_batch', entityId: String(batchId),
      entityLabel: `${batch.batch_reference} — ${batch.original_filename}`,
      title: remaining === 0 ? 'Undid listing import batch' : 'Partially reverted listing import batch',
      description: `Removed ${removed.length} listing(s) from ${batch.batch_reference}.`,
      metadata: { batchReference: batch.batch_reference, filename: batch.original_filename, reason, mode, removedCount: removed.length, remainingCount: remaining, protectedListings: protectedRows },
    })
    await connection.commit()
    return res.json({
      success: true,
      message: remaining === 0 ? `Import ${batch.batch_reference} was fully reverted.` : `${removed.length} safe listing(s) removed; ${remaining} imported listing(s) remain.`,
      data: { removed, protectedListings: protectedRows, remaining, status: nextStatus },
    })
  } catch (error) {
    try { await connection.rollback() } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) })
  } finally { connection.release() }
}

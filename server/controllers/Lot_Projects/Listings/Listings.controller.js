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
} from '../_shared/lotProject.shared.js';

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




const replaceListingSchedulesForProfile = async (connection, projectId, listingRow) => {
  if (!(await tableExists(connection, 'lot_project_payment_schedules'))) return;

  const terms = getComputedSoaTerms(listingRow, []);
  const computedRows = recomputeComputedSoaBalances(createComputedSoaRows(terms), terms);

  await connection.query(
    `DELETE FROM lot_project_payment_schedules WHERE lot_project_listing_id = ?`,
    [listingRow.lot_project_listing_id]
  );

  if (!computedRows.length) return;

  const baseColumns = [
    'lot_project_id',
    'lot_project_listing_id',
    'lot_project_client_profile_id',
    'due_date',
    'description',
    'beginning_balance',
    'due_amount',
    'penalty_amount',
    'amount_paid',
    'date_paid',
    'reference_id',
    'ending_balance',
    'schedule_status',
  ];
  const optionalColumns = [];
  const addOptionalColumn = async (column) => {
    if (await columnExists(connection, 'lot_project_payment_schedules', column)) optionalColumns.push(column);
  };

  await addOptionalColumn('interest_amount');
  await addOptionalColumn('principal_amount');
  await addOptionalColumn('monthly_amortization_amount');
  await addOptionalColumn('paid_interest_amount');
  await addOptionalColumn('paid_principal_amount');
  await addOptionalColumn('paid_penalty_amount');

  const columns = [...baseColumns, ...optionalColumns, 'created_at', 'updated_at'];
  const values = computedRows.flatMap((row) => {
    const baseValues = [
      projectId,
      listingRow.lot_project_listing_id,
      listingRow.lot_project_client_profile_id,
      row.dueDate,
      row.description,
      roundMoneyValue(row.beginningBalance || 0),
      roundMoneyValue(row.dueAmount || 0),
      roundMoneyValue(row.penalty || 0),
      roundMoneyValue(row.amountPaid || 0),
      row.datePaid && row.datePaid !== '-' ? row.datePaid : null,
      row.referenceId && row.referenceId !== '-' ? row.referenceId : null,
      roundMoneyValue(row.endingBalance || 0),
      row.status || 'Unpaid',
    ];
    const optionalValues = optionalColumns.map((column) => {
      if (column === 'interest_amount') return roundMoneyValue(row.interest || 0);
      if (column === 'principal_amount') return roundMoneyValue(row.principalAmount || 0);
      if (column === 'monthly_amortization_amount') return roundMoneyValue(row.monthlyAmortizationAmount || row.dueAmount || 0);
      if (column === 'paid_interest_amount') return roundMoneyValue(row.paidInterestAmount || 0);
      if (column === 'paid_principal_amount') return roundMoneyValue(row.paidPrincipalAmount || 0);
      if (column === 'paid_penalty_amount') return roundMoneyValue(row.paidPenaltyAmount || 0);
      return 0;
    });

    return [...baseValues, ...optionalValues];
  });

  await connection.query(
    `
      INSERT INTO lot_project_payment_schedules (
        ${columns.join(',\n        ')}
      ) VALUES ${computedRows.map(() => `(${columns.map((column) => column === 'created_at' || column === 'updated_at' ? 'NOW()' : '?').join(', ')})`).join(', ')}
    `,
    values
  );
};

const syncListingInterestToUnlockedSoa = async (connection, projectId, listingId, annualInterestRate) => {
  if (!(await tableExists(connection, 'lot_project_client_profiles'))) return { synced: 0, skipped: 0 };

  const hasOverrideColumn = await columnExists(connection, 'lot_project_client_profiles', 'soa_interest_rate_overridden');
  const hasScheduleTypeColumn = await columnExists(connection, 'lot_project_client_profiles', 'soa_interest_calculation_type');

  const [profileRows] = await connection.query(
    `
      SELECT l.*, cp.*
      FROM lot_project_listings l
      INNER JOIN lot_project_client_profiles cp
        ON cp.lot_project_listing_id = l.lot_project_listing_id
      WHERE l.lot_project_id = ?
        AND l.lot_project_listing_id = ?
    `,
    [projectId, listingId]
  );

  let synced = 0;
  let skipped = 0;

  for (const profile of profileRows) {
    if (hasOverrideColumn && Number(profile.soa_interest_rate_overridden || 0) === 1) {
      skipped += 1;
      continue;
    }

    const paymentCount = await tableExists(connection, 'lot_project_payments')
      ? (await connection.query(
          `
            SELECT COUNT(*) AS total
            FROM lot_project_payments
            WHERE lot_project_id = ?
              AND lot_project_listing_id = ?
              AND lot_project_payment_status <> 'Cancelled'
          `,
          [projectId, listingId]
        ))[0][0]?.total
      : 0;

    if (Number(paymentCount || 0) > 0) {
      skipped += 1;
      continue;
    }

    const updateColumns = [];
    const updateParams = [];
    if (await columnExists(connection, 'lot_project_client_profiles', 'soa_annual_interest_rate')) {
      updateColumns.push('soa_annual_interest_rate = ?');
      updateParams.push(annualInterestRate);
    }
    if (hasOverrideColumn) {
      updateColumns.push('soa_interest_rate_overridden = 0');
    }
    if (hasScheduleTypeColumn && !profile.soa_interest_calculation_type) {
      updateColumns.push("soa_interest_calculation_type = 'amortized'");
    }

    if (updateColumns.length) {
      await connection.query(
        `
          UPDATE lot_project_client_profiles
          SET ${updateColumns.join(', ')}
          WHERE lot_project_client_profile_id = ?
        `,
        [...updateParams, profile.lot_project_client_profile_id]
      );
    }

    await replaceListingSchedulesForProfile(connection, projectId, {
      ...profile,
      annual_interest_rate: annualInterestRate,
      soa_annual_interest_rate: annualInterestRate,
      soa_interest_rate_overridden: 0,
      soa_interest_calculation_type: profile.soa_interest_calculation_type || 'amortized',
    });

    synced += 1;
  }

  return { synced, skipped };
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

    const soaSyncResult = hasAnnualInterestRate
      ? await syncListingInterestToUnlockedSoa(connection, project.lot_project_id, existingListing.lot_project_listing_id, annualInterestRate)
      : { synced: 0, skipped: 0 };

    await connection.commit();

    return res.json({
      success: true,
      message: soaSyncResult.synced > 0
        ? `${unitCode} updated successfully. SOA interest was synced and recomputed for ${soaSyncResult.synced} buyer account(s).`
        : soaSyncResult.skipped > 0
          ? `${unitCode} updated successfully. Existing SOA was not changed because it has payments or a custom SOA rate.`
          : `${unitCode} updated successfully.`,
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
    const annualInterestRate = Number(req.body.annualInterestRate || 0);
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
    const hasAnnualInterestRate = await columnExists(connection, 'lot_project_listings', 'annual_interest_rate');

    const insertColumns = [
      'lot_project_id',
      'lot_project_listing_unit_type',
      'lot_project_listing_unit_id',
      'lot_project_listing_old_unit_ids',
      'lot_project_listing_area_sqm',
      'lot_project_listing_price_per_sqm',
      'lot_project_listing_net_selling_price',
      'lot_project_listing_lmf_rate',
      'lot_project_listing_lmf_amount',
      'lot_project_listing_tcp',
      'lot_project_listing_reservation_fee',
      'lot_project_listing_status',
      'lot_project_listing_sold_substatus',
    ];

    const insertValues = [
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
    ];

    if (hasAnnualInterestRate) {
      insertColumns.push('annual_interest_rate');
      insertValues.push(annualInterestRate);
    }

    await connection.beginTransaction();

    const [listingResult] = await connection.query(
      `
        INSERT INTO lot_project_listings (
          ${insertColumns.join(',\n          ')}
        ) VALUES (${insertColumns.map(() => '?').join(', ')})
      `,
      insertValues
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



export const deleteLotProjectListing = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });

    const lookup = getListingLookupWhere(listingLookup);

    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
        SELECT lot_project_listing_id, lot_project_listing_status
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

    const paymentCountRows = await tableExists(connection, 'lot_project_payments')
      ? (await connection.query(
          `SELECT COUNT(*) AS payment_count FROM lot_project_payments WHERE lot_project_listing_id = ?`,
          [existingListing.lot_project_listing_id]
        ))[0]
      : [{ payment_count: 0 }];

    if (Number(paymentCountRows[0]?.payment_count || 0) > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'This listing has recorded payments and cannot be deleted. Cancel the listing instead.',
      });
    }

    if (
      (await tableExists(connection, 'lot_project_commission_releases')) &&
      (await tableExists(connection, 'lot_project_commissions')) &&
      (await columnExists(connection, 'lot_project_commissions', 'lot_project_listing_id'))
    ) {
      await connection.query(
        `
          DELETE cr
          FROM lot_project_commission_releases cr
          INNER JOIN lot_project_commissions c
            ON c.lot_project_commission_id = cr.lot_project_commission_id
          WHERE c.lot_project_listing_id = ?
        `,
        [existingListing.lot_project_listing_id]
      );
    }

    const dependentTables = [
      'lot_project_client_documents',
      'lot_project_payment_schedules',
      'lot_project_listing_documents',
      'lot_project_listing_cadastral_lots',
      'lot_project_commissions',
      'lot_project_notification_logs',
      'lot_project_client_profiles',
    ];

    for (const tableName of dependentTables) {
      if (
        (await tableExists(connection, tableName)) &&
        (await columnExists(connection, tableName, 'lot_project_listing_id'))
      ) {
        await connection.query(
          `DELETE FROM ${tableName} WHERE lot_project_listing_id = ?`,
          [existingListing.lot_project_listing_id]
        );
      }
    }

    const [result] = await connection.query(
      `DELETE FROM lot_project_listings WHERE lot_project_listing_id = ? AND lot_project_id = ?`,
      [existingListing.lot_project_listing_id, project.lot_project_id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Listing not found.' });
    }

    await connection.commit();

    return res.json({ success: true, message: 'Listing deleted successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

import { db } from '../../db/connect.js';
import { fullNameSql, generateCashReference, getActorId, syncCommissionForListing, syncSoaPayment, toNumber, toNullableNumber } from '../../utils/bailenHelpers.js';

const getError = (error) => error?.message || 'Something went wrong.';

const paymentListSql = `
  SELECT bp.*, bl.unit_code, pb.project_bailen_name, cp.buyer_name,
         ${fullNameSql('encoded')} AS encoded_by_name,
         ${fullNameSql('verified')} AS verified_by_name
  FROM bailen_payments bp
  INNER JOIN bailen_listings bl ON bl.bailen_listing_id = bp.bailen_listing_id
  INNER JOIN project_bailen pb ON pb.project_bailen_id = bl.project_bailen_id
  LEFT JOIN bailen_client_profiles cp ON cp.bailen_listing_id = bl.bailen_listing_id
  LEFT JOIN users encoded ON encoded.id = bp.encoded_by_user_id
  LEFT JOIN users verified ON verified.id = bp.verified_by_user_id
`;

export const getPayments = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const params = [];
    let where = '';
    if (search) {
      where = `WHERE bl.unit_code LIKE ? OR cp.buyer_name LIKE ? OR bp.reference_id LIKE ? OR bp.payment_type LIKE ?`;
      const key = `%${search}%`;
      params.push(key, key, key, key);
    }
    const [rows] = await db.query(`${paymentListSql} ${where} ORDER BY bp.payment_date DESC, bp.payment_id DESC LIMIT 100`, params);
    const [[summary]] = await db.query('SELECT COALESCE(SUM(amount),0) AS verified_collections, COUNT(*) AS payment_count FROM bailen_payments');
    return res.json({ data: rows, summary });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};

export const searchClientUnits = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const listingId = toNullableNumber(req.query.listing_id);
    const params = [];
    const where = [];
    if (listingId) { where.push('bl.bailen_listing_id = ?'); params.push(listingId); }
    if (search) {
      const key = `%${search}%`;
      where.push('(bl.unit_code LIKE ? OR cp.buyer_name LIKE ? OR pb.project_bailen_name LIKE ? OR seller.first_name LIKE ? OR seller.last_name LIKE ?)');
      params.push(key, key, key, key, key);
    }
    const [rows] = await db.query(`
      SELECT bl.bailen_listing_id, bl.unit_code, bl.status, pb.project_bailen_name, cp.buyer_name,
             ${fullNameSql('seller')} AS seller_name
      FROM bailen_listings bl
      INNER JOIN project_bailen pb ON pb.project_bailen_id = bl.project_bailen_id
      LEFT JOIN bailen_client_profiles cp ON cp.bailen_listing_id = bl.bailen_listing_id
      LEFT JOIN users seller ON seller.id = cp.seller_user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY bl.updated_at DESC
      LIMIT 10
    `, params);

    const ids = rows.map((row) => row.bailen_listing_id);
    const soaMap = new Map();
    if (ids.length) {
      const [soaRows] = await db.query('SELECT * FROM bailen_soa_rows WHERE bailen_listing_id IN (?) ORDER BY due_date ASC', [ids]);
      for (const row of soaRows) {
        if (!soaMap.has(row.bailen_listing_id)) soaMap.set(row.bailen_listing_id, []);
        soaMap.get(row.bailen_listing_id).push(row);
      }
    }
    return res.json({ data: rows.map((row) => ({ ...row, soa_rows: soaMap.get(row.bailen_listing_id) || [] })) });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};

export const suggestAmount = async (req, res) => {
  try {
    const listingId = Number(req.query.listing_id);
    const paymentType = String(req.query.payment_type || 'monthly');
    const [[listing]] = await db.query('SELECT reservation_fee, tcp FROM bailen_listings WHERE bailen_listing_id = ? LIMIT 1', [listingId]);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    if (paymentType === 'reservation') return res.json({ suggested_amount: listing.reservation_fee, soa_row_id: null });
    if (paymentType === 'full_payment') {
      const [[paid]] = await db.query('SELECT COALESCE(SUM(amount),0) AS paid FROM bailen_payments WHERE bailen_listing_id = ?', [listingId]);
      return res.json({ suggested_amount: Math.max(toNumber(listing.tcp) - toNumber(paid.paid), 0), soa_row_id: null });
    }

    const [[row]] = await db.query(`
      SELECT soa_row_id, GREATEST(due_amount - amount_paid, 0) AS balance
      FROM bailen_soa_rows
      WHERE bailen_listing_id = ? AND status IN ('unpaid','partial')
      ORDER BY due_date ASC, soa_row_id ASC
      LIMIT 1
    `, [listingId]);
    return res.json({ suggested_amount: row?.balance || 0, soa_row_id: row?.soa_row_id || null });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};

export const addPayment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      listing_id,
      soa_row_id,
      payment_type,
      payment_method = 'cash',
      amount,
      payment_date,
      reference_id,
      remarks,
    } = req.body;

    const listingId = Number(listing_id);
    if (!listingId) return res.status(400).json({ message: 'Select a client unit first.' });
    if (!payment_type) return res.status(400).json({ message: 'Payment type is required.' });
    if (!payment_date) return res.status(400).json({ message: 'Payment date is required.' });
    if (new Date(payment_date) > new Date()) return res.status(400).json({ message: 'Future payment dates are blocked.' });
    if (toNumber(amount) <= 0) return res.status(400).json({ message: 'Amount must be greater than zero.' });

    const finalReference = payment_method === 'cash' ? await generateCashReference(listingId, payment_date) : String(reference_id || '').trim();
    if (!finalReference) return res.status(400).json({ message: 'Reference ID is required for non-cash payments.' });

    await connection.beginTransaction();
    const actorId = getActorId(req);
    const [result] = await connection.query(`
      INSERT INTO bailen_payments (
        bailen_listing_id, soa_row_id, payment_type, payment_method, amount, payment_date, reference_id, remarks,
        encoded_by_user_id, verified_by_user_id, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [listingId, toNullableNumber(soa_row_id), payment_type, payment_method, toNumber(amount), payment_date, finalReference, remarks || null, actorId, actorId]);
    await connection.commit();

    await syncSoaPayment(listingId, result.insertId, toNullableNumber(soa_row_id), toNumber(amount), payment_date, finalReference);
    await syncCommissionForListing(listingId);

    return res.status(201).json({ message: 'Payment saved and verified successfully.', payment_id: result.insertId, reference_id: finalReference });
  } catch (error) {
    await connection.rollback();
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Reference ID already exists.' });
    return res.status(500).json({ message: getError(error) });
  } finally { connection.release(); }
};

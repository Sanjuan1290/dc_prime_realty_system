import { db } from '../../../db/connect.js';
import { fullNameSql, syncCommissionForListing, toNumber } from '../../../utils/bailenHelpers.js';

const getError = (error) => error?.message || 'Something went wrong.';

export const getListingProfile = async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const [[listing]] = await db.query(`
      SELECT bl.*, pb.project_bailen_name, pb.project_bailen_location_code,
             EXISTS(SELECT 1 FROM bailen_client_profiles cp WHERE cp.bailen_listing_id = bl.bailen_listing_id) AS has_client
      FROM bailen_listings bl
      INNER JOIN project_bailen pb ON pb.project_bailen_id = bl.project_bailen_id
      WHERE bl.bailen_listing_id = ?
      LIMIT 1
    `, [listingId]);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const [[clientProfile]] = await db.query(`
      SELECT cp.*, ${fullNameSql('u')} AS seller_name, u.role AS seller_role
      FROM bailen_client_profiles cp
      LEFT JOIN users u ON u.id = cp.seller_user_id
      WHERE cp.bailen_listing_id = ?
      LIMIT 1
    `, [listingId]);

    const [documents] = await db.query(`
      SELECT ldr.*, d.document_name, d.document_description
      FROM bailen_listing_document_requirements ldr
      INNER JOIN documents d ON d.document_id = ldr.document_id
      WHERE ldr.bailen_listing_id = ?
      ORDER BY FIELD(ldr.requirement, 'required','optional'), d.document_name ASC
    `, [listingId]);

    const [soaRows] = await db.query('SELECT * FROM bailen_soa_rows WHERE bailen_listing_id = ? ORDER BY due_date ASC, soa_row_id ASC', [listingId]);
    const [payments] = await db.query('SELECT * FROM bailen_payments WHERE bailen_listing_id = ? ORDER BY payment_date DESC, payment_id DESC', [listingId]);

    return res.json({ listing, client_profile: clientProfile || null, documents, soa_rows: soaRows, payments });
  } catch (error) {
    return res.status(500).json({ message: getError(error) });
  }
};

export const updateUnitStatus = async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const {
      unit_code,
      lot_area_sqm,
      price_per_sqm,
      legal_misc_rate,
      net_selling_price,
      lmf_amount,
      tcp,
      reservation_fee,
      annual_interest_rate,
      status,
      description,
    } = req.body;

    if (!unit_code?.trim()) return res.status(400).json({ message: 'Unit code is required.' });

    await db.query(`
      UPDATE bailen_listings
      SET unit_code = ?, lot_area_sqm = ?, price_per_sqm = ?, legal_misc_rate = ?,
          net_selling_price = ?, lmf_amount = ?, tcp = ?, reservation_fee = ?, annual_interest_rate = ?, status = ?, description = ?
      WHERE bailen_listing_id = ?
    `, [
      unit_code.trim().toUpperCase(),
      toNumber(lot_area_sqm),
      toNumber(price_per_sqm),
      toNumber(legal_misc_rate, 10),
      toNumber(net_selling_price),
      toNumber(lmf_amount),
      toNumber(tcp),
      toNumber(reservation_fee, 50000),
      toNumber(annual_interest_rate),
      status,
      description || null,
      listingId,
    ]);

    await syncCommissionForListing(listingId);
    return res.json({ message: 'Unit details saved successfully.' });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Unit code already exists.' });
    return res.status(500).json({ message: getError(error) });
  }
};

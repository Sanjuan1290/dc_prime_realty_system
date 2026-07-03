import { db } from '../../../db/connect.js';
import { toNumber } from '../../../utils/bailenHelpers.js';
const getError = (error) => error?.message || 'Something went wrong.';

export const generateSOA = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const listingId = Number(req.params.id);
    const { first_due_date, terms_months = 12, downpayment_amount = 0 } = req.body;
    const [[listing]] = await connection.query('SELECT * FROM bailen_listings WHERE bailen_listing_id = ? LIMIT 1', [listingId]);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (!first_due_date) return res.status(400).json({ message: 'First due date is required.' });

    await connection.beginTransaction();
    await connection.query('DELETE FROM bailen_soa_rows WHERE bailen_listing_id = ?', [listingId]);
    const balance = toNumber(listing.tcp);
    await connection.query(`INSERT INTO bailen_soa_rows (bailen_listing_id, due_date, description, payment_type, beginning_balance, due_amount, principal, ending_balance) VALUES (?, ?, 'Reservation Fee', 'reservation', ?, ?, ?, ?)`, [listingId, first_due_date, balance, listing.reservation_fee, listing.reservation_fee, Math.max(balance - listing.reservation_fee, 0)]);
    const monthly = (balance - toNumber(listing.reservation_fee) - toNumber(downpayment_amount)) / Number(terms_months || 1);
    for (let i = 1; i <= Number(terms_months); i++) {
      const due = new Date(first_due_date); due.setMonth(due.getMonth() + i);
      await connection.query(`INSERT INTO bailen_soa_rows (bailen_listing_id, due_date, description, payment_type, beginning_balance, due_amount, principal, ending_balance) VALUES (?, ?, ?, 'monthly', ?, ?, ?, ?)`, [listingId, due.toISOString().slice(0,10), `${i} Monthly Amortization`, balance, monthly, monthly, Math.max(balance - monthly * i, 0)]);
    }
    await connection.commit();
    return res.json({ message: 'SOA generated successfully.' });
  } catch (error) { await connection.rollback(); return res.status(500).json({ message: getError(error) }); }
  finally { connection.release(); }
};

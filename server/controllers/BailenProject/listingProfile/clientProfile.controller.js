import { db } from '../../../db/connect.js';
import { fullNameSql, syncCommissionForListing, toNullableNumber } from '../../../utils/bailenHelpers.js';
const getError = (error) => error?.message || 'Something went wrong.';

export const getSellerOptions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id AS user_id, ${fullNameSql('u')} AS full_name, u.role, a.seller_group_id
      FROM users u
      INNER JOIN accredited_sellers a ON a.user_id = u.id
      WHERE u.status = 'active' AND a.accredited_seller_status = 'active'
      ORDER BY FIELD(u.role, 'broker_network_manager','broker','manager','agent'), full_name ASC
    `);
    return res.json({ data: rows });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};

export const upsertClientProfile = async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const {
      buyer_type = 'single', buyer_name, contact_no, email, address, occupation, employer_business_name, seller_user_id,
      second_buyer_name, second_buyer_contact_no, second_buyer_email, second_buyer_occupation, second_buyer_employer_business_name,
      profile_status = 'complete',
    } = req.body;

    if (!buyer_name?.trim()) return res.status(400).json({ message: 'Buyer name is required.' });

    await db.query(`
      INSERT INTO bailen_client_profiles (
        bailen_listing_id, buyer_type, buyer_name, contact_no, email, address, occupation, employer_business_name, seller_user_id,
        second_buyer_name, second_buyer_contact_no, second_buyer_email, second_buyer_occupation, second_buyer_employer_business_name, profile_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        buyer_type = VALUES(buyer_type), buyer_name = VALUES(buyer_name), contact_no = VALUES(contact_no), email = VALUES(email), address = VALUES(address),
        occupation = VALUES(occupation), employer_business_name = VALUES(employer_business_name), seller_user_id = VALUES(seller_user_id),
        second_buyer_name = VALUES(second_buyer_name), second_buyer_contact_no = VALUES(second_buyer_contact_no), second_buyer_email = VALUES(second_buyer_email),
        second_buyer_occupation = VALUES(second_buyer_occupation), second_buyer_employer_business_name = VALUES(second_buyer_employer_business_name), profile_status = VALUES(profile_status)
    `, [
      listingId, buyer_type, buyer_name.trim(), contact_no || null, email || null, address || null, occupation || null, employer_business_name || null, toNullableNumber(seller_user_id),
      second_buyer_name || null, second_buyer_contact_no || null, second_buyer_email || null, second_buyer_occupation || null, second_buyer_employer_business_name || null, profile_status,
    ]);

    await db.query('UPDATE bailen_listings SET buyer_profile_status = ?, status = CASE WHEN status IN ("available","hold") THEN "sold" ELSE status END WHERE bailen_listing_id = ?', [profile_status, listingId]);
    await syncCommissionForListing(listingId);
    return res.json({ message: 'Client profile saved successfully.' });
  } catch (error) { return res.status(500).json({ message: getError(error) }); }
};

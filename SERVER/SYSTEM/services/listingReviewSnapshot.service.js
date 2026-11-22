import {storedListingReviewFinancials} from './listingReviewValues.service.js';

// Read the saved record and relationships in the caller's transaction. Never
// backfill historical snapshots from today's listing.
export const captureListingReviewSnapshot = async (connection,listingId,{accountId=null}={}) => {
 const [[row]]=await connection.query('SELECT * FROM lot_project_listings WHERE lot_project_listing_id=? FOR UPDATE',[listingId]);
 if(!row)throw Object.assign(new Error('Listing snapshot is unavailable.'),{statusCode:409});
 const [lots]=await connection.query(`SELECT c.lot_project_cadastral_lot_number AS lotNumber FROM lot_project_listing_cadastral_lots rel
  INNER JOIN lot_project_cadastral_lot_numbers c ON c.lot_project_cadastral_lot_number_id=rel.lot_project_cadastral_lot_number_id
  WHERE rel.lot_project_listing_id=? ORDER BY c.lot_project_cadastral_lot_number`,[listingId]);
 const [documents]=await connection.query(`SELECT document_id AS documentId,lot_project_listing_document_is_required AS isRequired,
  lot_project_listing_document_responsible_party AS responsibleParty,lot_project_listing_document_status AS status
  FROM lot_project_listing_documents WHERE lot_project_listing_id=? ORDER BY document_id`,[listingId]);
 const selectedAccountId=accountId||row.current_account_id;
 const [[account]]=selectedAccountId?await connection.query(`SELECT account_reference,account_status,refund_amount,cancellation_reason
  FROM lot_project_accounts WHERE lot_project_account_id=? AND lot_project_listing_id=?`,[selectedAccountId,listingId]):[[]];
 return {listingId:Number(row.lot_project_listing_id),unitCode:row.lot_project_listing_unit_id,oldUnitIds:row.lot_project_listing_old_unit_ids,
  status:row.lot_project_listing_status,soldSubstatus:row.lot_project_listing_sold_substatus,lotType:row.lot_project_listing_unit_type,
  cancellationType:row.lot_project_listing_cancellation_type??null,holdClientName:row.hold_client_name??null,holdNote:row.hold_note??null,
  accountReference:account?.account_reference??null,accountStatus:account?.account_status??null,
  refundAmount:account?.refund_amount==null?null:Number(account.refund_amount),cancellationReason:account?.cancellation_reason??null,
  lotAreaSqm:Number(row.lot_project_listing_area_sqm),...storedListingReviewFinancials(row),
  cadastralLots:lots.map(lot=>lot.lotNumber),documentRequirements:documents.map(document=>({...document,documentId:Number(document.documentId),isRequired:Number(document.isRequired)}))};
};

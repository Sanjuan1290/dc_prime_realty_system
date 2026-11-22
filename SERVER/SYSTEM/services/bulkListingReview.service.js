import {createOperationalReview,appendReviewEvent,canActorSeeReview} from './operationalReview.service.js';
import {notifyCorrectionOwners} from './auditCaseWorkflow.service.js';
import {writeAuditLog} from '../controllers/System/auditLogs.controller.js';
import {BULK_FIELDS} from '../controllers/Lot_Projects/Listings/listingBulkFields.js';

export const parseBulkSnapshot=value=>typeof value==='string'?JSON.parse(value):value;
const fail=(message,statusCode=409)=>Object.assign(new Error(message),{statusCode});
export const createBulkListingReview = async (connection,{actor,project,batchId,reason,changedCount,changedFieldCount,headPreApprovedByUserId=null}) => {
 const review=await createOperationalReview(connection,{actor,actionKey:'listing.bulk_edit',department:'operations',projectId:project.lot_project_id,
  entityType:'lot_project_listing_bulk_batch',entityId:batchId,entityLabel:`Bulk Listing Edit · ${project.lot_project_name} · Batch ${batchId}`,
  beforeSnapshot:null,afterSnapshot:{batchId,reason,affectedRecords:changedCount,changedFields:changedFieldCount},headPreApprovedByUserId});
 await connection.query('UPDATE lot_project_listing_bulk_batches SET operational_review_id=?,changed_field_count=? WHERE batch_id=?',[review.reviewId,changedFieldCount,batchId]);
 return review;
};
export const loadBulkReview = async (connection,actor,reviewId,{forUpdate=false}={}) => {
 const [[review]]=await connection.query(`SELECT r.*,b.batch_id,b.adjustment_reason,b.changed_count,b.changed_field_count,p.lot_project_name
  FROM operational_reviews r INNER JOIN lot_project_listing_bulk_batches b ON b.operational_review_id=r.operational_review_id
  INNER JOIN lot_projects p ON p.lot_project_id=b.lot_project_id
  WHERE r.operational_review_id=? AND r.entity_type='lot_project_listing_bulk_batch'${forUpdate?' FOR UPDATE':''}`,[Number(reviewId)]);
 if(!review)throw fail('Bulk review not found.',404);
 if(!await canActorSeeReview(connection,actor,review))throw fail('This batch is outside your review scope.',403);
 return review;
};
export const bulkReviewSummary=async(connection,batchId)=>{
 const [[summary]]=await connection.query(`SELECT COUNT(*) AS affectedRecords,SUM(review_status='pending') AS pendingRecords,
  SUM(review_status='no_issue') AS noIssueRecords,SUM(audit_case_id IS NOT NULL) AS issueRecords,
  SUM(review_status='awaiting_verification') AS awaitingVerification FROM lot_project_listing_bulk_rows WHERE batch_id=?`,[batchId]);
 return Object.fromEntries(Object.entries(summary).map(([key,value])=>[key,Number(value||0)]));
};
export const assertBulkReviewComplete = async (connection,review) => {
 const [[batch]]=await connection.query('SELECT batch_id FROM lot_project_listing_bulk_batches WHERE operational_review_id=?',[review.operational_review_id]);
 if(!batch)throw fail('Bulk review relationship is missing.');
 const summary=await bulkReviewSummary(connection,batch.batch_id);
 if(!summary.affectedRecords||summary.pendingRecords)throw fail('Review every affected listing before completing this batch.');
 return summary;
};
export const listBulkReviewRows = async (connection,actor,reviewId,query={}) => {
 const review=await loadBulkReview(connection,actor,reviewId),page=Math.max(1,Number(query.page)||1),limit=Math.min(100,Math.max(1,Number(query.limit)||25));
 const params=[review.batch_id];let where='br.batch_id=?';
 const search=String(query.search||'').trim().slice(0,200),field=String(query.field||''),status=String(query.status||'');
 if(search){where+=" AND (JSON_UNQUOTE(JSON_EXTRACT(br.after_snapshot_json,'$.unitCode')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(br.before_snapshot_json,'$.unitCode')) LIKE ?)";params.push('%'+search+'%','%'+search+'%')}
 if(field){if(!BULK_FIELDS.includes(field))throw fail('Select a valid changed field.',400);where+=" AND JSON_CONTAINS_PATH(br.changed_fields_json,'one',?)";params.push('$.'+field)}
 if(status){if(!['pending','no_issue','issue_reported','correction_required','awaiting_verification','verified_closed'].includes(status))throw fail('Invalid review result.',400);where+=' AND br.review_status=?';params.push(status)}
 const [[count]]=await connection.query(`SELECT COUNT(*) AS total FROM lot_project_listing_bulk_rows br WHERE ${where}`,params);
 const sort={unit:"JSON_UNQUOTE(JSON_EXTRACT(br.after_snapshot_json,'$.unitCode'))",status:'br.review_status',fields:'JSON_LENGTH(br.changed_fields_json)'}[query.sort]||'br.row_id';
 const direction=query.direction==='desc'?'DESC':'ASC',total=Number(count.total),totalPages=Math.max(1,Math.ceil(total/limit)),resolvedPage=Math.min(page,totalPages);
 const [rows]=await connection.query(`SELECT br.row_id,br.lot_project_listing_id,br.review_status,br.audit_case_id,br.operational_review_id,
  JSON_UNQUOTE(JSON_EXTRACT(br.after_snapshot_json,'$.unitCode')) AS unitCode,JSON_KEYS(br.changed_fields_json) AS changedFields,
  br.reviewed_at,br.review_note FROM lot_project_listing_bulk_rows br WHERE ${where} ORDER BY ${sort} ${direction},br.row_id ASC LIMIT ? OFFSET ?`,[...params,limit,(resolvedPage-1)*limit]);
 return {batch:{id:review.batch_id,reviewId:Number(review.operational_review_id),project:review.lot_project_name,reason:review.adjustment_reason,changedFieldCount:review.changed_field_count,status:review.status},
  summary:await bulkReviewSummary(connection,review.batch_id),data:rows.map(row=>({...row,changedFields:parseBulkSnapshot(row.changedFields)||[],project:review.lot_project_name})),
  pagination:{page:resolvedPage,limit,total,totalPages,hasNext:resolvedPage<totalPages,hasPrev:resolvedPage>1}};
};
export const getBulkReviewRow = async(connection,actor,reviewId,rowId)=>{
 const review=await loadBulkReview(connection,actor,reviewId);
 const [[row]]=await connection.query('SELECT * FROM lot_project_listing_bulk_rows WHERE batch_id=? AND row_id=?',[review.batch_id,Number(rowId)]);
 if(!row)throw fail('Affected listing not found.',404);
 return {...row,before:parseBulkSnapshot(row.before_snapshot_json),after:parseBulkSnapshot(row.after_snapshot_json),changedFields:parseBulkSnapshot(row.changed_fields_json),project:review.lot_project_name};
};
export const decideBulkReviewRows=async(connection,req,reviewId,body)=>{
 if(req.authUser?.role!=='auditor')throw fail('Only an Auditor may record batch review results.',403);
 const review=await loadBulkReview(connection,req.authUser,reviewId,{forUpdate:true});
 if(review.status!=='pending_auditor_review')throw fail('This batch is not awaiting Auditor review.');
 if(Number(review.initiated_by_user_id)===Number(req.authUser.id))throw fail('An independent Auditor must review this operation.',403);
 const ids=body.rowIds,decision=body.decision;
 if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>!Number.isSafeInteger(Number(id))||Number(id)<1)||new Set(ids.map(Number)).size!==ids.length)throw fail('Select 1–100 distinct affected listings.',400);
 if(!['no_issue','report_issue'].includes(decision)||decision==='report_issue'&&ids.length!==1)throw fail('Report each issue against one affected listing.',400);
 const [rows]=await connection.query(`SELECT * FROM lot_project_listing_bulk_rows WHERE batch_id=? AND row_id IN (${ids.map(()=>'?').join(',')}) ORDER BY row_id FOR UPDATE`,[review.batch_id,...ids]);
 if(rows.length!==ids.length||rows.some(row=>row.review_status!=='pending'))throw fail('A selected listing was already reviewed or belongs to another batch.');
 const note=String(body.note||'').trim();let assignee=0;
 if(decision==='report_issue'){
  if(note.length<5||note.length>5000)throw fail('Describe the issue (5–5,000 characters).',400);
  const [admins]=await connection.query("SELECT id FROM users WHERE role IN ('system_admin','super_admin') AND status='active' AND COALESCE(can_login,1)=1 ORDER BY CASE WHEN role='system_admin' THEN 0 ELSE 1 END,id");
  assignee=Number(body.assigneeId||admins[0]?.id||0);if(!admins.some(user=>Number(user.id)===assignee))throw fail('Select an active correction administrator.',400);
 }
 for(const row of rows){
  let childId=null,caseId=null;
  if(decision==='report_issue'){
   const before=parseBulkSnapshot(row.before_snapshot_json),after=parseBulkSnapshot(row.after_snapshot_json);
   // A correction child exists only for an issue. Its business author is the
   // original batch submitter, and its immutable evidence is the batch row.
   const [created]=await connection.query(`INSERT INTO operational_reviews(action_key,department,lot_project_id,entity_type,entity_id,entity_label,
    initiated_by_user_id,initiated_by_role,before_snapshot_json,after_snapshot_json,status,approval_type)
    VALUES('listing.edit','operations',?,'lot_project_listing',?,?,?,?,?,?,'correction_required',?)`,
   [review.lot_project_id,String(row.lot_project_listing_id),after.unitCode,review.initiated_by_user_id,review.initiated_by_role,JSON.stringify(before),JSON.stringify(after),review.approval_type||'staff_entry']);
   childId=Number(created.insertId);const number='REV-'+String(childId).padStart(8,'0');await connection.query('UPDATE operational_reviews SET review_number=? WHERE operational_review_id=?',[number,childId]);
   const [createdCase]=await connection.query("INSERT INTO audit_cases(operational_review_id,opened_by_auditor_user_id,assigned_responder_user_id,finding,status) VALUES(?,?,?,?,'pending_system_admin_correction')",[childId,req.authUser.id,assignee,note]);
   caseId=Number(createdCase.insertId);const caseNumber='CASE-'+String(caseId).padStart(8,'0');await connection.query('UPDATE audit_cases SET case_number=? WHERE audit_case_id=?',[caseNumber,caseId]);
   await appendReviewEvent(connection,{reviewId:childId,eventType:'bulk_item_issue_reported',actor:req.authUser,toStatus:'correction_required',message:note,metadata:{parentReviewId:review.operational_review_id,batchId:review.batch_id,rowId:row.row_id,auditCaseId:caseId,caseNumber}});
   await notifyCorrectionOwners(connection,{...review,operational_review_id:childId},{audit_case_id:caseId,case_number:caseNumber,finding:note,assigned_responder_user_id:assignee});
  }
  const status=decision==='no_issue'?'no_issue':'issue_reported';
  await connection.query('UPDATE lot_project_listing_bulk_rows SET review_status=?,reviewed_by_user_id=?,reviewed_at=NOW(),review_note=?,operational_review_id=?,audit_case_id=? WHERE row_id=?',[status,req.authUser.id,note||'No issue found.',childId,caseId,row.row_id]);
  await appendReviewEvent(connection,{reviewId:review.operational_review_id,eventType:'bulk_item_reviewed',actor:req.authUser,message:note||'No issue found.',metadata:{batchId:review.batch_id,rowId:row.row_id,listingId:row.lot_project_listing_id,result:status,childReviewId:childId,auditCaseId:caseId}});
  await writeAuditLog(connection,req,{action:decision==='no_issue'?'approve':'create',module:'Review Center',entityType:'lot_project_listing_bulk_row',entityId:String(row.row_id),title:decision==='no_issue'?'No issue found':'Audit issue reported',metadata:{reviewId:review.operational_review_id,batchId:review.batch_id,listingId:row.lot_project_listing_id,childReviewId:childId,auditCaseId:caseId,result:status,note}});
 }
 return bulkReviewSummary(connection,review.batch_id);
};

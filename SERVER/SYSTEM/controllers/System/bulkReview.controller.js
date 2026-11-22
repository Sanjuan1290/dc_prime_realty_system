import {db} from '../../db/connect.js';
import {DEPARTMENT_HEAD_ROLE} from '../../config/permissions.js';
import {listBulkReviewRows,getBulkReviewRow,decideBulkReviewRows,parseBulkSnapshot} from '../../services/bulkListingReview.service.js';

const handle=(action,{transaction=false}={})=>async(req,res)=>{
 const connection=await db.getConnection();
 try{if(transaction)await connection.beginTransaction();const data=await action(connection,req);if(transaction)await connection.commit();return res.json({success:true,...data})}
 catch(error){if(transaction)try{await connection.rollback()}catch{}return res.status(error.statusCode||500).json({message:error.statusCode?error.message:'Unable to process the batch review.'})}finally{connection.release()}
};
export const getBulkReviewRows=handle((connection,req)=>listBulkReviewRows(connection,req.authUser,req.params.id,req.query));
export const getBulkReviewRowDetails=handle(async(connection,req)=>({data:await getBulkReviewRow(connection,req.authUser,req.params.id,req.params.rowId)}));
export const reviewBulkRows=handle(async(connection,req)=>({data:await decideBulkReviewRows(connection,req,req.params.id,req.body),message:'Review results saved.'}),{transaction:true});
export const getBulkApprovalRows=handle(async(connection,req)=>{
 const [[request]]=await connection.query('SELECT * FROM protected_change_requests WHERE protected_change_request_id=?',[Number(req.params.requestId)]);
 if(!request)throw Object.assign(new Error('Approval request not found.'),{statusCode:404});
 const actor=req.authUser,head=actor.role===DEPARTMENT_HEAD_ROLE[request.department];
 if(!head&&Number(request.requested_by_user_id)!==Number(actor.id)&&!['system_admin','super_admin'].includes(actor.role))throw Object.assign(new Error('This approval is outside your scope.'),{statusCode:403});
 if(head&&request.lot_project_id&&!Number(actor.all_projects_access||actor.admin_all_projects||0)){
  const [scope]=await connection.query('SELECT 1 FROM user_project_access WHERE user_id=? AND lot_project_id=? LIMIT 1',[actor.id,request.lot_project_id]);if(!scope.length)throw Object.assign(new Error('This approval is outside your project scope.'),{statusCode:403});
 }
 if(request.entity_type!=='lot_project_listing_bulk_batch')throw Object.assign(new Error('This request is not a bulk approval.'),{statusCode:400});
 const payload=parseBulkSnapshot(request.request_payload_json),limit=Math.min(100,Math.max(1,Number(req.query.limit)||25)),search=String(req.query.search||'').toLowerCase();
 const all=Array.isArray(payload?.rows)?payload.rows:[],filtered=all.filter(row=>!search||String(row.after?.unitCode||row.before?.unitCode||'').toLowerCase().includes(search));
 const totalPages=Math.max(1,Math.ceil(filtered.length/limit)),page=Math.min(totalPages,Math.max(1,Number(req.query.page)||1));
 return {data:filtered.slice((page-1)*limit,page*limit),request:{id:request.protected_change_request_id,number:request.request_number,status:request.status,reason:request.reason},pagination:{page,limit,total:filtered.length,totalPages,hasNext:page<totalPages,hasPrev:page>1}};
});

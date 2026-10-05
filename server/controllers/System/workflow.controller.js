import { db } from '../../db/connect.js';
import { DEPARTMENT_HEAD_ROLE, getRoleDepartment } from '../../config/permissions.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { createInternalNotifications, notifyAuditors, notifySystemAdmins } from '../../services/internalNotification.service.js';
import { appendReviewEvent, canActorSeeReview, getOperationalReviewForUpdate } from '../../services/operationalReview.service.js';
import { approveProtectedChange } from '../../services/protectedChange.service.js';
import { resolveAuditCaseResponders, RESPONDER_MODE_LABELS } from '../../services/auditCaseResponder.service.js';
import { getAuditCorrectionRole } from '../../services/auditCaseAuthorization.service.js';

const errorMessage = (error) => error?.message || 'Workflow operation failed.';
const pageValues = (query = {}) => ({ page: Math.max(Number(query.page || 1),1), limit: Math.min(Math.max(Number(query.limit || 25),1),100) });

const accessibleReviewWhere = (actor, { alias = 'r' } = {}) => {
  if (['super_admin','system_admin','auditor'].includes(actor?.role)) return { sql: '1=1', params: [] };
  const department = getRoleDepartment(actor);
  if (!department) return { sql: '1=0', params: [] };
  const actorId = Number(actor?.id || 0);
  const isHead = DEPARTMENT_HEAD_ROLE[department] === actor?.role;
  if (!isHead) {
    return {
      sql: `${alias}.department = ? AND ${alias}.initiated_by_user_id = ?`,
      params: [department, actorId],
    };
  }
  return {
    sql: `${alias}.department = ? AND (${alias}.lot_project_id IS NULL OR COALESCE(?,0)=1 OR EXISTS (SELECT 1 FROM user_project_access wupa WHERE wupa.user_id=? AND wupa.lot_project_id=${alias}.lot_project_id))`,
    params: [department, Number(actor?.all_projects_access || actor?.admin_all_projects || 0), actorId],
  };
};

export const listOperationalReviews = async (req, res) => {
  try {
    const { page, limit } = pageValues(req.query);
    const offset = (page - 1) * limit;
    const access = accessibleReviewWhere(req.authUser);
    const statuses = String(req.query.status || '').trim().split(',').map((v) => v.trim()).filter(Boolean);
    const params = [...access.params];
    let statusSql = '';
    if (statuses.length) { statusSql = ` AND r.status IN (${statuses.map(() => '?').join(',')})`; params.push(...statuses); }
    const [countRows] = await db.query(`SELECT COUNT(*) total FROM operational_reviews r WHERE ${access.sql}${statusSql}`, params);
    const [rows] = await db.query(
      `SELECT r.*, p.lot_project_name,
              TRIM(CONCAT_WS(' ', initiator.first_name,initiator.middle_name,initiator.last_name)) initiated_by_name,
              TRIM(CONCAT_WS(' ', claimant.first_name,claimant.middle_name,claimant.last_name)) claimed_by_name,
              TRIM(CONCAT_WS(' ', head.first_name,head.middle_name,head.last_name)) head_reviewed_by_name,
              TRIM(CONCAT_WS(' ', auditor.first_name,auditor.middle_name,auditor.last_name)) auditor_reviewed_by_name
       FROM operational_reviews r
       LEFT JOIN lot_projects p ON p.lot_project_id=r.lot_project_id
       LEFT JOIN users initiator ON initiator.id=r.initiated_by_user_id
       LEFT JOIN users claimant ON claimant.id=r.claimed_by_user_id
       LEFT JOIN users head ON head.id=r.head_reviewed_by_user_id
       LEFT JOIN users auditor ON auditor.id=r.auditor_reviewed_by_user_id
       WHERE ${access.sql}${statusSql}
       ORDER BY r.updated_at DESC,r.operational_review_id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return res.json({ data: rows, pagination: { page, limit, total: Number(countRows[0]?.total || 0), totalPages: Math.max(1,Math.ceil(Number(countRows[0]?.total || 0)/limit)) } });
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }); }
};

export const getReviewCenterSummary = async (req, res) => {
  try {
    const access = accessibleReviewWhere(req.authUser);
    const [rows] = await db.query(
      `SELECT status,COUNT(*) total FROM operational_reviews r WHERE ${access.sql} GROUP BY status`, access.params
    );
    const counts = Object.fromEntries(rows.map((row) => [row.status, Number(row.total || 0)]));
    const actor = req.authUser || {};
    let actionable = 0;
    if (actor.role === 'auditor') actionable = Number(counts.pending_auditor_review || 0) + Number(counts.pending_auditor_recheck || 0);
    else if (actor.role === 'system_admin') actionable = Number(counts.correction_required || 0);
    else {
      const department = getRoleDepartment(actor);
      const isHead = department && DEPARTMENT_HEAD_ROLE[department] === actor.role;
      actionable = isHead ? Number(counts.pending_head_review || 0) + Number(counts.audit_case_open || 0) : Number(counts.returned_for_correction || 0);
    }

    let protectedSql = 'p.requested_by_user_id = ? AND p.status IN (\'pending\',\'approved\')';
    let protectedParams = [actor.id];
    const actorDepartment = getRoleDepartment(actor);
    if (actorDepartment && DEPARTMENT_HEAD_ROLE[actorDepartment] === actor.role) {
      protectedSql = `p.department = ? AND p.status = 'pending' AND (p.lot_project_id IS NULL OR COALESCE(?,0)=1 OR EXISTS(SELECT 1 FROM user_project_access upa WHERE upa.user_id=? AND upa.lot_project_id=p.lot_project_id))`;
      protectedParams = [actorDepartment, Number(actor.all_projects_access || actor.admin_all_projects || 0), actor.id];
    } else if (['super_admin','system_admin','auditor'].includes(actor.role)) {
      protectedSql = `p.status = 'pending'`;
      protectedParams = [];
    }
    const [protectedRows] = await db.query(`SELECT COUNT(*) total FROM protected_change_requests p WHERE ${protectedSql}`, protectedParams).catch(() => [[{ total: 0 }]]);
    const pendingProtectedChanges = Number(protectedRows?.[0]?.total || 0);

    const [notificationRows] = await db.query('SELECT COUNT(*) unread FROM internal_notifications WHERE user_id=? AND read_at IS NULL', [actor.id]);
    const unreadNotifications = Number(notificationRows[0]?.unread || 0);
    return res.json({ data: { counts, actionable, pendingProtectedChanges, unreadNotifications, badgeCount: actionable + pendingProtectedChanges + unreadNotifications } });
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }); }
};

export const getOperationalReview = async (req, res) => {
  try {
    const reviewId = Number(req.params.id || 0);
    const [rows] = await db.query(`
      SELECT r.*, p.lot_project_name, p.lot_project_slug,
             TRIM(CONCAT_WS(' ', initiator.first_name,initiator.middle_name,initiator.last_name)) initiated_by_name,
             TRIM(CONCAT_WS(' ', head.first_name,head.middle_name,head.last_name)) head_reviewed_by_name,
             TRIM(CONCAT_WS(' ', auditor.first_name,auditor.middle_name,auditor.last_name)) auditor_reviewed_by_name
      FROM operational_reviews r
      LEFT JOIN lot_projects p ON p.lot_project_id=r.lot_project_id
      LEFT JOIN users initiator ON initiator.id=r.initiated_by_user_id
      LEFT JOIN users head ON head.id=r.head_reviewed_by_user_id
      LEFT JOIN users auditor ON auditor.id=r.auditor_reviewed_by_user_id
      WHERE r.operational_review_id=? LIMIT 1`, [reviewId]);
    const review = rows[0];
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    if (!(await canActorSeeReview(db, req.authUser, review))) return res.status(403).json({ message: 'You cannot view this review.' });
    const [events] = await db.query(
      `SELECT e.*,TRIM(CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name)) actor_name FROM operational_review_events e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.operational_review_id=? ORDER BY e.operational_review_event_id`, [reviewId]
    );
    const [caseRows] = await db.query(
      `SELECT * FROM audit_cases WHERE operational_review_id=? ORDER BY audit_case_id DESC LIMIT 1`, [reviewId]
    ).catch(() => [[]]);
    let auditCase = caseRows?.[0] || null;
    if (auditCase) {
      auditCase = { ...auditCase, correctionRole: getAuditCorrectionRole(review) };
    }
    if (auditCase && auditCase.status === 'awaiting_head_response') {
      const responders = await resolveAuditCaseResponders(db, { ...review, ...auditCase });
      const [responderRows] = responders.userIds.length
        ? await db.query(`SELECT id, role, TRIM(CONCAT_WS(' ', first_name, middle_name, last_name)) full_name FROM users WHERE id IN (${responders.userIds.map(() => '?').join(',')})`, responders.userIds)
        : [[]];
      let headOptions = [];
      if (['system_admin', 'super_admin'].includes(req.authUser?.role)) {
        const [optionRows] = await db.query(
          `SELECT u.id, TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) full_name FROM users u
           WHERE u.role = ? AND u.status = 'active'
             AND (COALESCE(u.all_projects_access, u.admin_all_projects, 0) = 1 OR ? IS NULL
               OR EXISTS (SELECT 1 FROM user_project_access upa WHERE upa.user_id = u.id AND upa.lot_project_id = ?))
           ORDER BY full_name`,
          [DEPARTMENT_HEAD_ROLE[review.department] || '', review.lot_project_id || null, review.lot_project_id || null]
        );
        headOptions = optionRows;
      }
      auditCase = {
        ...auditCase,
        responders: {
          mode: responders.mode,
          label: RESPONDER_MODE_LABELS[responders.mode] || responders.mode,
          users: responderRows,
          canRespond: responders.userIds.includes(Number(req.authUser?.id || 0)),
        },
        headOptions,
      };
    }
    return res.json({ data: { ...review, events, auditCase } });
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }); }
};

const assertHeadForReview = async (connection, actor, review) => {
  const expected = DEPARTMENT_HEAD_ROLE[review.department];
  if (actor?.role !== expected) throw Object.assign(new Error(`Only the ${review.department} Head can perform this department review.`), { statusCode: 403 });
  if (!(await canActorSeeReview(connection, actor, review))) throw Object.assign(new Error('This review is outside your project scope.'), { statusCode: 403 });
};

export const claimOperationalReview = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const review = await getOperationalReviewForUpdate(connection, req.params.id);
    if (!review) throw Object.assign(new Error('Review not found.'), { statusCode: 404 });
    await assertHeadForReview(connection, req.authUser, review);
    if (review.status !== 'pending_head_review') throw Object.assign(new Error('Only pending Head reviews can be claimed.'), { statusCode: 409 });
    if (review.claimed_by_user_id && Number(review.claimed_by_user_id) !== Number(req.authUser.id)) throw Object.assign(new Error('Another Head already claimed this review.'), { statusCode: 409 });
    await connection.query('UPDATE operational_reviews SET claimed_by_user_id=?,claimed_at=COALESCE(claimed_at,NOW()) WHERE operational_review_id=?', [req.authUser.id, review.operational_review_id]);
    await appendReviewEvent(connection, { reviewId: review.operational_review_id, eventType: 'head_claimed', actor: req.authUser, fromStatus: review.status, toStatus: review.status });
    await connection.commit();
    return res.json({ message: 'Review claimed.' });
  } catch (error) { try { await connection.rollback(); } catch {} return res.status(error.statusCode || 500).json({ code: error.code, message: errorMessage(error) }); } finally { connection.release(); }
};

export const confirmHeadReview = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const review = await getOperationalReviewForUpdate(connection, req.params.id);
    if (!review) throw Object.assign(new Error('Review not found.'), { statusCode: 404 });
    await assertHeadForReview(connection, req.authUser, review);
    if (review.claimed_by_user_id && Number(review.claimed_by_user_id) !== Number(req.authUser.id)) {
      throw Object.assign(new Error('Another Head already claimed this review.'), { statusCode: 409 });
    }
    if (review.status !== 'pending_head_review') throw Object.assign(new Error('This review is no longer pending Head confirmation.'), { statusCode: 409 });
    const withApprovalType = Object.prototype.hasOwnProperty.call(review, 'approval_type');
    await connection.query(`UPDATE operational_reviews SET status='pending_auditor_review',claimed_by_user_id=COALESCE(claimed_by_user_id,?),claimed_at=COALESCE(claimed_at,NOW()),head_reviewed_by_user_id=?,head_reviewed_at=NOW()${withApprovalType ? ",approval_type='head_confirmed'" : ''} WHERE operational_review_id=?`, [req.authUser.id,req.authUser.id,review.operational_review_id]);
    await appendReviewEvent(connection, { reviewId: review.operational_review_id, eventType: 'head_confirmed', actor: req.authUser, fromStatus: review.status, toStatus: 'pending_auditor_review', message: String(req.body?.note || 'Head confirmed no mistake.').slice(0,1000) });
    await notifyAuditors(connection, { reviewId: review.operational_review_id, title: `Audit review required · ${review.entity_label || review.entity_type}`, message: `${review.review_number} was confirmed by the ${review.department} Head.` });
    await writeAuditLog(connection, req, { action:'approve',module:'Review Center',entityType:'operational_review',entityId:String(review.operational_review_id),entityLabel:review.review_number,title:'Department Head confirmed review',description:`${review.review_number} moved to Auditor review.`,metadata:{department:review.department,action_key:review.action_key} });
    await connection.commit();
    return res.json({ message: 'Confirmed. The Auditor has been notified.' });
  } catch (error) { try { await connection.rollback(); } catch {} return res.status(error.statusCode || 500).json({ code:error.code,message:errorMessage(error) }); } finally { connection.release(); }
};

export const returnReviewForCorrection = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) return res.status(400).json({ message: 'Enter a clear correction reason.' });
    await connection.beginTransaction();
    const review = await getOperationalReviewForUpdate(connection, req.params.id);
    if (!review) throw Object.assign(new Error('Review not found.'), { statusCode: 404 });
    await assertHeadForReview(connection, req.authUser, review);
    if (review.claimed_by_user_id && Number(review.claimed_by_user_id) !== Number(req.authUser.id)) {
      throw Object.assign(new Error('Another Head already claimed this review.'), { statusCode: 409 });
    }
    if (review.status !== 'pending_head_review') throw Object.assign(new Error('This review cannot be returned from its current state.'), { statusCode: 409 });
    await connection.query(`UPDATE operational_reviews SET status='returned_for_correction',claimed_by_user_id=?,claimed_at=COALESCE(claimed_at,NOW()),head_reviewed_by_user_id=?,head_reviewed_at=NOW() WHERE operational_review_id=?`, [req.authUser.id,req.authUser.id,review.operational_review_id]);
    await appendReviewEvent(connection, { reviewId: review.operational_review_id, eventType: 'returned_for_correction', actor: req.authUser, fromStatus: review.status, toStatus: 'returned_for_correction', message: reason });
    await createInternalNotifications(connection, { userIds:[review.initiated_by_user_id],type:'review_returned',title:`Correction required · ${review.entity_label || review.entity_type}`,message:`${review.review_number}: ${reason}`,reviewId:review.operational_review_id });
    await connection.commit();
    return res.json({ message: 'Returned to the staff member for correction.' });
  } catch (error) { try { await connection.rollback(); } catch {} return res.status(error.statusCode || 500).json({ code:error.code,message:errorMessage(error) }); } finally { connection.release(); }
};

export const auditorVerifyReview = async (req, res) => {
  const connection = await db.getConnection();
  try {
    if (req.authUser?.role !== 'auditor') return res.status(403).json({ message: 'Only an Auditor can complete independent audit verification.' });
    await connection.beginTransaction();
    const review = await getOperationalReviewForUpdate(connection, req.params.id);
    if (!review) throw Object.assign(new Error('Review not found.'), { statusCode: 404 });
    if (!['pending_auditor_review','pending_auditor_recheck'].includes(review.status)) throw Object.assign(new Error('This review is not awaiting Auditor verification.'), { statusCode: 409 });
    const previous = review.status;
    const recheckRejected = previous === 'pending_auditor_recheck' && (req.body?.verified === false || String(req.body?.decision || '').toLowerCase() === 'reject');
    if (recheckRejected) {
      const note = String(req.body?.note || '').trim();
      if (note.length < 5) throw Object.assign(new Error('Explain what is still incorrect before returning the correction.'), { statusCode: 400 });
      await connection.query("UPDATE audit_cases SET status='pending_system_admin_correction',auditor_resolution=?,auditor_resolved_by_user_id=?,auditor_resolved_at=NOW() WHERE operational_review_id=? AND status='pending_auditor_recheck'", [note, req.authUser.id, review.operational_review_id]);
      await connection.query("UPDATE operational_reviews SET status='correction_required',auditor_reviewed_by_user_id=?,auditor_reviewed_at=NOW() WHERE operational_review_id=?", [req.authUser.id, review.operational_review_id]);
      await appendReviewEvent(connection, { reviewId:review.operational_review_id,eventType:'correction_rejected_by_auditor',actor:req.authUser,fromStatus:previous,toStatus:'correction_required',message:note });
      const correctionRole = getAuditCorrectionRole(review);
      if (correctionRole === 'super_admin') {
        const [ownerRows] = await connection.query("SELECT id FROM users WHERE role='super_admin' AND status='active' AND COALESCE(can_login,1)=1");
        await createInternalNotifications(connection, { userIds: ownerRows.map((row) => row.id), type: 'audit_correction_rework', title: `Correction still needs work · ${review.review_number}`, message: note, reviewId: review.operational_review_id });
      } else {
        await notifySystemAdmins(connection, { reviewId: review.operational_review_id, type: 'audit_correction_rework', title: `Correction still needs work · ${review.review_number}`, message: note });
      }
      await connection.commit();
      return res.json({ message: `Correction returned to ${correctionRole === 'super_admin' ? 'Super Admin' : 'System Admin'} for another controlled fix.` });
    }
    if (previous === 'pending_auditor_recheck') {
      await connection.query("UPDATE audit_cases SET status='closed',final_verified_by_auditor_user_id=?,final_verified_at=NOW() WHERE operational_review_id=? AND status='pending_auditor_recheck'", [req.authUser.id, review.operational_review_id]);
    }
    await connection.query(`UPDATE operational_reviews SET status='closed',auditor_reviewed_by_user_id=?,auditor_reviewed_at=NOW() WHERE operational_review_id=?`, [req.authUser.id,review.operational_review_id]);
    await appendReviewEvent(connection, { reviewId:review.operational_review_id,eventType:previous==='pending_auditor_recheck'?'correction_verified':'auditor_verified',actor:req.authUser,fromStatus:previous,toStatus:'closed',message:String(req.body?.note || 'Auditor verified no issue.').slice(0,1000) });
    await writeAuditLog(connection, req, { action:'approve',module:'Review Center',entityType:'operational_review',entityId:String(review.operational_review_id),entityLabel:review.review_number,title:'Auditor verified operational review',description:`${review.review_number} closed after independent verification.`,metadata:{action_key:review.action_key} });
    await connection.commit();
    return res.json({ message: 'Audit verification completed. Review closed.' });
  } catch (error) { try { await connection.rollback(); } catch {} return res.status(error.statusCode || 500).json({ code:error.code,message:errorMessage(error) }); } finally { connection.release(); }
};

export const listInternalNotifications = async (req, res) => {
  try {
    const { page,limit } = pageValues(req.query); const offset=(page-1)*limit;
    const [countRows] = await db.query('SELECT COUNT(*) total FROM internal_notifications WHERE user_id=?',[req.authUser.id]);
    const [rows] = await db.query('SELECT * FROM internal_notifications WHERE user_id=? ORDER BY created_at DESC,internal_notification_id DESC LIMIT ? OFFSET ?',[req.authUser.id,limit,offset]);
    return res.json({ data:rows,pagination:{page,limit,total:Number(countRows[0]?.total||0)} });
  } catch(error){ return res.status(500).json({message:errorMessage(error)}); }
};

export const markInternalNotificationRead = async (req,res) => {
  try { await db.query('UPDATE internal_notifications SET read_at=COALESCE(read_at,NOW()) WHERE internal_notification_id=? AND user_id=?',[Number(req.params.id),req.authUser.id]); return res.json({message:'Notification marked read.'}); }
  catch(error){ return res.status(500).json({message:errorMessage(error)}); }
};

const caseNumber = (id) => `CASE-${String(id).padStart(8, '0')}`;

export const openAuditCase = async (req,res) => {
  const connection=await db.getConnection();
  try {
    if(req.authUser?.role!=='auditor') return res.status(403).json({message:'Only an Auditor can open an Audit Case.'});
    const finding=String(req.body?.finding||'').trim();
    if(finding.length<5) return res.status(400).json({message:'Describe the audit finding before opening a case.'});
    await connection.beginTransaction();
    const review=await getOperationalReviewForUpdate(connection,req.params.id);
    if(!review) throw Object.assign(new Error('Review not found.'),{statusCode:404});
    if(review.status!=='pending_auditor_review') throw Object.assign(new Error('An Audit Case can be opened only while the review is pending Auditor review.'),{statusCode:409});
    const [existing]=await connection.query("SELECT audit_case_id,case_number FROM audit_cases WHERE operational_review_id=? AND status NOT IN ('closed','finding_invalid') LIMIT 1 FOR UPDATE",[review.operational_review_id]);
    if(existing[0]) throw Object.assign(new Error(`${existing[0].case_number||'An Audit Case'} is already open for this review.`),{statusCode:409});
    const [result]=await connection.query('INSERT INTO audit_cases (operational_review_id,opened_by_auditor_user_id,finding) VALUES (?,?,?)',[review.operational_review_id,req.authUser.id,finding]);
    const caseId=Number(result.insertId); const number=caseNumber(caseId);
    await connection.query('UPDATE audit_cases SET case_number=? WHERE audit_case_id=?',[number,caseId]);
    await connection.query("UPDATE operational_reviews SET status='audit_case_open',auditor_reviewed_by_user_id=?,auditor_reviewed_at=NOW() WHERE operational_review_id=?",[req.authUser.id,review.operational_review_id]);
    await appendReviewEvent(connection,{reviewId:review.operational_review_id,eventType:'audit_case_opened',actor:req.authUser,fromStatus:review.status,toStatus:'audit_case_open',message:finding,metadata:{auditCaseId:caseId,caseNumber:number}});
    // Resolve the accountable responder: Department Head for normal department work,
    // System Admin for System Admin direct changes, or legacy Super Admin for old emergency changes.
    const responders=await resolveAuditCaseResponders(connection,{...review,assigned_responder_user_id:null});
    let recipients=responders.userIds;
    if(!recipients.length){
      const [adminRows]=await connection.query("SELECT id FROM users WHERE role='system_admin' AND status='active'");
      await createInternalNotifications(connection,{userIds:adminRows.map((r)=>r.id),type:'audit_case_no_responder',title:`Audit Case has no available responder · ${number}`,message:`No active ${review.department} Head can answer ${number}. Reassign a responder in the Review Center.`,reviewId:review.operational_review_id,auditCaseId:caseId});
    }
    await createInternalNotifications(connection,{userIds:recipients,type:'audit_case_response_required',title:`Audit Case requires explanation · ${number}`,message:finding,reviewId:review.operational_review_id,auditCaseId:caseId});
    await writeAuditLog(connection,req,{action:'create',module:'Audit Cases',entityType:'audit_case',entityId:String(caseId),entityLabel:number,title:'Opened Audit Case',description:`${number} opened for ${review.review_number}.`,metadata:{finding,reviewId:review.operational_review_id}});
    await connection.commit();
    const responderLabel=RESPONDER_MODE_LABELS[responders.mode]||'assigned responder';
    return res.status(201).json({message:`Audit Case opened. ${responderLabel} must explain before resolution.`,data:{auditCaseId:caseId,caseNumber:number,status:'awaiting_head_response'}});
  }catch(error){try{await connection.rollback()}catch{} return res.status(error.statusCode||500).json({code:error.code,message:errorMessage(error)});}finally{connection.release();}
};

export const respondToAuditCase = async (req,res) => {
  const connection=await db.getConnection();
  try {
    const response=String(req.body?.response||req.body?.explanation||'').trim(); if(response.length<5)return res.status(400).json({message:'Enter a clear explanation for the Auditor.'});
    await connection.beginTransaction();
    // r.* first so the audit case's own columns (status, created_at...) win.
    const [rows]=await connection.query(`SELECT r.*,c.* FROM audit_cases c INNER JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id WHERE c.audit_case_id=? LIMIT 1 FOR UPDATE`,[Number(req.params.caseId)]);
    const c=rows[0]; if(!c)throw Object.assign(new Error('Audit Case not found.'),{statusCode:404});
    if(c.status!=='awaiting_head_response')throw Object.assign(new Error('This case is not awaiting an explanation.'),{statusCode:409});
    const responders=await resolveAuditCaseResponders(connection,c);
    if(!responders.userIds.includes(Number(req.authUser?.id||0))){
      const who=RESPONDER_MODE_LABELS[responders.mode]||'the assigned responder';
      throw Object.assign(new Error(`This case must be answered by: ${who}.`),{statusCode:403,code:'AUDIT_CASE_RESPONDER_REQUIRED'});
    }
    await connection.query("UPDATE audit_cases SET status='under_auditor_review',head_response=?,head_responded_by_user_id=?,head_responded_at=NOW() WHERE audit_case_id=?",[response,req.authUser.id,c.audit_case_id]);
    await appendReviewEvent(connection,{reviewId:c.operational_review_id,eventType:'head_explanation_submitted',actor:req.authUser,fromStatus:'audit_case_open',toStatus:'audit_case_open',message:response,metadata:{auditCaseId:c.audit_case_id,caseNumber:c.case_number,responderMode:responders.mode}});
    await notifyAuditors(connection,{reviewId:c.operational_review_id,auditCaseId:c.audit_case_id,type:'audit_case_head_response',title:`Explanation received · ${c.case_number}`,message:response});
    await connection.commit(); return res.json({message:'Explanation submitted to the Auditor.'});
  }catch(error){try{await connection.rollback()}catch{} return res.status(error.statusCode||500).json({code:error.code,message:errorMessage(error)});}finally{connection.release();}
};

// System Admin (or Super Admin) assigns who must answer a case, e.g. when the
// original Head left or no Head covers the project (plan item 17).
export const reassignAuditCaseResponder = async (req,res) => {
  const connection=await db.getConnection();
  try {
    if(!['system_admin','super_admin'].includes(req.authUser?.role))return res.status(403).json({message:'Only System Admin can reassign an Audit Case responder.'});
    const targetUserId=Number(req.body?.userId||req.body?.user_id||0);
    const reason=String(req.body?.reason||'').trim();
    if(!targetUserId)return res.status(400).json({message:'Select the Head who will answer this case.'});
    if(reason.length<5)return res.status(400).json({message:'Enter a reason for the reassignment.'});
    await connection.beginTransaction();
    const [rows]=await connection.query(`SELECT r.*,c.* FROM audit_cases c INNER JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id WHERE c.audit_case_id=? LIMIT 1 FOR UPDATE`,[Number(req.params.caseId)]);
    const c=rows[0]; if(!c)throw Object.assign(new Error('Audit Case not found.'),{statusCode:404});
    if(c.status!=='awaiting_head_response')throw Object.assign(new Error('Only a case waiting for an explanation can be reassigned.'),{statusCode:409});
    if(!Object.prototype.hasOwnProperty.call(c,'assigned_responder_user_id'))throw Object.assign(new Error('Apply the latest workflow migration (batch6) before reassigning responders.'),{statusCode:409});
    const [targetRows]=await connection.query("SELECT id,role,status,COALESCE(all_projects_access,admin_all_projects,0) all_projects_access FROM users WHERE id=? LIMIT 1",[targetUserId]);
    const target=targetRows[0];
    const expectedRole=c.approval_type==='system_admin_direct'?'system_admin':DEPARTMENT_HEAD_ROLE[c.department];
    if(!target||target.status!=='active')throw Object.assign(new Error('The selected user is not active.'),{statusCode:400});
    if(target.role!==expectedRole && target.role!=='super_admin')throw Object.assign(new Error(expectedRole==='system_admin'?'The responder must be an active System Admin.':`The responder must be an active ${String(c.department)} Head.`),{statusCode:400});
    if(target.role===expectedRole && c.lot_project_id && Number(target.all_projects_access)!==1){
      const [scope]=await connection.query('SELECT 1 FROM user_project_access WHERE user_id=? AND lot_project_id=? LIMIT 1',[target.id,c.lot_project_id]);
      if(!scope.length)throw Object.assign(new Error('The selected Head has no access to this project.'),{statusCode:400});
    }
    await connection.query('UPDATE audit_cases SET assigned_responder_user_id=?,responder_reassigned_by_user_id=?,responder_reassigned_at=NOW() WHERE audit_case_id=?',[target.id,req.authUser.id,c.audit_case_id]);
    await appendReviewEvent(connection,{reviewId:c.operational_review_id,eventType:'audit_case_responder_reassigned',actor:req.authUser,fromStatus:'audit_case_open',toStatus:'audit_case_open',message:reason,metadata:{auditCaseId:c.audit_case_id,assignedResponderUserId:target.id,previousHeadUserId:c.head_reviewed_by_user_id||null}});
    await createInternalNotifications(connection,{userIds:[target.id],type:'audit_case_response_required',title:`Audit Case reassigned to you · ${c.case_number}`,message:c.finding,reviewId:c.operational_review_id,auditCaseId:c.audit_case_id});
    await writeAuditLog(connection,req,{action:'update',module:'Audit Cases',entityType:'audit_case',entityId:String(c.audit_case_id),entityLabel:c.case_number,title:'Reassigned Audit Case responder',description:`${c.case_number} responder reassigned.`,metadata:{reason,assignedResponderUserId:target.id}});
    await connection.commit(); return res.json({message:'Responder reassigned and notified.'});
  }catch(error){try{await connection.rollback()}catch{} return res.status(error.statusCode||500).json({code:error.code,message:errorMessage(error)});}finally{connection.release();}
};

export const resolveAuditCase = async (req,res) => {
  const connection=await db.getConnection();
  try {
    if(req.authUser?.role!=='auditor')return res.status(403).json({message:'Only an Auditor can resolve an Audit Case.'});
    const decision=String(req.body?.decision||'').trim().toLowerCase(); const resolution=String(req.body?.resolution||req.body?.note||'').trim();
    if(!['valid','invalid'].includes(decision))return res.status(400).json({message:'Decision must be valid or invalid.'});
    if(resolution.length<5)return res.status(400).json({message:'Enter the Auditor resolution.'});
    await connection.beginTransaction();
    const [rows]=await connection.query(`SELECT c.*,r.review_number,r.entity_label,r.approval_type,r.initiated_by_role,r.initiated_by_user_id FROM audit_cases c INNER JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id WHERE c.audit_case_id=? LIMIT 1 FOR UPDATE`,[Number(req.params.caseId)]); const c=rows[0];
    if(!c)throw Object.assign(new Error('Audit Case not found.'),{statusCode:404}); if(c.status!=='under_auditor_review')throw Object.assign(new Error('The Head explanation must be submitted before the Auditor can decide the case.'),{statusCode:409});
    if(decision==='invalid'){
      await connection.query("UPDATE audit_cases SET status='finding_invalid',auditor_resolution=?,auditor_resolved_by_user_id=?,auditor_resolved_at=NOW() WHERE audit_case_id=?",[resolution,req.authUser.id,c.audit_case_id]);
      await connection.query("UPDATE operational_reviews SET status='closed' WHERE operational_review_id=?",[c.operational_review_id]);
      await appendReviewEvent(connection,{reviewId:c.operational_review_id,eventType:'audit_finding_invalid',actor:req.authUser,fromStatus:'audit_case_open',toStatus:'closed',message:resolution,metadata:{auditCaseId:c.audit_case_id}});
      if(c.head_responded_by_user_id) await createInternalNotifications(connection,{userIds:[c.head_responded_by_user_id],type:'audit_case_closed',title:`Audit finding invalid · ${c.case_number}`,message:resolution,reviewId:c.operational_review_id,auditCaseId:c.audit_case_id});
      await connection.commit(); return res.json({message:'Finding marked invalid. Original record remains unchanged and the review is closed.'});
    }
    const correctionRole = getAuditCorrectionRole(c);
    await connection.query("UPDATE audit_cases SET status='pending_system_admin_correction',auditor_resolution=?,auditor_resolved_by_user_id=?,auditor_resolved_at=NOW() WHERE audit_case_id=?",[resolution,req.authUser.id,c.audit_case_id]);
    await connection.query("UPDATE operational_reviews SET status='correction_required' WHERE operational_review_id=?",[c.operational_review_id]);
    await appendReviewEvent(connection,{reviewId:c.operational_review_id,eventType:'audit_finding_valid',actor:req.authUser,fromStatus:'audit_case_open',toStatus:'correction_required',message:resolution,metadata:{auditCaseId:c.audit_case_id,correctionRole}});
    if (correctionRole === 'super_admin') {
      const [ownerRows] = await connection.query("SELECT id FROM users WHERE role='super_admin' AND status='active' AND COALESCE(can_login,1)=1");
      await createInternalNotifications(connection,{userIds:ownerRows.map((row)=>row.id),type:'system_correction_required',title:`Owner correction required · ${c.case_number}`,message:resolution,reviewId:c.operational_review_id,auditCaseId:c.audit_case_id});
    } else {
      await notifySystemAdmins(connection,{reviewId:c.operational_review_id,auditCaseId:c.audit_case_id,title:`System correction required · ${c.case_number}`,message:resolution});
    }
    await connection.commit(); return res.json({message:`Finding marked valid. ${correctionRole === 'super_admin' ? 'Super Admin' : 'System Admin'} has been notified for controlled correction.`});
  }catch(error){try{await connection.rollback()}catch{} return res.status(error.statusCode||500).json({code:error.code,message:errorMessage(error)});}finally{connection.release();}
};

export const getAuditCase = async (req,res) => {
  try{const [rows]=await db.query(`SELECT c.*,r.review_number,r.action_key,r.department,r.lot_project_id,r.entity_type,r.entity_id,r.entity_label,r.initiated_by_user_id FROM audit_cases c INNER JOIN operational_reviews r ON r.operational_review_id=c.operational_review_id WHERE c.audit_case_id=? LIMIT 1`,[Number(req.params.caseId)]); if(!rows[0])return res.status(404).json({message:'Audit Case not found.'}); if(!(await canActorSeeReview(db,req.authUser,rows[0])))return res.status(403).json({message:'You cannot view this Audit Case.'}); return res.json({data:rows[0]});}catch(error){return res.status(500).json({message:errorMessage(error)});}
};

export const listProtectedChangeRequests = async (req,res) => {
  try{
    const actor=req.authUser||{}; const {page,limit}=pageValues(req.query); const offset=(page-1)*limit;
    let where='1=0',params=[];
    if(actor.role==='super_admin'||actor.role==='system_admin'||actor.role==='auditor'){where='1=1';}
    else {const department=getRoleDepartment(actor);if(DEPARTMENT_HEAD_ROLE[department]===actor.role){where="p.department=? AND (p.lot_project_id IS NULL OR COALESCE(?,0)=1 OR EXISTS(SELECT 1 FROM user_project_access upa WHERE upa.user_id=? AND upa.lot_project_id=p.lot_project_id))";params=[department,Number(actor.all_projects_access||actor.admin_all_projects||0),actor.id];}else{where='p.requested_by_user_id=?';params=[actor.id];}}
    const requestedStatus=String(req.query.status||'').trim();if(requestedStatus){where+=` AND p.status=?`;params.push(requestedStatus);}
    const [countRows]=await db.query(`SELECT COUNT(*) total FROM protected_change_requests p WHERE ${where}`,params);
    const [rows]=await db.query(`SELECT p.*,TRIM(CONCAT_WS(' ',u.first_name,u.middle_name,u.last_name)) requested_by_name,TRIM(CONCAT_WS(' ',h.first_name,h.middle_name,h.last_name)) reviewed_by_head_name,lp.lot_project_name FROM protected_change_requests p LEFT JOIN users u ON u.id=p.requested_by_user_id LEFT JOIN users h ON h.id=p.reviewed_by_head_user_id LEFT JOIN lot_projects lp ON lp.lot_project_id=p.lot_project_id WHERE ${where} ORDER BY p.created_at DESC,p.protected_change_request_id DESC LIMIT ? OFFSET ?`,[...params,limit,offset]);
    return res.json({data:rows,pagination:{page,limit,total:Number(countRows[0]?.total||0)}});
  }catch(error){return res.status(500).json({message:errorMessage(error)});}
};

export const reviewProtectedChangeRequest = async (req,res) => {
  const connection=await db.getConnection();
  try{
    const decision=String(req.body?.decision||'').trim().toLowerCase(); if(!['approve','reject'].includes(decision))return res.status(400).json({message:'Decision must be approve or reject.'});
    await connection.beginTransaction(); const row=await approveProtectedChange(connection,{requestId:req.params.requestId,actor:req.authUser,approve:decision==='approve',note:req.body?.note});
    await writeAuditLog(connection,req,{action:decision==='approve'?'approve':'reject',module:'Review Center',entityType:'protected_change_request',entityId:String(row.protected_change_request_id),entityLabel:row.request_number,title:`Department Head ${decision}d protected change`,description:`${row.request_number} was ${decision}d by the Department Head.`,metadata:{action_key:row.action_key,department:row.department}});
    await connection.commit(); return res.json({message:`Protected change ${decision}d.`,data:{requestId:row.protected_change_request_id,requestNumber:row.request_number,status:row.status}});
  }catch(error){try{await connection.rollback()}catch{}return res.status(error.statusCode||500).json({code:error.code,message:errorMessage(error)});}finally{connection.release();}
};


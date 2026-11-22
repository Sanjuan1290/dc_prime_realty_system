import {db} from '../../../db/connect.js';
import {ensureAttendanceLiteSchema} from './attendanceLite.shared.js';
import {readBulkTimeOutInput,previewBulkTimeOut,saveBulkTimeOut} from '../../../services/attendanceBulkTimeOut.service.js';

const handler=save=>async(req,res,next)=>{
  let connection;
  try{
    const input=readBulkTimeOutInput(req.body);
    connection=await db.getConnection();
    await ensureAttendanceLiteSchema(connection);
    await connection.beginTransaction();
    const data=save?await saveBulkTimeOut(connection,req,input,req.body.review_token):await previewBulkTimeOut(connection,req,input);
    await connection.commit();
    res.set('Cache-Control','no-store').json({success:true,
      ...(save?{message:`Time Out updated for ${data.changed_count} employee(s). ${data.recalculated_drafts} payroll draft(s) recalculated.`}:{}),data});
  }catch(error){
    if(connection)try{await connection.rollback()}catch{}
    if([1205,1213,8005].includes(Number(error.errno)))return res.status(409).json({code:'BULK_TIME_OUT_RETRY',message:'Another operation changed these records. No changes were saved. Preview and try again.'});
    return next(error);
  }finally{connection?.release()}
};
export const previewBulkTimeOutAdjustment=handler(false);
export const applyBulkTimeOutAdjustment=handler(true);

import {db} from '../../../db/connect.js';
import {loadKioskCredential,kioskCredentialStatus,regenerateKioskPassword} from '../../../services/attendanceKioskCredential.service.js';
export const getKioskPasswordStatus = async (_req,res,next) => {
 try{res.set('Cache-Control','no-store').json({success:true,data:kioskCredentialStatus(await loadKioskCredential(db))})}catch(error){next(error)}
};
export const rotateKioskPassword = async (req,res,next) => {
 if(req.body?.confirmed!==true)return res.status(400).json({message:'Confirm that all kiosk sessions will lock and the new password is visible for only 15 seconds.'});
 let connection;
 try{
  connection=await db.getConnection();await connection.beginTransaction();
  const data=await regenerateKioskPassword(connection,req);await connection.commit();
  res.set('Cache-Control','no-store').json({success:true,data});
 }catch(error){if(connection)try{await connection.rollback()}catch{}next(error)}finally{connection?.release()}
};

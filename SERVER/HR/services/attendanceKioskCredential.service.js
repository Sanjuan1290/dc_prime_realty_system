import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import {writeAuditLog} from '../controllers/System/auditLogs.controller.js';

export const KIOSK_PASSWORD_LIFETIME_MS=14*24*60*60*1000;
const failure=(message,code,statusCode)=>Object.assign(new Error(message),{code,statusCode});
export const loadKioskCredential = async (connection,{forUpdate=false}={}) => {
 try{
  const [[row]]=await connection.query(`SELECT attendance_kiosk_password_hash AS passwordHash,attendance_kiosk_generation AS generation,
   attendance_kiosk_password_expires_at_ms AS expiresAt FROM hr_settings WHERE id=1${forUpdate?' FOR UPDATE':''}`);
  if(!row)throw failure('HR settings are missing.','KIOSK_SETTINGS_MISSING',503);
  return {...row,generation:Number(row.generation||0),expiresAt:row.expiresAt==null?null:Number(row.expiresAt)};
 }catch(error){if(error.code==='ER_BAD_FIELD_ERROR')throw failure('Apply the HR kiosk password rotation migration before using this feature.','KIOSK_MIGRATION_REQUIRED',503);throw error}
};
export const kioskCredentialStatus = (credential,{now=Date.now()}={}) => {
 const rotated=credential.generation>0,expired=rotated&&(!credential.expiresAt||credential.expiresAt<=now);
 return {configured:rotated?Boolean(credential.passwordHash):Boolean(String(process.env.ATTENDANCE_PINCODE||'').trim()),
  legacy:!rotated,expired,expiresAt:credential.expiresAt,generation:credential.generation,
  expiringSoon:rotated&&!expired&&credential.expiresAt-now<=3*24*60*60*1000};
};
export const kioskSessionMatchesCredential = (session,credential,{now=Date.now()}={}) => Boolean(session
 && Number(session.generation||0)===credential.generation && Number(session.expiresAt)>now
 && (credential.generation===0||Boolean(credential.passwordHash)&&Number(credential.expiresAt)>now));
export const assertKioskSessionCurrent = async (connection,session,options={}) => {
 const credential=await loadKioskCredential(connection,options);
 if(!kioskSessionMatchesCredential(session,credential))throw failure('Kiosk password changed or expired. Enter the current password to unlock this station.','ATTENDANCE_PIN_REQUIRED',401);
 return credential;
};
export const validateKioskPassword = async (submitted,credential) => {
 const value=typeof submitted==='string'?submitted.trim():'';
 if(!value||value.length>128)return false;
 const state=kioskCredentialStatus(credential);
 if(!state.configured||state.expired)return false;
 if(!state.legacy)return bcrypt.compare(value,credential.passwordHash);
 const expected=Buffer.from(String(process.env.ATTENDANCE_PINCODE||'').trim()),actual=Buffer.from(value);
 return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
};
export const regenerateKioskPassword = async (connection,req,{now=Date.now()}={}) => {
 const password=crypto.randomBytes(18).toString('base64url'),hash=await bcrypt.hash(password,12);
 const previous=await loadKioskCredential(connection,{forUpdate:true});
 const generation=previous.generation+1,expiresAt=now+KIOSK_PASSWORD_LIFETIME_MS;
 await connection.query(`UPDATE hr_settings SET attendance_kiosk_password_hash=?,attendance_kiosk_generation=?,
  attendance_kiosk_password_expires_at_ms=?,attendance_kiosk_rotated_at=UTC_TIMESTAMP(3) WHERE id=1`,[hash,generation,expiresAt]);
 await writeAuditLog(connection,req,{action:'update',module:'Attendance',entityType:'attendance_kiosk',entityId:'1',title:'Regenerated kiosk password',description:'All kiosk sessions on all devices were invalidated. A new credential is valid for 14 days.',metadata:{generation,expiresAt:new Date(expiresAt).toISOString()}});
 // This return value is sent only by the initial POST. No plaintext is persisted.
 return {password,generation,expiresAt,visibleForSeconds:15};
};

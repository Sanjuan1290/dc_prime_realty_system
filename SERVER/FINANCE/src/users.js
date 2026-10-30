import {getPool,withTransaction} from './db.js';
import {hashPassword} from './passwords.js';
import {audit} from './ledger.js';
import {problem} from './domain.js';
export async function listUsers(){const [rows]=await getPool().execute('SELECT id,email,display_name,role,is_active,created_at FROM finance_users ORDER BY id');return rows;}
export async function createUser(body,actor){
  const email=String(body?.email??'').toLowerCase().trim();const display_name=String(body?.display_name??'').trim();
  const role=body?.role;const password=body?.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>190||!display_name||display_name.length>160||!['admin','accountant','viewer'].includes(role))throw problem('INVALID_USER','Valid name, email, and role are required.');
  const password_hash=hashPassword(password);
  return withTransaction(async conn=>{
    const [result]=await conn.execute('INSERT INTO finance_users(email,display_name,password_hash,role) VALUES(?,?,?,?)',[email,display_name,password_hash,role]);
    await audit(conn,actor.id,'user.created','user',result.insertId,{email,role});
    return {id:String(result.insertId),email,display_name,role,is_active:1};
  });
}

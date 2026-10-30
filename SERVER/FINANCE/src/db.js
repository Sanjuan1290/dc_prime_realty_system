import mysql from 'mysql2/promise';
import {assertSafeDatabase} from './dbGuard.js';
export {assertSafeDatabase};
let pool;
export function getPool() {
  if (!pool) {
    assertSafeDatabase();
    pool = mysql.createPool({host:process.env.TIDB_HOST,port:Number(process.env.TIDB_PORT||4000),user:process.env.TIDB_USERNAME,password:process.env.TIDB_PASSWORD,database:'dc_prime_finance_db',ssl:process.env.TIDB_SSL === 'true' ? {minVersion:'TLSv1.2',rejectUnauthorized:true} : undefined,waitForConnections:true,connectionLimit:6,decimalNumbers:false,dateStrings:true,timezone:'Z'});
  }
  return pool;
}
export async function withTransaction(fn) {
  const connection = await getPool().getConnection();
  try { await connection.beginTransaction(); const value = await fn(connection); await connection.commit(); return value; }
  catch (err) { try { await connection.rollback(); } catch {} throw err; }
  finally { connection.release(); }
}

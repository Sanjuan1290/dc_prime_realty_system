import mysql from 'mysql2/promise';
import { readStartupTimeout } from '../services/serverStartup.service.js';
const name = String(process.env.HR_DB_NAME || '').trim();
if (!/^dc_prime_hr_db(?:_staging)?$/.test(name)) throw new Error('HR_DB_NAME must target the approved independent HR database.');
const required = ['HR_DB_HOST','HR_DB_USER','HR_DB_PASSWORD','HR_DB_NAME'];
for (const key of required) if (!String(process.env[key] || '').trim()) throw new Error(`Missing HR credential: ${key}`);
if (process.env.NODE_ENV === 'production' && process.env.HR_DB_TLS !== 'true') throw new Error('Production HR database connections require TLS.');
export const db = mysql.createPool({ host: process.env.HR_DB_HOST, port: Number(process.env.HR_DB_PORT || 4000), user:process.env.HR_DB_USER,
  password:process.env.HR_DB_PASSWORD, database:name,
  ssl:process.env.HR_DB_TLS === 'false' ? undefined : { minVersion:'TLSv1.2', rejectUnauthorized:true },
  connectTimeout:readStartupTimeout(process.env.HR_DB_CONNECT_TIMEOUT_MS,10000,'HR_DB_CONNECT_TIMEOUT_MS'),
  waitForConnections:true, connectionLimit:5, dateStrings:true });

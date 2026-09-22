import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const requiredEnvironmentVariables = [
  'TIDB_HOST',
  'TIDB_USERNAME',
  'TIDB_PASSWORD',
  'TIDB_DATABASE',
];

const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (name) => !String(process.env[name] || '').trim()
);

if (missingEnvironmentVariables.length) {
  throw new Error(
    `Missing database environment variable(s): ${missingEnvironmentVariables.join(', ')}`
  );
}

const useTls = String(process.env.TIDB_SSL || 'true').toLowerCase() === 'true';

export const db = mysql.createPool({
  host: process.env.TIDB_HOST,
  port: Number(process.env.TIDB_PORT || 4000),
  user: process.env.TIDB_USERNAME,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE,
  ssl: useTls
    ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      }
    : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60_000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true,
});



// Read-only check, executed from server/ with production-equivalent environment.
// No records or session configuration are modified.
import { db } from '../db/connect.js';
const connection = await db.getConnection();
try {
  const [[row]] = await connection.query(`
    SELECT
      @@session.time_zone AS sessionTimeZone,
      @@global.time_zone AS globalTimeZone,
      NOW() AS databaseNow,
      UTC_TIMESTAMP() AS utcNow,
      TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS offsetMinutes
  `);
  console.log(JSON.stringify(row, null, 2));
  if (Number(row.offsetMinutes) === 0) {
    console.log('App database session currently uses UTC. Default UTC interpretation is appropriate for new DATETIME values.');
  } else if (Number(row.offsetMinutes) === 480) {
    console.log('App database session currently uses Philippine Time. Set TIDB_DATETIME_SOURCE_TIME_ZONE=Asia/Manila on Render and VITE_DB_DATETIME_SOURCE_TIME_ZONE=Asia/Manila on Cloudflare Pages, then rebuild.');
  } else {
    console.warn(`WARNING: source session offset is ${row.offsetMinutes} minutes, not UTC or Philippine Time. Do not deploy the display conversion before establishing the source convention.`);
  }
} finally {
  connection.release();
  await db.end();
}


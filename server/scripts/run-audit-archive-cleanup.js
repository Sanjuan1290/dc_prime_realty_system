import 'dotenv/config';
import { db } from '../db/connect.js';
import { runArchiveCleanup } from '../controllers/System/auditArchiveManagement.controller.js';
try { console.log('Archive cleanup:',JSON.stringify(await runArchiveCleanup())); }
catch(e) { console.error('Archive cleanup failed:',e.message);process.exitCode=1; }
finally { await db.end(); }

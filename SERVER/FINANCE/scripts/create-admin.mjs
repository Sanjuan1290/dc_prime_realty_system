import 'dotenv/config';
import {getPool,assertSafeDatabase} from '../src/db.js';
import {hashPassword} from '../src/auth.js';
assertSafeDatabase();
const email=String(process.env.FINANCE_ADMIN_EMAIL||'').toLowerCase().trim();
const password=process.env.FINANCE_ADMIN_PASSWORD;
const name=String(process.env.FINANCE_ADMIN_NAME||'Finance Administrator').trim();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password||password.length<12){console.error('Set FINANCE_ADMIN_EMAIL and FINANCE_ADMIN_PASSWORD (12+ characters) in your secure environment.');process.exit(1);}
const db=getPool();
const [count]=await db.execute('SELECT COUNT(*) AS n FROM finance_users');
if(Number(count[0].n)!==0){console.error('Bootstrap refused: finance_users is not empty. Use an approved admin management workflow.');process.exit(1);}
await db.execute("INSERT INTO finance_users(email,display_name,password_hash,role) VALUES(?,?,?,'admin')",[email,name,hashPassword(password)]);
console.log('First Finance admin created. Clear FINANCE_ADMIN_PASSWORD from the environment.');
await db.end();

import {readFileSync} from 'node:fs';
// Add only HR-owned schema and grants. No business rows are rewritten at startup.
export async function ensureLiveAccess(db){
  for (const sql of readFileSync(new URL('../migrations/20261118_payroll_undo.sql',import.meta.url),'utf8').split(';').map(s=>s.trim()).filter(Boolean)) await db.query(sql);
  const permissions=[['audit.view','View HR and payroll audit history'],['employee_salary.receipt.print','Print finalized payroll receipts'],['employee_salary.receipt.export','Export finalized payroll receipts']];
  await db.query('INSERT IGNORE INTO hr_permissions(permission_code,description) VALUES (?,?),(?,?),(?,?)',permissions.flat());
  await db.query(`INSERT IGNORE INTO hr_role_permissions(role_code,permission_code)
    SELECT r.role_code,p.permission_code FROM hr_roles r CROSS JOIN hr_permissions p
    WHERE r.role_code IN ('hr_admin','hr_payroll_manager') AND p.permission_code IN (?,?,?)`,permissions.map(([code])=>code));
}

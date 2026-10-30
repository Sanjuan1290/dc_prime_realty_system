/** Operational gate evidence is reviewed by humans; this never activates production. */
export const GATES=[
  ['backup_restore','Recent staging backups and restoration test recorded'],
  ['tidb_migrations','Finance 12/13 schema, constraints and rollback tested in staging TiDB'],
  ['builds','Clean full-checkout builds and dependency audit approved'],
  ['auth_security','Authenticated API, CSRF, role, session, logging and rate-limit tests approved'],
  ['import_roundtrip','Real Batch 11 ZIP/XLSX roundtrip and concurrent imports validated'],
  ['finance_parity','Authoritative Realty source totals and Finance import receipts reconciled'],
  ['payroll_history','HR salary history and corrections independently reconciled'],
  ['corrections','Source revision/reversal process approved, or an explicit documented launch scope restriction approved'],
  ['permissions','Account owner and least-privilege access approved'],
  ['monitoring_recovery','Monitoring, freeze, restore and post-cutover write recovery rehearsed'],
  ['business_approval','Business owner authorized Finance staging-to-production launch']
];
export function reviewLaunchEvidence(evidence={}){
  const blockers=[];
  for(const [key] of GATES){
    const e=evidence.gates?.[key];
    if(e?.status!=='verified'||typeof e.reference!=='string'||e.reference.trim().length<5||typeof e.reviewer!=='string'||e.reviewer.trim().length<3||!/^\d{4}-\d{2}-\d{2}$/.test(e.verified_on||''))blockers.push(key);
  }
  if(evidence.finance_reconciliation?.reconciliation_passed!==true)blockers.push('finance_reconciliation');
  if(evidence.finance_reconciliation?.launch_approved===true)blockers.push('invalid_reconciliation_evidence');
  return {documentary_gates_checked:GATES.length,pass_for_manual_review:blockers.length===0,production_activated:false,blockers};
}

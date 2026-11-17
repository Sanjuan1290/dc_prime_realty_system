import test from 'node:test';
import assert from 'node:assert/strict';
import {financeReconciliationThrough} from '../services/companyFinances.service.js';
test('A full current-month filter requires reconciliation through today, while past months keep their exact cutoff',()=>{
 assert.equal(financeReconciliationThrough('2026-11-30','2026-11-16'),'2026-11-16');
 assert.equal(financeReconciliationThrough('2026-10-31','2026-11-16'),'2026-10-31');
 assert.equal(financeReconciliationThrough('2026-11-16','2026-11-16'),'2026-11-16');
});

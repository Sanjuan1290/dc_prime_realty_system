import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../migrations/20261122_review_center_batches.sql',import.meta.url),'utf8').replace(/^\s*--.*$/gm,'');
const changes=[...sql.matchAll(/'((?:''|[^'])*)'/g)].map(match=>match[1].replaceAll("''","'")).filter(value=>/^ALTER TABLE /i.test(value));

test('TiDB migration creates columns before their indexes and foreign keys in separate ALTER statements',()=>{
 assert.equal(changes.length,18);
 const created=new Map();
 for(const ddl of changes){
  const column=ddl.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+) /);
  if(column){assert.doesNotMatch(ddl,/,\s*ADD\b/i);if(!created.has(column[1]))created.set(column[1],new Set());created.get(column[1]).add(column[2]);continue}
  const index=ddl.match(/^ALTER TABLE (\w+) ADD (?:UNIQUE )?KEY \w+ \(([^)]+)\)$/);
  if(index){for(const field of index[2].split(','))if(!['lot_project_id','changed_by_user_id','batch_id','row_id'].includes(field))assert.ok(created.get(index[1])?.has(field),ddl);continue}
  const foreign=ddl.match(/^ALTER TABLE (\w+) ADD CONSTRAINT \w+ FOREIGN KEY \((\w+)\)/);
  if(foreign){assert.ok(created.get(foreign[1])?.has(foreign[2]),ddl);assert.doesNotMatch(ddl,/,\s*ADD\b/i);continue}
  assert.match(ddl,/^ALTER TABLE protected_change_requests MODIFY COLUMN status ENUM\(/);
 }
});

test('migration guards every change and retains existing snapshots, decisions and constraints on retry',()=>{
 assert.equal((sql.match(/SET @review_batch_ddl = IF\(/g)||[]).length,18);
 assert.equal((sql.match(/PREPARE review_batch_stmt FROM/g)||[]).length,18);
 assert.equal((sql.match(/EXECUTE review_batch_stmt;/g)||[]).length,18);
 for(const catalog of ['COLUMNS','STATISTICS','TABLE_CONSTRAINTS'])assert.ok(sql.includes('information_schema.'+catalog));
 assert.ok(sql.includes("LOCATE('''returned''', COLUMN_TYPE) > 0"));
 assert.doesNotMatch(sql,/(?:^|;|'|\n)\s*(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO|TRUNCATE|DROP|DELIMITER)\b|CREATE\s+PROCEDURE|FOREIGN_KEY_CHECKS\s*=/i);
});

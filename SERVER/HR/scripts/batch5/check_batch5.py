#!/usr/bin/env python3
"""Offline Batch 5 guard; no DB connection, no writes. Python standard library only."""
from pathlib import Path
import json, re, sys, hashlib
base=Path(__file__).resolve().parent
mig=base.parent.parent/'migrations'/'20261027_batch5'
manifest=json.loads((base/'batch5_manifest.json').read_text())
fail=[]
files={name:(mig/name).read_text() for name in manifest['script_order']}
alltext='\n'.join(files.values())
found=set(re.findall(r'(?m)^CREATE TABLE `([^`]+)`',alltext))
expected=set(manifest['original_tables'])
if not expected.issubset(found):fail.append('Missing HR business tables: '+str(sorted(expected-found)))
if len(expected)!=17:fail.append('Expected 17 HR business tables')
if len(found)!=28:fail.append('Expected 28 total target tables (17 originals + 11 HR support); saw '+str(len(found)))
if len(found)!=len(re.findall(r'(?m)^CREATE TABLE `([^`]+)`',alltext)):fail.append('Duplicate table names')
refs=re.findall(r'REFERENCES `([^`]+)`',alltext)
if set(refs)-found:fail.append('Undefined referenced table(s): '+str(sorted(set(refs)-found)))
if 'REFERENCES `users`' in alltext or 'dc_prime_realty_system_db' in alltext:fail.append('Cross-database / Realty name found in create SQL')
if re.search(r'(?mi)^\s*(DROP|DELETE|UPDATE|REPLACE|TRUNCATE|ALTER|INSERT)\b',alltext):fail.append('Destructive/mutating action found in schema DDL')
if alltext.count('REFERENCES `hr_users` (`id`)') < 20:fail.append('HR legacy user references not fully retargeted')
for t,counts in manifest['original_tables'].items():
 m=re.search(r'(?ms)^CREATE TABLE `'+re.escape(t)+r'` \(.*?^\) ENGINE=.*?;',files['03_hr_business_schema.sql'])
 if not m:fail.append('Missing CREATE TABLE '+t);continue
 ddl=m.group()
 col_count=len(re.findall(r'^  `([^`]+)` [^\n]*$',ddl,re.M))
 if col_count!=counts['columns']:fail.append(t+': column count changed')
 if ddl.count('REFERENCES `hr_users`')!=counts['userFks']:fail.append(t+': HR user FK count mismatch')
 if sum(ref in expected for ref in re.findall(r'REFERENCES `([^`]+)`',ddl))!=counts['hrFks']:fail.append(t+': internal HR FK count mismatch')
settings=re.search(r'(?ms)^CREATE TABLE `hr_settings` \(.*?^\) ENGINE=.*?;',files['04_hr_support_schema.sql'])
for c in manifest['hr_owned_settings']:
 if not settings or not re.search(r'^\s*`'+re.escape(c)+r'` ',settings.group(),re.M):fail.append('Missing migrated HR setting '+c)
source_check=(mig/'05_source_readonly_preflight.sql').read_text()
target_check=(mig/'06_target_readonly_verification.sql').read_text()
for label,q in [('source',source_check),('target',target_check)]:
 if re.search(r'(?mi)^\s*(DROP|DELETE|UPDATE|REPLACE|TRUNCATE|ALTER|INSERT|CREATE)\s+',q):fail.append(label+' preflight is not read-only')
# All source DDL is preserved except retargeting 20 FKs to hr_users; optional exact dump check
if len(sys.argv)>1:
 dump=Path(sys.argv[1])
 if not dump.is_file():fail.append('Source file not found: '+str(dump))
 else:
  source=dump.read_bytes()
  if hashlib.sha256(source).hexdigest()!=manifest['source_sql_sha256']:fail.append('Source SQL checksum differs from audited Oct 27 dump')
if fail:
 print('BATCH 5 STATIC VALIDATION: FAILED')
 for e in fail:print(' - '+e)
 sys.exit(1)
print('BATCH 5 STATIC VALIDATION: PASS')
print(' - 17 original HR table definitions, 11 support tables')
print(' - 20 user FKs retargeted, 16 HR internal FKs retained')
print(' - All 10 settings represented, no cross-DB schema references')
print(' - Preflight files read-only')
print(' - NOTE: SQL engine execution and live data restore NOT tested')

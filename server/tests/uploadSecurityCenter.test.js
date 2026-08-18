import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('global upload security center is mounted once around the app', () => {
  const main = read('client/src/main.jsx');
  const center = read('client/src/components/Shared/UploadSecurityCenter/UploadSecurityProvider.jsx');

  assert.match(main, /UploadSecurityProvider/);
  assert.match(main, /<UploadSecurityProvider>[\s\S]*<App \/>[\s\S]*<\/UploadSecurityProvider>/);
  assert.match(center, /fixed bottom-4 right-4/);
  assert.match(center, /Uploads &amp; Security/);
  assert.doesNotMatch(center, /Clear completed/);
  assert.match(center, /AUTO_DISMISS_DELAY_MS = 1_500/);
  assert.match(center, /FADE_DURATION_MS = 300/);
  assert.match(center, /allPassed/);
  assert.match(center, /transition-opacity duration-300/);
});

test('security center shows upload, scan, malware, and unscanned outcomes', () => {
  const center = read('client/src/components/Shared/UploadSecurityCenter/UploadSecurityProvider.jsx');

  assert.match(center, /Uploading\.\.\./);
  assert.match(center, /Security scan in progress/);
  assert.match(center, /Security scan passed/);
  assert.match(center, /Security scan failed · Malware detected/);
  assert.match(center, /Upload failed/);
  assert.match(center, /Not security scanned/);
});

test('pending scans poll every 3 seconds for at most 5 minutes, then switch to manual status checks', () => {
  const center = read('client/src/components/Shared/UploadSecurityCenter/UploadSecurityProvider.jsx');

  assert.match(center, /requestApi\(task\.accessPath/);
  assert.match(center, /MALWARE_SCAN_PENDING/);
  assert.match(center, /MALWARE_DETECTED/);
  assert.match(center, /MALWARE_SCAN_ERROR/);
  assert.match(center, /sessionStorage/);
  assert.match(center, /POLL_INTERVAL_MS = 3_000/);
  assert.match(center, /AUTO_POLL_TIMEOUT_MS = 5 \* 60_000/);
  assert.match(center, /setInterval\(poll, POLL_INTERVAL_MS\)/);
  assert.match(center, /elapsed >= AUTO_POLL_TIMEOUT_MS/);
  assert.match(center, /status: 'scan_delayed'/);
  assert.match(center, /Automatic checks stopped after 5 minutes\./);
  assert.match(center, /Check Scan Status/);
  assert.match(center, /checkScanStatus\(task, \{ manual: true \}\)/);
  assert.doesNotMatch(center, /LONG_RUNNING_SCAN_NOTICE_MS/);
  assert.doesNotMatch(center, /keep checking every 3 seconds/);
});

test('successful batches auto-dismiss while warnings and failures require whole-panel acknowledgement', () => {
  const center = read('client/src/components/Shared/UploadSecurityCenter/UploadSecurityProvider.jsx');

  assert.match(center, /attentionStatuses/);
  assert.match(center, /const canDismissAll = allFinished && hasAttention/);
  assert.match(center, /sameCompletedBatch/);
  assert.match(center, /Dismiss upload security status/);
  assert.match(center, /Review required/);
  assert.doesNotMatch(center, /aria-label={`Dismiss \$\{task\.fileName\}`}/);
});

test('buyer document upload registers files with the global status center', () => {
  const upload = read('client/src/components/Lot_Projects/ListingProfileComponents/Documents/UploadDocumentModal.jsx');
  const documents = read('client/src/components/Lot_Projects/ListingProfileComponents/Documents/Documents.jsx');

  assert.match(upload, /useUploadSecurity/);
  assert.match(upload, /createStatusTasks/);
  assert.match(upload, /beginSecurityScan/);
  assert.match(upload, /waiting_confirmation/);
  assert.match(upload, /startSavedFileScans/);
  assert.match(documents, /const result = await onUploadDocument/);
  assert.match(documents, /return result/);
  assert.match(documents, /throw error/);
});

test('payment proof upload registers saved proof ids for background security polling', () => {
  const proof = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/PaymentProofModal.jsx');

  assert.match(proof, /useUploadSecurity/);
  assert.match(proof, /createStatusTasks/);
  assert.match(proof, /startSavedProofScans/);
  assert.match(proof, /proofIds/);
  assert.match(proof, /\/access-url/);
  assert.match(proof, /beginSecurityScan/);
});

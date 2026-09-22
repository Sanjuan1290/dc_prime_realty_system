import { db } from '../db/connect.js';
import { configureSecureCloudinary } from '../services/secureCloudinary.service.js';
import { reconcileAccountProtectedStorage } from '../services/accountProtectedStorage.service.js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1] || 0)) : null;
const accountArg = process.argv.find((value) => value.startsWith('--account='));
const accountId = accountArg ? Math.max(1, Number(accountArg.split('=')[1] || 0)) : null;

const log = (...values) => console.log('[cloudinary-account-storage-v4]', ...values);

const main = async () => {
  const connection = await db.getConnection();
  const total = {
    accounts: 0,
    checked: 0,
    moved: 0,
    alreadyCanonical: 0,
    buyerDocuments: 0,
    paymentProofs: 0,
    acknowledgementCopies: 0,
    commissionReceiptCopies: 0,
  };

  try {
    configureSecureCloudinary();
    const params = [];
    let where = `WHERE NULLIF(TRIM(account.account_reference), '') IS NOT NULL`;
    if (accountId) {
      where += ' AND account.lot_project_account_id = ?';
      params.push(accountId);
    }
    const [accounts] = await connection.query(
      `SELECT account.lot_project_account_id, account.account_reference
       FROM lot_project_accounts account
       ${where}
       ORDER BY account.lot_project_account_id
       ${limit ? 'LIMIT ?' : ''}`,
      limit ? [...params, limit] : params
    );

    log(apply
      ? 'APPLY MODE: protected Cloudinary assets will move to PRJ-*/accounts/ACC-* folders; public IDs stay unchanged.'
      : 'DRY RUN: Cloudinary is inspected, but no asset folders or database metadata are changed.');

    for (const account of accounts) {
      if (apply) await connection.beginTransaction();
      try {
        const result = await reconcileAccountProtectedStorage(connection, {
          accountId: account.lot_project_account_id,
          dryRun: !apply,
        });
        if (apply) await connection.commit();
        total.accounts += 1;
        for (const key of Object.keys(total)) {
          if (key === 'accounts') continue;
          total[key] += Number(result[key] || 0);
        }
        if (result.checked > 0) {
          log(`${apply ? 'APPLIED' : 'CHECKED'} ${account.account_reference}:`, result);
        }
      } catch (error) {
        if (apply) {
          try { await connection.rollback(); } catch {}
        }
        throw error;
      }
    }

    log('Complete.', total);
    if (!apply) {
      log('Review the dry run, then run: npm run migrate:cloudinary-account-storage -- --apply');
    }
  } finally {
    connection.release();
    await db.end();
  }
};

main().catch((error) => {
  console.error('[cloudinary-account-storage-v4] FAILED:', error?.stack || error?.message || error);
  process.exitCode = 1;
});

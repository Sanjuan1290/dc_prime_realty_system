/** Read-only consolidated cash activity from existing source tables + manual entries.
 * We deliberately DO NOT duplicate payroll/payment/commission rows into a second ledger.
 * Each source contributes at most once to this view; historical cancelled sales need review.
 */
const fail = (message, code = 'FINANCE_INVALID', statusCode = 400) => Object.assign(new Error(message), {code, statusCode});
export const moneyAmount = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') throw fail('Enter a valid amount.');
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw fail('Enter a positive amount with up to 2 decimals.');
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0 || n > 999999999999.99) throw fail('Enter an amount above zero.');
  return n.toFixed(2);
};
export const dateOnly = (value) => {
  const s = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00.000Z`)) || new Date(`${s}T00:00:00.000Z`).toISOString().slice(0,10) !== s) throw fail('Choose a valid date.');
  return s;
};
export const cents = (value) => Math.round(Number(value || 0) * 100);
const pesos = (value) => Number((value / 100).toFixed(2));
export const validateFinanceEntry = (entry, settings) => {
  const kind = entry.kind;
  if (!['income','expense'].includes(kind)) throw fail('Choose Income or Expense.');
  const amount = moneyAmount(entry.amount);
  const transactionDate = dateOnly(entry.transaction_date);
  if (!settings?.start_date) throw fail('Finance opening balance must be set first.', 'FINANCE_NOT_CONFIGURED',409);
  if (transactionDate < String(settings.start_date).slice(0,10)) throw fail('Date is before the finance starting date.');
  if (transactionDate > new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())) throw fail('Future payments cannot be recorded.');
  const categoryId = Number(entry.category_id);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) throw fail('Choose a category.');
  const description = String(entry.description || '').trim();
  if (!description || description.length > 240) throw fail('Description is required (maximum 240 characters).');
  const notes = String(entry.notes || '').trim();
  if (notes.length > 1000) throw fail('Notes are too long.');
  return { kind, amount, transactionDate, categoryId, description, notes: notes || null };
};

export const getFinanceSettings = async (db) => {
  const [rows] = await db.query("SELECT DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date, opening_balance, includes_property_collections, set_at FROM company_finance_settings WHERE id=1 LIMIT 1");
  const row=rows[0] || null;
  if (row?.start_date instanceof Date) row.start_date=row.start_date.toISOString().slice(0,10);
  return row;
};

/** These columns are known from the October 26 TiDB backup.
 * 'Check' collections are excluded: Verified does NOT prove a cheque has cleared.
 * Network company-profit payouts are cash outflows, never extra income.
 */
export const FINANCE_ACTIVITY_SQL = `
  SELECT * FROM (
    SELECT CONCAT('manual:',t.id) AS reference, DATE_FORMAT(t.transaction_date,'%Y-%m-%d') AS txn_date, t.kind,
      t.amount AS amount, t.description AS title, c.name AS category, 'manual' AS source, t.notes AS notes
    FROM company_finance_transactions t INNER JOIN company_finance_categories c ON c.id=t.category_id
    WHERE t.status='posted'
    UNION ALL
    SELECT CONCAT('property:',p.lot_project_payment_id), DATE_FORMAT(p.lot_project_payment_date,'%Y-%m-%d'), 'income',
      p.lot_project_payment_amount, CONCAT('Property payment #',p.lot_project_payment_id), 'Property Collections', 'property', NULL
    FROM lot_project_payments p WHERE p.lot_project_payment_status='Verified' AND p.lot_project_payment_method <> 'Check'
    UNION ALL
    SELECT CONCAT('salary:',p.employee_payroll_id), DATE_FORMAT(p.released_date,'%Y-%m-%d'), 'expense',
      p.net_fund_release, CONCAT('Salary: ',COALESCE(p.employee_name_snapshot,'Employee')), 'Salary', 'salary', NULL
    FROM employee_payrolls p WHERE p.payroll_status='released' AND p.released_date IS NOT NULL
    UNION ALL
    SELECT CONCAT('commission:',r.lot_project_commission_release_id), DATE_FORMAT(r.actual_release_date,'%Y-%m-%d'), 'expense',
      r.net_release_amount, CONCAT('Commission: ',r.release_stage), 'Commissions', 'commission', NULL
    FROM lot_project_commission_releases r WHERE r.release_status='Released' AND r.actual_release_date IS NOT NULL
    UNION ALL
    SELECT CONCAT('commission:',a.source_commission_release_id), DATE_FORMAT(a.actual_release_date,'%Y-%m-%d'), 'expense',
      a.net_release_amount, CONCAT('Archived commission: ',a.release_stage), 'Commissions', 'commission_archive', NULL
    FROM lot_project_archived_commission_releases a
    WHERE NOT EXISTS (SELECT 1 FROM lot_project_commission_releases live
      WHERE live.lot_project_commission_release_id=a.source_commission_release_id AND live.release_status='Released')
    UNION ALL
    SELECT CONCAT('network:',n.id), DATE_FORMAT(n.actual_release_date,'%Y-%m-%d'), 'expense',
      n.release_amount, CONCAT('Network payout: ',COALESCE(n.payee_name,'Recipient')), 'Commissions', 'network_payout', NULL
    FROM lot_project_network_profit_releases n WHERE n.release_status='Released' AND n.actual_release_date IS NOT NULL
    UNION ALL
    SELECT CONCAT('refund:',h.lot_project_reservation_history_id), DATE_FORMAT(h.refund_date,'%Y-%m-%d'), 'expense',
      h.refund_amount, CONCAT('Property refund #',h.lot_project_reservation_history_id), 'Refunds', 'refund', NULL
    FROM lot_project_reservation_history h
    WHERE h.refund_date IS NOT NULL AND h.refund_reference IS NOT NULL AND h.refund_amount > 0
  ) activity
  WHERE activity.txn_date BETWEEN ? AND ? AND activity.amount > 0
`;

export const computeCashSummary = ({openingBalance, startDate, from, to, activities, includeProperty = true}) => {
  const start = dateOnly(startDate), end = dateOnly(to), requestedFrom = dateOnly(from);
  if (end < requestedFrom) throw fail('From date cannot be after To date.');
  const activity = activities.filter(row => String(row.txn_date).slice(0,10)>=start && String(row.txn_date).slice(0,10)<=end && (includeProperty || row.source!=='property'));
  const visibleFrom = requestedFrom > start ? requestedFrom : start;
  const net = rows => rows.reduce((sum,r)=>sum+(r.kind==='income'?cents(r.amount):-cents(r.amount)),0);
  const visible = activity.filter(r => String(r.txn_date).slice(0,10)>=visibleFrom);
  const totalIn = visible.filter(r=>r.kind==='income').reduce((s,r)=>s+cents(r.amount),0);
  const totalOut = visible.filter(r=>r.kind==='expense').reduce((s,r)=>s+cents(r.amount),0);
  const openingForRange = cents(openingBalance) + net(activity.filter(r=>String(r.txn_date).slice(0,10)<visibleFrom));
  const ending = cents(openingBalance) + net(activity);
  return {
    from: visibleFrom, to:end, opening_for_range:pesos(openingForRange),
    money_in:pesos(totalIn),money_out:pesos(totalOut),available_balance:pesos(ending),
    transactions:visible.sort((a,b)=>String(b.txn_date).localeCompare(String(a.txn_date))||String(b.reference).localeCompare(String(a.reference)))
  };
};

/** Report totals are constrained by the ledger start, but reconciliation diagnostics must
 * inspect the ENTIRE requested date range or an October 25 collection can disappear
 * behind an October 26 setup date with no explanation. */
export const summarizeSourceExclusions = ({rows, start, from, to, includeProperty}) => {
  const inRange=rows.filter(row=>row.txn_date>=from&&row.txn_date<=to);
  const before=inRange.filter(row=>row.txn_date<start);
  const excludedProperty=inRange.filter(row=>row.source==='property'&&!includeProperty&&row.txn_date>=start);
  const total=(items)=>pesos(items.reduce((sum,row)=>sum+cents(row.amount),0));
  return {
    before_start: {
      count:before.length,
      money_in:total(before.filter(row=>row.kind==='income')),
      money_out:total(before.filter(row=>row.kind==='expense')),
      property_collections:total(before.filter(row=>row.source==='property')),
      salary_paid:total(before.filter(row=>row.source==='salary')),
      commissions_paid:total(before.filter(row=>['commission','commission_archive','network_payout'].includes(row.source))),
    },
    property_excluded_by_setting:total(excludedProperty),
    property_excluded_count:excludedProperty.length,
  };
};

export const summarizeCashSources = ({transactions}) => {
  const total=(filter)=>pesos(transactions.filter(filter).reduce((sum,row)=>sum+cents(row.amount),0));
  return {
    property_collections: total(r=>r.source==='property'),
    other_income: total(r=>r.kind==='income'&&r.source!=='property'),
    salary_paid: total(r=>r.source==='salary'),
    commissions_paid: total(r=>r.source==='commission'||r.source==='commission_archive'),
    network_payouts: total(r=>r.source==='network_payout'),
    refunds_paid: total(r=>r.source==='refund'),
    other_expenses: total(r=>r.kind==='expense'&&!['salary','commission','commission_archive','network_payout','refund'].includes(r.source)),
  };
};

/** One hundred entries per page. Totals always use every transaction, never just the page. */
export const FINANCE_PAGE_SIZE = 100;
export const pageFinanceTransactions = (transactions, page = 1) => {
  const requested = Number(page);
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > 1_000_000) {
    throw fail('Choose a valid transactions page.');
  }
  const total = transactions.length;
  const pages = Math.max(1, Math.ceil(total / FINANCE_PAGE_SIZE));
  const current = Math.min(requested, pages);
  const offset = (current - 1) * FINANCE_PAGE_SIZE;
  return {
    transactions: transactions.slice(offset, offset + FINANCE_PAGE_SIZE),
    total_records: total,
    page: current,
    page_size: FINANCE_PAGE_SIZE,
    total_pages: pages,
    range_start: total ? offset + 1 : 0,
    range_end: Math.min(total, offset + FINANCE_PAGE_SIZE),
  };
};

/** Export every matching record, not only the currently displayed 100. */
export const buildFinanceCsv = (transactions) => {
  const cell = (value, numeric = false) => {
    const original = String(value ?? '');
    // Prevent Excel/LibreOffice formula interpretation of user-supplied names.
    const safe = !numeric && /^[\s\uFEFF]*[=+@\-]/.test(original) ? `'${original}` : original;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const lines = [[ 'Name', 'Type', 'Category', 'Entry', 'Date', 'Amount (PHP)', 'Reference' ].map(cell).join(',')];
  for (const tx of transactions) {
    const amount = (tx.kind === 'income' ? 1 : -1) * cents(tx.amount) / 100;
    lines.push([
      tx.title, tx.kind === 'income' ? 'Income' : 'Expense', tx.category,
      tx.source === 'manual' ? 'Manual' : 'Automatic', tx.txn_date,
      amount.toFixed(2), tx.reference,
    ].map((value,index)=>cell(value,index===5)).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
};

export const loadFinanceSummary = async (connection, {from,to,page=1,allTransactions=false}) => {
  const settings = await getFinanceSettings(connection);
  if (!settings?.start_date || settings.opening_balance===null) return {configured:false,reason:'Set the opening balance and starting date to see available cash.'};
  const start = String(settings.start_date).slice(0,10), end=dateOnly(to), requestedFrom=dateOnly(from||start);
  if(requestedFrom>end) throw fail('From date cannot be after To date.');
  // Query earlier requested activity for *disclosure only*; never silently count it
  // a second time when the saved opening balance may already include it.
  const [rows] = await connection.query(FINANCE_ACTIVITY_SQL,[requestedFrom<start?requestedFrom:start,end]);
  const includeProperty=Number(settings.includes_property_collections)===1;
  const summary = computeCashSummary({openingBalance:settings.opening_balance,startDate:start,from:requestedFrom,to:end,activities:rows,includeProperty});
  const exclusions=summarizeSourceExclusions({rows,start,from:requestedFrom,to:end,includeProperty});
  const sources=summarizeCashSources({transactions:summary.transactions});
  const [checks] = await connection.query(`SELECT
    (SELECT COUNT(*) FROM lot_project_cancelled_sale_archives WHERE archived_at >= ? AND archived_at < DATE_ADD(?,INTERVAL 1 DAY)) AS cancelled_archives,
    (SELECT COUNT(*) FROM lot_project_payments WHERE lot_project_payment_method='Check' AND lot_project_payment_status='Verified' AND lot_project_payment_date BETWEEN ? AND ?) AS unconfirmed_checks,
    (SELECT COUNT(*) FROM employee_cash_advances WHERE cash_advance_status IN ('active','paid') AND request_date BETWEEN ? AND ?) AS cash_advances_to_review,
    (SELECT COUNT(*) FROM lot_project_reservation_history WHERE refund_amount > 0 AND (refund_date IS NULL OR refund_reference IS NULL) AND cancelled_at BETWEEN ? AND ?) AS refunds_to_review`,
    [start,end,start,end,start,end,start,end]);
  const check=checks[0]||{};
  const warnings=[];
  if(exclusions.before_start.count>0) warnings.push(`${exclusions.before_start.count} transaction(s) within the selected dates are before the Finance Starting Date (${start}), including ₱${exclusions.before_start.property_collections.toFixed(2)} in property collections. They may already be included in the opening balance. Review the starting date and balance to avoid counting them twice.`);
  if(exclusions.property_excluded_count>0) warnings.push(`Property collections of ₱${exclusions.property_excluded_by_setting.toFixed(2)} are excluded because the Include Property Collections setting is off.`);
  if(Number(check.cancelled_archives)>0) warnings.push('Cancelled sale archives contain older payment history. Confirm archived collections are included before relying on this balance.');
  if(Number(check.unconfirmed_checks)>0) warnings.push('Check payments are excluded until clearing can be verified.');
  if(Number(check.cash_advances_to_review)>0) warnings.push('Employee cash advances require manual reconciliation; request date does not prove payout date.');
  if(Number(check.refunds_to_review)>0) warnings.push('Some cancellation refunds have no recorded payment date or reference. Confirm payouts before relying on this balance.');
  const pagination = pageFinanceTransactions(summary.transactions, page);
  return {configured:true,start_date:start,opening_balance:Number(settings.opening_balance),includes_property_collections:includeProperty,exclusions,sources,...summary,
    ...pagination,transactions:allTransactions?summary.transactions:pagination.transactions,
    warnings, balance_verified:warnings.length===0};
};

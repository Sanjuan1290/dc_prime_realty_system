// Import snapshots store only the columns that Excel import actually overwrites.
// This allows a safe reversal without touching other independently managed fields.
export const IMPORT_USER_COLUMNS = Object.freeze([
  'first_name', 'last_name', 'middle_name', 'contact_no', 'tin_no', 'prc_no', 'status',
]);
export const IMPORT_SELLER_COLUMNS = Object.freeze([
  'seller_group_id', 'accredited_seller_reports_under_user_id',
  'accredited_seller_accreditation_date', 'accredited_seller_status',
]);

export const snapshotImportFields = (row, columns) => row
  ? Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))
  : null;

const normalized = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|\s)/.test(value)) return value.slice(0, 10);
  return value == null ? null : value;
};

export const sameImportFields = (actual, expected, columns) => !!actual && !!expected
  && columns.every((column) => normalized(actual[column]) === normalized(expected[column]));

export const importUndoBlockMessage = ({ sales = 0, changed = false, reports = 0, usage = false } = {}) => {
  if (sales) return `${sales} imported member${sales === 1 ? ' has' : 's have'} sales, commission, or historical release records. This entire import cannot be undone.`;
  if (changed) return 'One or more imported member records have changed since this import. Undo is blocked to protect newer changes.';
  if (reports) return 'Members added outside this import now report to an imported account. Undo is blocked to protect their reporting hierarchy.';
  if (usage) return 'Imported accounts have other activity or linked records. Undo is blocked to prevent data loss.';
  return '';
};

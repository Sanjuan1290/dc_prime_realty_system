// Staging HR audit adapter. Maps legacy controller events to HR-owned audit history.
const confidential = /(password|token|secret|cookie|signature|bank|pin|account_number|otp)/i;
const redact = (value, key = '') => {
  if (confidential.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(v => redact(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,redact(v,k)]));
  return value;
};
export const writeAuditLog = async (connection, req, entry = {}) => {
  const actor = req?.authUser ?? entry.actor ?? null;
  const actorId = actor?.id ?? null;
  const data = { title:entry.title ?? null, description:entry.description ?? null, entityLabel:entry.entityLabel ?? null, metadata:redact(entry.metadata ?? null) };
  await connection.query(`INSERT INTO hr_audit_logs (hr_user_id, actor_name_snapshot, action, module, entity_type, entity_id, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [actorId, entry.actorName ?? actor?.displayName ?? 'System', entry.action ?? 'system', entry.module ?? 'HR', entry.entityType ?? null, entry.entityId ?? null, JSON.stringify(data)]);
};

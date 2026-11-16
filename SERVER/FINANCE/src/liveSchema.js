// Additive, idempotent upgrade. Existing passwords and sessions remain valid.
export async function ensureInvitationSchema(pool){
  const [columns]=await pool.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_users'");
  const names=new Set(columns.map(c=>c.COLUMN_NAME));
  const additions=[['must_change_password','TINYINT NOT NULL DEFAULT 0'],['temporary_password_expires_at','DATETIME NULL'],['invitation_sent_at','DATETIME NULL']].filter(([name])=>!names.has(name));
  if(additions.length)await pool.execute('ALTER TABLE finance_users '+additions.map(([name,type])=>`ADD COLUMN ${name} ${type}`).join(', '));
}

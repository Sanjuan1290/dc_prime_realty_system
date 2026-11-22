import {ensurePasswordRecoverySchema} from './passwordRecovery.js';
// Additive, idempotent upgrade. Existing passwords and sessions remain valid.
export async function ensureInvitationSchema(pool){
  const [columns]=await pool.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_users'");
  const names=new Set(columns.map(c=>c.COLUMN_NAME));
  const additions=[['must_change_password','TINYINT NOT NULL DEFAULT 0'],['temporary_password_expires_at','DATETIME NULL'],['invitation_sent_at','DATETIME NULL']].filter(([name])=>!names.has(name));
  if(additions.length)await pool.execute('ALTER TABLE finance_users '+additions.map(([name,type])=>`ADD COLUMN ${name} ${type}`).join(', '));
}

export async function ensureImportSchema(pool){
  const [columns]=await pool.execute("SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('finance_import_batches','finance_import_items','finance_categories','finance_import_mutex')");
  const column=(table,name)=>columns.find(c=>c.TABLE_NAME===table&&c.COLUMN_NAME===name);
  const batchChanges=[];
  if(!String(column('finance_import_batches','file_format')?.COLUMN_TYPE).includes("'csv'"))batchChanges.push("MODIFY COLUMN file_format ENUM('zip','xlsx','csv') NOT NULL");
  if(!String(column('finance_import_batches','status')?.COLUMN_TYPE).includes("'undone'"))batchChanges.push("MODIFY COLUMN status ENUM('preview','committed','rejected','undone') NOT NULL DEFAULT 'preview'");
  for(const [name,type] of [['undone_by','BIGINT UNSIGNED NULL'],['undone_at','DATETIME NULL'],['undo_reason','VARCHAR(500) NULL'],['undo_result_json','JSON NULL']])if(!column('finance_import_batches',name))batchChanges.push(`ADD COLUMN ${name} ${type}`);
  if(batchChanges.length)await pool.execute('ALTER TABLE finance_import_batches '+batchChanges.join(', '));
  if(!String(column('finance_import_items','decision')?.COLUMN_TYPE).includes("'restore'"))await pool.execute("ALTER TABLE finance_import_items MODIFY COLUMN decision ENUM('new','restore','duplicate','conflict','unmapped','imported') NOT NULL");
  if(Number(column('finance_categories','name')?.CHARACTER_MAXIMUM_LENGTH)<200)await pool.execute('ALTER TABLE finance_categories MODIFY COLUMN name VARCHAR(200) NOT NULL');
  if(!column('finance_import_mutex','id'))await pool.execute('CREATE TABLE IF NOT EXISTS finance_import_mutex (id TINYINT UNSIGNED NOT NULL PRIMARY KEY)');
  await pool.execute('INSERT IGNORE INTO finance_import_mutex(id) VALUES(1)');
  await pool.execute(`CREATE TABLE IF NOT EXISTS finance_import_undo_authorizations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    batch_id CHAR(36) NOT NULL,
    admin_user_id BIGINT UNSIGNED NOT NULL,
    review_token_hash CHAR(64) NOT NULL,
    code_salt CHAR(32) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_finance_undo_auth_user_batch_created (admin_user_id,batch_id,created_at),
    KEY idx_finance_undo_auth_batch_actor (batch_id,admin_user_id,consumed_at,expires_at),
    CONSTRAINT fk_finance_undo_auth_batch FOREIGN KEY (batch_id) REFERENCES finance_import_batches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_finance_undo_auth_admin FOREIGN KEY (admin_user_id) REFERENCES finance_users(id) ON DELETE RESTRICT
  )`);
}
export async function ensureFinanceSchema(pool){await ensureInvitationSchema(pool);await ensureImportSchema(pool);await ensurePasswordRecoverySchema(pool);}

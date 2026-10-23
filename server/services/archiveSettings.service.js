// Ensure the singleton archive settings row exists after the archive management migration.
// INSERT IGNORE is deliberately limited to an absent singleton: saved policy is never reset.
const settingsError = (message, code) =>
  Object.assign(new Error(message), { statusCode: 503, code });

export const ensureArchiveSettings = async (connection) => {
  const [[schema]] = await connection.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('audit_archive_settings','audit_archive_holds','audit_archive_purge_codes','audit_archive_purge_receipts')"
  );
  if (Number(schema?.n || 0) !== 4) {
    throw settingsError(
      'Archive Management needs its database update. Apply the 20261018 audit archive management migration.',
      'ARCHIVE_MIGRATION_REQUIRED'
    );
  }

  const selectSettings = () => connection.query(
    'SELECT archive_days,auto_delete_enabled FROM audit_archive_settings WHERE id=1'
  );
  let [rows] = await selectSettings();
  if (!rows.length) {
    // A partially applied migration may create the table but omit its seed row.
    // Recover without replacing settings that another request may have saved.
    await connection.query(
      'INSERT IGNORE INTO audit_archive_settings(id,archive_days,auto_delete_enabled) VALUES(1,180,0)'
    );
    [rows] = await selectSettings();
  }
  if (!rows.length) {
    throw settingsError(
      'Archive settings could not be initialized. Check the archive management migration.',
      'ARCHIVE_SETTINGS_NOT_INITIALIZED'
    );
  }
  return {
    archiveDays: Number(rows[0].archive_days),
    autoDeleteEnabled: Boolean(rows[0].auto_delete_enabled),
  };
};

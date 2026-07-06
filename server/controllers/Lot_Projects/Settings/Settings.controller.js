import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getAuthenticatedUser,
  toNullable,
} from '../_shared/lotProject.shared.js';

const toDay = (value, fallback) => {
  const number = Number(value || fallback);
  if (!Number.isInteger(number) || number < 1 || number > 31) return fallback;
  return number;
};

const mapSettings = (row = {}, project = {}) => ({
  id: row.lot_project_setting_id || null,
  lotProjectId: project.lot_project_id,
  releaseDayOne: String(row.release_day_one || 7),
  releaseDayTwo: String(row.release_day_two || 22),
  reservationContactName: row.reservation_contact_name || project.lot_project_administrator_name || 'D&C Prime Realty',
  reservationContactEmail: row.reservation_contact_email || '',
  reservationContactNumber: row.reservation_contact_number || '',
  companyName: row.company_name || 'D&C Prime Realty',
  companyEmail: row.company_email || '',
  companyContactNumber: row.company_contact_number || '',
  createdAt: row.lot_project_setting_created_at || null,
  updatedAt: row.lot_project_setting_updated_at || null,
});

const getOrCreateSettingsRow = async (connection, project) => {
  const [rows] = await connection.query(
    `
      SELECT *
      FROM lot_project_settings
      WHERE lot_project_id = ?
      LIMIT 1
    `,
    [project.lot_project_id]
  );

  if (rows[0]) return rows[0];

  await connection.query(
    `
      INSERT INTO lot_project_settings (
        lot_project_id,
        release_day_one,
        release_day_two,
        reservation_contact_name,
        reservation_contact_email,
        reservation_contact_number,
        company_name,
        company_email,
        company_contact_number
      ) VALUES (?, 7, 22, ?, NULL, NULL, 'D&C Prime Realty', NULL, NULL)
    `,
    [project.lot_project_id, project.lot_project_administrator_name || 'D&C Prime Realty']
  );

  const [createdRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_settings
      WHERE lot_project_id = ?
      LIMIT 1
    `,
    [project.lot_project_id]
  );

  return createdRows[0] || {};
};

export const getLotProjectSettings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    if (!(await tableExists(connection, 'lot_project_settings'))) {
      return res.status(500).json({ success: false, message: 'lot_project_settings table does not exist.' });
    }

    const currentUser = await getAuthenticatedUser(req);
    const settings = await getOrCreateSettingsRow(connection, project);

    return res.json({
      success: true,
      data: mapSettings(settings, project),
      canEdit: currentUser?.role === 'super_admin',
      project: {
        id: project.lot_project_id,
        name: project.lot_project_name,
        slug: project.lot_project_slug,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateLotProjectSettings = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Lot project not found.' });
    }

    if (!(await tableExists(connection, 'lot_project_settings'))) {
      return res.status(500).json({ success: false, message: 'lot_project_settings table does not exist.' });
    }

    const currentUser = await getAuthenticatedUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'Please login before updating settings.' });
    }

    if (currentUser.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only super admin can update release days and project settings.' });
    }

    const releaseDayOne = toDay(req.body.releaseDayOne ?? req.body.release_day_one, 7);
    const releaseDayTwo = toDay(req.body.releaseDayTwo ?? req.body.release_day_two, 22);

    if (releaseDayOne === releaseDayTwo) {
      return res.status(400).json({ success: false, message: 'Release days must be different.' });
    }

    await connection.query(
      `
        INSERT INTO lot_project_settings (
          lot_project_id,
          release_day_one,
          release_day_two,
          reservation_contact_name,
          reservation_contact_email,
          reservation_contact_number,
          company_name,
          company_email,
          company_contact_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          release_day_one = VALUES(release_day_one),
          release_day_two = VALUES(release_day_two),
          reservation_contact_name = VALUES(reservation_contact_name),
          reservation_contact_email = VALUES(reservation_contact_email),
          reservation_contact_number = VALUES(reservation_contact_number),
          company_name = VALUES(company_name),
          company_email = VALUES(company_email),
          company_contact_number = VALUES(company_contact_number)
      `,
      [
        project.lot_project_id,
        releaseDayOne,
        releaseDayTwo,
        toNullable(req.body.reservationContactName),
        toNullable(req.body.reservationContactEmail),
        toNullable(req.body.reservationContactNumber),
        toNullable(req.body.companyName),
        toNullable(req.body.companyEmail),
        toNullable(req.body.companyContactNumber),
      ]
    );

    const settings = await getOrCreateSettingsRow(connection, project);

    return res.json({
      success: true,
      message: 'Project settings saved successfully.',
      data: mapSettings(settings, project),
      canEdit: true,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

import { db } from '../../db/connect.js';
import { compareSecrets } from '../../services/salaryEventContract.js';
import { recordSalaryEvent } from '../../services/externalSalaryEvents.service.js';

export const receiveSalaryEvent = async (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.REALTY_HR_STAGING_ONLY !== 'true' || process.env.REALTY_HR_SALARY_INGEST !== 'true') return res.status(503).json({ code: 'HR_SALARY_TRANSFER_DISABLED' });
  const expected = process.env.REALTY_HR_INTEGRATION_TOKEN;
  const header = req.headers.authorization || '';
  if (!compareSecrets(header.startsWith('Bearer ') ? header.slice(7) : '', expected)) return res.status(401).json({ code: 'HR_INTEGRATION_UNAUTHORIZED' });
  try {
    const result = await recordSalaryEvent(db, req.body);
    return res.status(200).json({ success: true, ...result });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ code: e.code, message: e.message });
    console.error('[salary-event] receiving event failed:', e.code || e.message);
    return res.status(503).json({ code: 'HR_SALARY_TRANSFER_FAILED' });
  }
};

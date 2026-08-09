import crypto from 'node:crypto';
import { db } from '../../../db/connect.js';
import { writeAuditLog } from '../auditLogs.controller.js';
import { runExistingConnectionTransactionWithRetry } from '../../../utils/transactionRetry.js';
import {
  buildEmployeeNameSql,
  cleanText,
  dateOnly,
  ensureEmployeeModuleTables,
  nullableText,
  positiveNumber,
  roundMoney,
} from './employeeModule.shared.js';

const statuses = new Set(['pending', 'approved', 'active', 'paid', 'rejected', 'cancelled']);
const getErrorMessage = (error) => error?.message || 'Employee cash advance operation failed.';

// These columns remain in older databases only for backward compatibility.
// The public API now exposes the automatic next-release deduction workflow instead.
const omitLegacyRepaymentFields = (row = {}) => {
  const { installment_count, deduction_per_payroll, start_deduction_date, ...publicRow } = row;
  return publicRow;
};

const createReferenceFromId = (advanceId, requestDate) => {
  const cleanDate = dateOnly(requestDate) || new Date().toISOString().slice(0, 10);
  return `ECA-${cleanDate.replace(/-/g, '')}-${String(Number(advanceId || 0)).padStart(6, '0')}`;
};

const normalizePayload = (body = {}) => ({
  employeeId: Number(body.employee_id || 0),
  requestDate: dateOnly(body.request_date),
  amount: roundMoney(positiveNumber(body.amount)),
  notes: nullableText(body.notes),
});

export const getEmployeeCashAdvances = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const offset = (page - 1) * limit;
    const search = cleanText(req.query.search);
    const status = cleanText(req.query.status, 'all');
    const employeeId = Number(req.query.employeeId || 0);
    const where = ['1 = 1'];
    const params = [];
    if (search) {
      const keyword = `%${search}%`;
      where.push(`(${buildEmployeeNameSql('e')} LIKE ? OR e.employee_code LIKE ? OR ca.reference_number LIKE ?)`);
      params.push(keyword, keyword, keyword);
    }
    if (status !== 'all') {
      where.push('ca.cash_advance_status = ?');
      params.push(status);
    }
    if (employeeId) {
      where.push('ca.employee_id = ?');
      params.push(employeeId);
    }

    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM employee_cash_advances ca INNER JOIN employees e ON e.employee_id = ca.employee_id WHERE ${where.join(' AND ')}`, params);
    const total = Number(countRows[0]?.total || 0);
    const [rows] = await connection.query(
      `
        SELECT ca.*, e.employee_code, ${buildEmployeeNameSql('e')} AS full_name,
          e.department, e.position,
          TRIM(CONCAT_WS(' ', approver.first_name, approver.middle_name, approver.last_name)) AS approved_by_name,
          COALESCE((SELECT SUM(d.amount) FROM employee_cash_advance_deductions d WHERE d.employee_cash_advance_id = ca.employee_cash_advance_id), 0) AS total_deducted
        FROM employee_cash_advances ca
        INNER JOIN employees e ON e.employee_id = ca.employee_id
        LEFT JOIN users approver ON approver.id = ca.approved_by_user_id
        WHERE ${where.join(' AND ')}
        ORDER BY FIELD(ca.cash_advance_status, 'pending','approved','active','paid','rejected','cancelled'), ca.request_date DESC, ca.employee_cash_advance_id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );
    const [summaryRows] = await connection.query(`
      SELECT
        COUNT(*) AS total,
        SUM(cash_advance_status = 'pending') AS pending,
        SUM(cash_advance_status IN ('approved','active')) AS active,
        SUM(cash_advance_status = 'paid') AS paid,
        COALESCE(SUM(CASE WHEN cash_advance_status IN ('approved','active') THEN remaining_balance ELSE 0 END), 0) AS outstanding_balance,
        COALESCE(SUM(amount - remaining_balance), 0) AS total_deducted
      FROM employee_cash_advances
    `);
    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...omitLegacyRepaymentFields(row),
        amount: Number(row.amount || 0),
        remaining_balance: Number(row.remaining_balance || 0),
        total_deducted: Number(row.total_deducted || 0),
      })),
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        pending: Number(summaryRows[0]?.pending || 0),
        active: Number(summaryRows[0]?.active || 0),
        paid: Number(summaryRows[0]?.paid || 0),
        outstandingBalance: Number(summaryRows[0]?.outstanding_balance || 0),
        totalDeducted: Number(summaryRows[0]?.total_deducted || 0),
      },
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getEmployeeCashAdvance = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const advanceId = Number(req.params.advanceId);
    const [rows] = await connection.query(
      `SELECT ca.*, e.employee_code, ${buildEmployeeNameSql('e')} AS full_name, e.department, e.position FROM employee_cash_advances ca INNER JOIN employees e ON e.employee_id = ca.employee_id WHERE ca.employee_cash_advance_id = ? LIMIT 1`,
      [advanceId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Employee cash advance not found.' });
    const [deductions] = await connection.query(
      `SELECT d.*, p.employee_payroll_period_id, pp.period_label FROM employee_cash_advance_deductions d LEFT JOIN employee_payrolls p ON p.employee_payroll_id = d.employee_payroll_id LEFT JOIN employee_payroll_periods pp ON pp.employee_payroll_period_id = p.employee_payroll_period_id WHERE d.employee_cash_advance_id = ? ORDER BY d.deduction_date DESC, d.employee_cash_advance_deduction_id DESC`,
      [advanceId]
    );
    return res.json({ success: true, data: { ...omitLegacyRepaymentFields(rows[0]), deductions } });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createEmployeeCashAdvance = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const payload = normalizePayload(req.body);
    if (!payload.employeeId || !payload.requestDate || payload.amount <= 0) {
      return res.status(400).json({ message: 'Employee, request date, and advance amount are required.' });
    }

    const result = await runExistingConnectionTransactionWithRetry(connection, async (tx) => {
      const [employeeRows] = await tx.query(
        `SELECT employee_code, ${buildEmployeeNameSql('employees')} AS full_name FROM employees WHERE employee_id = ? AND employee_status <> 'archived' LIMIT 1`,
        [payload.employeeId]
      );
      if (!employeeRows[0]) {
        throw Object.assign(new Error('Employee not found.'), { statusCode: 404 });
      }

      // Never derive a financial reference from COUNT(*). Use a temporary unique
      // value for the insert, then replace it with a deterministic primary-key reference.
      const temporaryReference = `TMP-ECA-${crypto.randomUUID()}`;
      const [insertResult] = await tx.query(
        `
          INSERT INTO employee_cash_advances (
            employee_id, reference_number, request_date, amount, installment_count, deduction_per_payroll,
            start_deduction_date, remaining_balance, cash_advance_status, notes, created_by_user_id, updated_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        `,
        [
          payload.employeeId,
          temporaryReference,
          payload.requestDate,
          payload.amount,
          1,
          payload.amount,
          payload.requestDate,
          payload.amount,
          payload.notes,
          req.authUser?.id || null,
          req.authUser?.id || null,
        ]
      );

      const advanceId = Number(insertResult.insertId || 0);
      if (!advanceId) throw new Error('Employee cash advance was not created.');
      const reference = createReferenceFromId(advanceId, payload.requestDate);

      const [referenceUpdate] = await tx.query(
        'UPDATE employee_cash_advances SET reference_number = ? WHERE employee_cash_advance_id = ?',
        [reference, advanceId]
      );
      if (referenceUpdate.affectedRows !== 1) throw new Error('Employee cash advance reference was not finalized.');

      await writeAuditLog(tx, req, {
        actor: req.authUser,
        action: 'create',
        module: 'Employee Cash Advances',
        entityType: 'employee_cash_advance',
        entityId: String(advanceId),
        entityLabel: reference,
        title: 'Created employee cash advance request',
        description: `Created ${reference} for ${employeeRows[0].full_name}.`,
        metadata: { employeeId: payload.employeeId, amount: payload.amount, deductionMode: 'next_salary_release' },
      });

      return { advanceId, reference };
    }, { label: 'Create employee cash advance' });

    return res.status(201).json({
      success: true,
      message: 'Employee cash advance request added.',
      advanceId: result.advanceId,
      referenceNumber: result.reference,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateEmployeeCashAdvance = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const advanceId = Number(req.params.advanceId);
    const payload = normalizePayload(req.body);
    if (!payload.employeeId || !payload.requestDate || payload.amount <= 0) {
      return res.status(400).json({ message: 'Employee, request date, and advance amount are required.' });
    }

    await runExistingConnectionTransactionWithRetry(connection, async (tx) => {
      const [rows] = await tx.query(
        'SELECT * FROM employee_cash_advances WHERE employee_cash_advance_id = ? LIMIT 1 FOR UPDATE',
        [advanceId]
      );
      const advance = rows[0];
      if (!advance) throw Object.assign(new Error('Employee cash advance not found.'), { statusCode: 404 });
      if (advance.cash_advance_status !== 'pending') {
        throw Object.assign(new Error('Only pending cash advances can be edited.'), { statusCode: 409 });
      }

      const [employeeRows] = await tx.query(
        'SELECT employee_id FROM employees WHERE employee_id = ? AND employee_status <> \'archived\' LIMIT 1',
        [payload.employeeId]
      );
      if (!employeeRows[0]) throw Object.assign(new Error('Employee not found.'), { statusCode: 404 });

      const [updateResult] = await tx.query(
        `UPDATE employee_cash_advances
         SET employee_id = ?, request_date = ?, amount = ?, installment_count = ?, deduction_per_payroll = ?,
             start_deduction_date = ?, remaining_balance = ?, notes = ?, updated_by_user_id = ?
         WHERE employee_cash_advance_id = ? AND cash_advance_status = 'pending'`,
        [
          payload.employeeId,
          payload.requestDate,
          payload.amount,
          1,
          payload.amount,
          payload.requestDate,
          payload.amount,
          payload.notes,
          req.authUser?.id || null,
          advanceId,
        ]
      );
      if (updateResult.affectedRows !== 1) {
        throw Object.assign(new Error('Cash advance changed while it was being edited. Please retry.'), { statusCode: 409 });
      }

      await writeAuditLog(tx, req, {
        actor: req.authUser,
        action: 'update',
        module: 'Employee Cash Advances',
        entityType: 'employee_cash_advance',
        entityId: String(advanceId),
        entityLabel: advance.reference_number,
        title: 'Updated employee cash advance request',
        description: `Updated ${advance.reference_number}.`,
        metadata: { amount: payload.amount, deductionMode: 'next_salary_release' },
      });
    }, { label: 'Update employee cash advance' });

    return res.json({ success: true, message: 'Employee cash advance saved.' });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

const changeStatus = async (req, res, nextStatus) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const advanceId = Number(req.params.advanceId);
    const result = await runExistingConnectionTransactionWithRetry(connection, async (tx) => {
      const [rows] = await tx.query(
        `SELECT ca.*, e.employee_code, ${buildEmployeeNameSql('e')} AS full_name
         FROM employee_cash_advances ca
         INNER JOIN employees e ON e.employee_id = ca.employee_id
         WHERE ca.employee_cash_advance_id = ?
         LIMIT 1 FOR UPDATE`,
        [advanceId]
      );
      const advance = rows[0];
      if (!advance) throw Object.assign(new Error('Employee cash advance not found.'), { statusCode: 404 });

      const currentStatus = advance.cash_advance_status;
      const storedStatus = nextStatus === 'approved' ? 'active' : nextStatus;
      if (currentStatus === storedStatus) {
        return { storedStatus, alreadyApplied: true };
      }

      const allowed = {
        approved: ['pending'],
        rejected: ['pending'],
        cancelled: ['pending', 'approved', 'active'],
      };
      if (!allowed[nextStatus]?.includes(currentStatus)) {
        throw Object.assign(new Error(`A ${currentStatus} cash advance cannot be changed to ${nextStatus}.`), { statusCode: 409 });
      }
      if (nextStatus === 'cancelled' && Number(advance.remaining_balance) < Number(advance.amount)) {
        throw Object.assign(new Error('This cash advance already has deductions and cannot be cancelled.'), { statusCode: 409 });
      }

      const [updateResult] = await tx.query(
        `UPDATE employee_cash_advances
         SET cash_advance_status = ?,
             approved_by_user_id = ?,
             approved_at = ?,
             start_deduction_date = CASE WHEN ? = 'approved' THEN CURRENT_DATE ELSE start_deduction_date END,
             deduction_per_payroll = CASE WHEN ? = 'approved' THEN remaining_balance ELSE deduction_per_payroll END,
             installment_count = 1,
             updated_by_user_id = ?
         WHERE employee_cash_advance_id = ? AND cash_advance_status = ?`,
        [
          storedStatus,
          nextStatus === 'approved' ? req.authUser?.id || null : advance.approved_by_user_id,
          nextStatus === 'approved' ? new Date() : advance.approved_at,
          nextStatus,
          nextStatus,
          req.authUser?.id || null,
          advanceId,
          currentStatus,
        ]
      );
      if (updateResult.affectedRows !== 1) {
        throw Object.assign(new Error('Cash advance status changed while it was being updated. Please retry.'), { statusCode: 409 });
      }

      await writeAuditLog(tx, req, {
        actor: req.authUser,
        action: 'update',
        module: 'Employee Cash Advances',
        entityType: 'employee_cash_advance',
        entityId: String(advanceId),
        entityLabel: advance.reference_number,
        title: `${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)} employee cash advance`,
        description: `${advance.reference_number} for ${advance.full_name} changed from ${currentStatus} to ${storedStatus}.`,
        metadata: { previousStatus: currentStatus, status: storedStatus },
      });

      return { storedStatus, alreadyApplied: false };
    }, { label: 'Change employee cash advance status' });

    return res.json({
      success: true,
      message: result.alreadyApplied ? `Employee cash advance is already ${result.storedStatus}.` : `Employee cash advance ${nextStatus}.`,
      status: result.storedStatus,
      alreadyApplied: result.alreadyApplied,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const approveEmployeeCashAdvance = (req, res) => changeStatus(req, res, 'approved');
export const rejectEmployeeCashAdvance = (req, res) => changeStatus(req, res, 'rejected');
export const cancelEmployeeCashAdvance = (req, res) => changeStatus(req, res, 'cancelled');

const normalizeRequestKey = (value) => {
  const key = String(value || '').trim();
  return key ? key.slice(0, 80) : null;
};

export const recordEmployeeCashAdvanceDeduction = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await ensureEmployeeModuleTables(connection);
    const advanceId = Number(req.params.advanceId);
    const amount = roundMoney(positiveNumber(req.body.amount));
    const deductionDate = dateOnly(req.body.deduction_date);
    const requestKey = normalizeRequestKey(
      req.body.requestKey || req.body.request_key || req.get?.('Idempotency-Key')
    );
    if (amount <= 0 || !deductionDate) {
      return res.status(400).json({ message: 'Deduction date and amount are required.' });
    }

    const result = await runExistingConnectionTransactionWithRetry(connection, async (tx) => {
      const [rows] = await tx.query(
        'SELECT * FROM employee_cash_advances WHERE employee_cash_advance_id = ? FOR UPDATE',
        [advanceId]
      );
      const advance = rows[0];
      if (!advance) throw Object.assign(new Error('Employee cash advance not found.'), { statusCode: 404 });

      if (requestKey) {
        const [existingRows] = await tx.query(
          `SELECT * FROM employee_cash_advance_deductions
           WHERE employee_cash_advance_id = ? AND request_key = ?
           LIMIT 1 FOR UPDATE`,
          [advanceId, requestKey]
        );
        const existing = existingRows[0];
        if (existing) {
          if (roundMoney(existing.amount) !== amount || dateOnly(existing.deduction_date) !== deductionDate) {
            throw Object.assign(new Error('This deduction request key was already used for different values.'), { statusCode: 409 });
          }
          return {
            remainingBalance: Number(existing.remaining_balance_after || 0),
            deductionId: Number(existing.employee_cash_advance_deduction_id),
            alreadyApplied: true,
          };
        }
      }

      if (!['approved', 'active'].includes(advance.cash_advance_status)) {
        throw Object.assign(new Error('Only active cash advances can receive deductions.'), { statusCode: 409 });
      }
      if (amount > Number(advance.remaining_balance || 0)) {
        throw Object.assign(new Error('Deduction cannot exceed the remaining balance.'), { statusCode: 400 });
      }

      const remaining = roundMoney(Number(advance.remaining_balance) - amount);
      const [advanceUpdate] = await tx.query(
        `UPDATE employee_cash_advances
         SET remaining_balance = ?, cash_advance_status = ?, updated_by_user_id = ?
         WHERE employee_cash_advance_id = ? AND remaining_balance = ?`,
        [remaining, remaining <= 0 ? 'paid' : 'active', req.authUser?.id || null, advanceId, advance.remaining_balance]
      );
      if (advanceUpdate.affectedRows !== 1) {
        throw Object.assign(new Error('Cash advance balance changed while the deduction was being recorded. Please retry.'), { statusCode: 409 });
      }

      const [deductionResult] = await tx.query(
        `INSERT INTO employee_cash_advance_deductions
          (employee_cash_advance_id, deduction_date, amount, remaining_balance_after, notes, request_key, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [advanceId, deductionDate, amount, remaining, nullableText(req.body.notes), requestKey, req.authUser?.id || null]
      );

      await writeAuditLog(tx, req, {
        actor: req.authUser,
        action: 'create',
        module: 'Employee Cash Advances',
        entityType: 'employee_cash_advance_deduction',
        entityId: String(deductionResult.insertId || advanceId),
        entityLabel: advance.reference_number,
        title: 'Recorded employee cash advance deduction',
        description: `Recorded a ${amount.toFixed(2)} deduction for ${advance.reference_number}.`,
        metadata: { amount, remaining, requestKey },
      });

      return {
        remainingBalance: remaining,
        deductionId: Number(deductionResult.insertId || 0),
        alreadyApplied: false,
      };
    }, { label: 'Record employee cash advance deduction' });

    return res.json({
      success: true,
      message: result.alreadyApplied ? 'Cash advance deduction was already recorded.' : 'Cash advance deduction recorded.',
      remainingBalance: result.remainingBalance,
      deductionId: result.deductionId,
      alreadyApplied: result.alreadyApplied,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


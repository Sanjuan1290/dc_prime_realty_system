import { db } from '../db/connect.js';
import {
  columnExists,
  refreshListingPenaltyCache,
  tableExists,
  todayDateOnly,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

const DAILY_PENALTY_JOB_NAME = 'daily_penalty_refresh';
const SCHEDULER_STATE_TABLE = 'system_scheduled_job_state';
const MANILA_UTC_OFFSET = '+08:00';
const DAILY_RUN_TIME = '00:05:00';
const STARTUP_DELAY_MS = 5_000;
const RETRY_DELAY_MS = 15 * 60 * 1000;
const RUN_LOCK_HOURS = 2;

const cleanDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return new Date(value).toISOString().slice(0, 10);
};

const addOneCalendarDay = (dateOnly) => {
  const [year, month, day] = String(dateOnly).split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
};

export const getNextDailyPenaltyRunAt = (now = new Date()) => {
  const manilaToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const nextManilaDate = addOneCalendarDay(manilaToday);
  return new Date(`${nextManilaDate}T${DAILY_RUN_TIME}${MANILA_UTC_OFFSET}`);
};

export const refreshDailyPenaltyCaches = async () => {
  const connection = await db.getConnection();

  try {
    if (!(await tableExists(connection, 'lot_project_payment_schedules'))) return { refreshed: 0 };
    if (!(await tableExists(connection, 'lot_project_client_profiles'))) return { refreshed: 0 };
    if (!(await columnExists(connection, 'lot_project_client_profiles', 'soa_penalty_calculation_method'))) {
      return { refreshed: 0, skipped: 'migration_required' };
    }

    const [listings] = await connection.query(
      `
        SELECT
          l.lot_project_id,
          l.lot_project_listing_id,
          l.lot_project_listing_tcp,
          cp.lot_project_client_profile_id
        FROM lot_project_listings l
        INNER JOIN lot_project_client_profiles cp
          ON cp.lot_project_listing_id = l.lot_project_listing_id
        WHERE cp.soa_penalty_calculation_method = 'daily'
          AND cp.soa_penalty_rate_percent > 0
          AND cp.lot_project_client_profile_status = 'active'
          AND l.lot_project_listing_status = 'sold'
      `
    );

    let refreshed = 0;
    const asOfDate = todayDateOnly();
    for (const listing of listings) {
      await refreshListingPenaltyCache(connection, listing, asOfDate);
      refreshed += 1;
    }

    return { refreshed, asOfDate };
  } finally {
    connection.release();
  }
};

const claimDailyPenaltyRun = async (runDate) => {
  const connection = await db.getConnection();
  let transactionStarted = false;

  try {
    if (!(await tableExists(connection, SCHEDULER_STATE_TABLE))) {
      return { claimed: false, reason: 'scheduler_migration_required' };
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.query(
      `
        SELECT
          job_name,
          last_success_date,
          current_run_date,
          status,
          lock_expires_at
        FROM system_scheduled_job_state
        WHERE job_name = ?
        LIMIT 1
        FOR UPDATE
      `,
      [DAILY_PENALTY_JOB_NAME]
    );

    if (!rows.length) {
      await connection.query(
        `
          INSERT INTO system_scheduled_job_state (
            job_name,
            status
          ) VALUES (?, 'idle')
        `,
        [DAILY_PENALTY_JOB_NAME]
      );
    }

    const state = rows[0] || {};
    if (cleanDateOnly(state.last_success_date) === runDate) {
      await connection.commit();
      transactionStarted = false;
      return { claimed: false, reason: 'already_completed' };
    }

    const [lockRows] = await connection.query(
      `
        SELECT
          CASE
            WHEN status = 'running'
              AND current_run_date = ?
              AND lock_expires_at IS NOT NULL
              AND lock_expires_at > NOW()
            THEN 1
            ELSE 0
          END AS active_lock
        FROM system_scheduled_job_state
        WHERE job_name = ?
        LIMIT 1
      `,
      [runDate, DAILY_PENALTY_JOB_NAME]
    );

    if (Number(lockRows[0]?.active_lock || 0) === 1) {
      await connection.commit();
      transactionStarted = false;
      return { claimed: false, reason: 'already_running' };
    }

    await connection.query(
      `
        UPDATE system_scheduled_job_state
        SET current_run_date = ?,
            status = 'running',
            started_at = NOW(),
            completed_at = NULL,
            lock_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR),
            last_error = NULL
        WHERE job_name = ?
      `,
      [runDate, RUN_LOCK_HOURS, DAILY_PENALTY_JOB_NAME]
    );

    await connection.commit();
    transactionStarted = false;
    return { claimed: true };
  } catch (error) {
    if (transactionStarted) {
      try { await connection.rollback(); } catch {}
    }
    throw error;
  } finally {
    connection.release();
  }
};

const completeDailyPenaltyRun = async (runDate, result) => {
  await db.query(
    `
      UPDATE system_scheduled_job_state
      SET last_success_date = ?,
          current_run_date = ?,
          status = 'completed',
          completed_at = NOW(),
          lock_expires_at = NULL,
          last_error = NULL,
          last_refreshed_count = ?
      WHERE job_name = ?
    `,
    [runDate, runDate, Number(result?.refreshed || 0), DAILY_PENALTY_JOB_NAME]
  );
};

const failDailyPenaltyRun = async (runDate, error) => {
  const message = String(error?.message || error || 'Unknown daily penalty refresh error').slice(0, 1000);
  try {
    await db.query(
      `
        UPDATE system_scheduled_job_state
        SET current_run_date = ?,
            status = 'failed',
            completed_at = NOW(),
            lock_expires_at = NULL,
            last_error = ?
        WHERE job_name = ?
      `,
      [runDate, message, DAILY_PENALTY_JOB_NAME]
    );
  } catch (stateError) {
    console.error('Failed to save daily penalty scheduler error state:', stateError.message);
  }
};

export const runDailyPenaltyRefreshIfDue = async () => {
  const runDate = todayDateOnly();
  const claim = await claimDailyPenaltyRun(runDate);

  if (!claim.claimed) {
    return { refreshed: 0, skipped: claim.reason, runDate };
  }

  try {
    const result = await refreshDailyPenaltyCaches();
    await completeDailyPenaltyRun(runDate, result);
    return { ...result, runDate };
  } catch (error) {
    await failDailyPenaltyRun(runDate, error);
    throw error;
  }
};

export const startDailyPenaltyScheduler = () => {
  let timer = null;
  let stopped = false;
  let running = false;

  const scheduleAt = (date) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);

    const delayMs = Math.max(1_000, date.getTime() - Date.now());
    timer = setTimeout(() => {
      void run({ source: 'scheduled' });
    }, delayMs);
    timer.unref?.();

    console.log(`Next daily penalty refresh scheduled for ${date.toISOString()} (00:05 Asia/Manila).`);
  };

  const scheduleNextDailyRun = () => scheduleAt(getNextDailyPenaltyRunAt());
  const scheduleRetry = () => scheduleAt(new Date(Date.now() + RETRY_DELAY_MS));

  const run = async ({ source }) => {
    if (stopped || running) return;
    running = true;

    try {
      const result = await runDailyPenaltyRefreshIfDue();

      if (result.skipped === 'scheduler_migration_required') {
        console.error('Daily penalty scheduler migration is required. Run server/migrations/20260816_daily_penalty_scheduler.sql.');
      } else if (result.skipped === 'already_running') {
        console.log('Daily penalty refresh is already running. Rechecking in 15 minutes.');
        scheduleRetry();
        return;
      } else if (result.skipped === 'already_completed') {
        if (source === 'startup') {
          console.log(`Daily penalty refresh already completed for ${result.runDate}.`);
        }
      } else {
        console.log(`Daily penalty cache refreshed for ${result.refreshed} listing(s) for ${result.runDate}.`);
      }

      scheduleNextDailyRun();
    } catch (error) {
      console.error('Daily penalty cache refresh failed:', error.message);
      scheduleRetry();
    } finally {
      running = false;
    }
  };

  timer = setTimeout(() => {
    void run({ source: 'startup' });
  }, STARTUP_DELAY_MS);
  timer.unref?.();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    getNextRunAt: getNextDailyPenaltyRunAt,
  };
};

import { db } from '../db/connect.js';
import {
  columnExists,
  refreshListingPenaltyCache,
  tableExists,
  todayDateOnly,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

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
    for (const listing of listings) {
      await refreshListingPenaltyCache(connection, listing, todayDateOnly());
      refreshed += 1;
    }

    return { refreshed };
  } finally {
    connection.release();
  }
};

export const startDailyPenaltyJob = () => {
  const run = async () => {
    try {
      const result = await refreshDailyPenaltyCaches();
      if (result.refreshed > 0) {
        console.log(`Daily penalty cache refreshed for ${result.refreshed} listing(s).`);
      }
    } catch (error) {
      console.error('Daily penalty cache refresh failed:', error.message);
    }
  };

  const initialTimer = setTimeout(run, 5000);
  initialTimer.unref?.();

  const interval = setInterval(run, 60 * 60 * 1000);
  interval.unref?.();

  return interval;
};

import {problem} from './domain.js';
export function assertSafeDatabase(env=process.env) {
  if(env.TIDB_DATABASE!=='dc_prime_finance_db')throw problem('WRONG_DATABASE','Finance must use dc_prime_finance_db.',503);
  if(env.NODE_ENV==='production'&&env.FINANCE_PRODUCTION_ENABLED!=='true')throw problem('PRODUCTION_DISABLED','Finance production startup has not been approved.',503);
  if(env.NODE_ENV!=='production'&&env.FINANCE_STAGING_ENABLED!=='true')throw problem('STAGING_DISABLED','Finance staging startup is disabled.',503);
  for(const key of ['TIDB_HOST','TIDB_USERNAME','TIDB_PASSWORD'])if(!env[key])throw problem('MISSING_DB_CONFIG',`${key} is required.`,503);
}

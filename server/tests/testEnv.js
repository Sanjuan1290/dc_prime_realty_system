// Test-only environment bootstrap.
// mysql2 createPool is lazy, so placeholder values allow unit/static tests to import
// modules that reference db/connect.js without requiring production TiDB secrets.
// Any test that actually performs a database query must provide its own test database/mocks.
process.env.NODE_ENV ||= 'test';
process.env.TIDB_HOST ||= '127.0.0.1';
process.env.TIDB_PORT ||= '4000';
process.env.TIDB_USERNAME ||= 'test';
process.env.TIDB_PASSWORD ||= 'test';
process.env.TIDB_DATABASE ||= 'dc_prime_realty_system_db_test';
process.env.TIDB_SSL ||= 'false';
process.env.JWT_SECRET ||= 'test-only-jwt-secret-change-me';


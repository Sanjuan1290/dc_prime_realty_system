import { getRequestIpAddress } from '../utils/requestIp.js';

const buckets = new Map();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const pruneExpiredBuckets = (now) => {
  if (buckets.size < 1000) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

export const loginRateLimit = (req, res, next) => {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const clientIp = getRequestIpAddress(req) || 'unknown';
  const key = `login:${clientIp}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + LOGIN_WINDOW_MS }
    : current;

  bucket.count += 1;
  buckets.set(key, bucket);

  res.setHeader('X-RateLimit-Limit', String(LOGIN_MAX_ATTEMPTS));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(LOGIN_MAX_ATTEMPTS - bucket.count, 0)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > LOGIN_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
    res.setHeader('Retry-After', String(retryAfterSeconds));

    return res.status(429).json({
      success: false,
      code: 'LOGIN_RATE_LIMITED',
      message: 'Too many login attempts. Please wait 15 minutes before trying again.',
      retryAfterSeconds,
    });
  }

  return next();
};

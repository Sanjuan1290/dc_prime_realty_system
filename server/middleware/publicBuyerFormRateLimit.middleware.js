const buckets = new Map();

const getClientKey = (req) =>
  String(req.headers['x-forwarded-for'] || req.ip || 'unknown')
    .split(',')[0]
    .trim()
    .slice(0, 80);

const pruneExpiredBuckets = (now) => {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

export const createPublicBuyerFormRateLimit = ({
  windowMs = 15 * 60 * 1000,
  max = 30,
} = {}) => (req, res, next) => {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const key = `${getClientKey(req)}:${req.method}:${req.baseUrl}${req.route?.path || req.path}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;

  bucket.count += 1;
  buckets.set(key, bucket);

  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(max - bucket.count, 0)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > max) {
    const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      message: 'Too many buyer form requests. Please wait before trying again.',
      retryAfterSeconds,
    });
  }

  return next();
};

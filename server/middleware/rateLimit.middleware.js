const stores = new Set();

const normalizePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getClientKey = (req) => String(req.ip || req.socket?.remoteAddress || 'unknown');

export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  limit = 100,
  message = 'Too many requests. Please try again later.',
  keyGenerator = getClientKey,
} = {}) => {
  const safeWindowMs = normalizePositiveInteger(windowMs, 15 * 60 * 1000);
  const safeLimit = normalizePositiveInteger(limit, 100);
  const hits = new Map();
  stores.add(hits);

  return (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator(req) || getClientKey(req));
    const current = hits.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + safeWindowMs }
      : current;

    entry.count += 1;
    hits.set(key, entry);

    const remaining = Math.max(safeLimit - entry.count, 0);
    const retryAfterSeconds = Math.max(Math.ceil((entry.resetAt - now) / 1000), 1);

    res.setHeader('RateLimit-Limit', String(safeLimit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > safeLimit) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        message,
        retryAfterSeconds,
        retryAt: new Date(entry.resetAt).toISOString(),
      });
    }

    return next();
  };
};

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const hits of stores) {
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }
}, 60 * 1000);

cleanupTimer.unref?.();

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: 'Too many API requests. Please try again shortly.',
});

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many login attempts. Please try again later.',
});

export const passwordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Too many password attempts. Please try again later.',
});

export const sensitiveActionRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many sensitive requests. Please try again later.',
});

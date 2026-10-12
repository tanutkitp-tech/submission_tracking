const HttpError = require('../utils/http-error');

function createRateLimiter({ windowMs, max, scope, store, keyGenerator }) {
  return async function rateLimit(req, res, next) {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    let bucket;
    try {
      const clientKey = keyGenerator ? keyGenerator(req, clientIp) : clientIp;
      bucket = await store.consume(scope, clientKey, windowMs);
    } catch {
      return next(new HttpError(503, 'Request protection is temporarily unavailable'));
    }

    const remaining = Math.max(0, max - bucket.count);
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }

    return next();
  };
}

module.exports = { createRateLimiter };

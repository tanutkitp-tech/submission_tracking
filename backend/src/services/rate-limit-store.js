const { createHmac } = require('node:crypto');
const db = require('../config/database');

const CLEANUP_INTERVAL_MS = 60_000;
let nextCleanupAt = 0;
let cleanupInFlight = null;

function makeBucketKey(scope, clientIp) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for request protection');
  return createHmac('sha256', secret).update(`${scope}\0${clientIp}`).digest();
}

async function cleanExpiredBuckets(now) {
  if (now < nextCleanupAt) return;
  nextCleanupAt = now + CLEANUP_INTERVAL_MS;
  if (!cleanupInFlight) {
    cleanupInFlight = db.execute(
      'DELETE FROM auth_rate_limit_buckets WHERE reset_at <= ? ORDER BY reset_at LIMIT 5000',
      [now],
    ).finally(() => { cleanupInFlight = null; });
  }
  await cleanupInFlight;
}

async function consume(scope, clientIp, windowMs) {
  const now = Date.now();
  const resetAt = now + windowMs;
  const bucketKey = makeBucketKey(scope, clientIp);
  await db.execute(
    `INSERT INTO auth_rate_limit_buckets (bucket_key, attempt_count, reset_at)
     VALUES (?, 1, ?)
     ON DUPLICATE KEY UPDATE
       attempt_count = IF(reset_at <= ?, 1, attempt_count + 1),
       reset_at = IF(reset_at <= ?, ?, reset_at)`,
    [bucketKey, resetAt, now, now, resetAt],
  );
  const [rows] = await db.execute(
    'SELECT attempt_count AS count, reset_at AS resetAt FROM auth_rate_limit_buckets WHERE bucket_key = ?',
    [bucketKey],
  );
  if (!rows.length) throw new Error('Rate limit bucket was not stored');
  await cleanExpiredBuckets(now);
  return { count: Number(rows[0].count), resetAt: Number(rows[0].resetAt) };
}

module.exports = { consume };

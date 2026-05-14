/**
 * Rate limiter middleware — 20 AI calls per hour per user.
 * Uses in-memory store (no Redis dependency needed).
 */
const aiCallTracker = new Map(); // key: userId, value: { count, windowStart }

const AI_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function aiRateLimiter(req, res, next) {
  const userId = req.user && req.user.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const now = Date.now();
  const record = aiCallTracker.get(userId);

  if (!record || now - record.windowStart >= WINDOW_MS) {
    aiCallTracker.set(userId, { count: 1, windowStart: now });
    return next();
  }

  if (record.count >= AI_LIMIT) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - record.windowStart)) / 1000);
    res.set('Retry-After', retryAfterSec);
    return res.status(429).json({
      error: `Rate limit exceeded. Maximum ${AI_LIMIT} AI calls per hour. Retry after ${retryAfterSec} seconds.`,
      retry_after_seconds: retryAfterSec,
    });
  }

  record.count += 1;
  next();
}

// Periodically clean up stale entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [userId, record] of aiCallTracker.entries()) {
    if (now - record.windowStart >= WINDOW_MS) {
      aiCallTracker.delete(userId);
    }
  }
}, 10 * 60 * 1000);

module.exports = aiRateLimiter;

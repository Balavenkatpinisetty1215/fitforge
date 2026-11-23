const AppError = require("../errors/AppError");

function createRateLimiter({ windowMs = 60000, maxRequests = 40, message = "Too many requests. Please slow down." } = {}) {
  const hits = new Map();

  // Periodic cleanup to prevent memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, windowMs);
  cleanupInterval.unref();

  return function rateLimiter(req, res, next) {
    const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const history = (hits.get(clientIp) || []).filter((t) => now - t < windowMs);

    if (history.length >= maxRequests) {
      const retrySeconds = Math.ceil((windowMs - (now - history[0])) / 1000);
      res.setHeader("Retry-After", String(Math.max(1, retrySeconds)));
      return next(new AppError(message, 429, "RATE_LIMIT_EXCEEDED"));
    }

    history.push(now);
    hits.set(clientIp, history);
    next();
  };
}

module.exports = createRateLimiter;

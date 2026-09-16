function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http: https: ws: wss:; font-src 'self' data:");
  next();
}

function createRateLimiter({ windowMs = 60_000, max = 100 } = {}) {
  const requests = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const entry = requests.get(key);
    const current = !entry || now - entry.startedAt >= windowMs ? { startedAt: now, count: 1 } : { ...entry, count: entry.count + 1 };
    requests.set(key, current);
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - current.count));
    if (current.count > max) return res.status(429).json({ detail: 'Too many requests. Try again shortly.' });
    next();
  };
}

module.exports = { securityHeaders, createRateLimiter };

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self'; connect-src 'self' http: https: ws: wss:; frame-ancestors 'none'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function createRateLimiter({ windowMs = 60_000, max = 100 } = {}) {
  const requests = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requests) if (now - entry.startedAt >= windowMs) requests.delete(key);
  }, windowMs);
  sweep.unref?.();
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

/**
 * Allowed browser origins come from CORS_ORIGINS.
 * In development, standard localhost addresses are included automatically.
 */
function allowedOrigins() {
  const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (process.env.NODE_ENV !== 'production') {
    return new Set([
      ...envOrigins,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:8000',
      'http://127.0.0.1:8000',
    ]);
  }
  return new Set(envOrigins);
}

module.exports = { securityHeaders, createRateLimiter, allowedOrigins };

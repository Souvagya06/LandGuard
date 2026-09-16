const crypto = require('crypto');

const ROLE_RANK = { viewer: 0, field_officer: 1, operator: 2, incident_commander: 3, admin: 4 };

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(payload) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET must be configured to sign tokens.');
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verify(token) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET must be configured in production.');
  const [header, body, signature] = String(token || '').split('.');
  if (!header || !body || !signature) throw new Error('Malformed bearer token.');
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('Invalid bearer token.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.sub || !payload.role || !(payload.role in ROLE_RANK)) throw new Error('Invalid token claims.');
  if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error('Bearer token expired.');
  return payload;
}

function actor(req, res, next) {
  if (process.env.NODE_ENV !== 'production' && !req.headers.authorization) {
    req.actor = { sub: 'local-demo-operator', name: 'Local demo operator', role: 'admin', demo: true };
    return next();
  }
  try {
    const value = req.headers.authorization || '';
    if (!value.startsWith('Bearer ')) throw new Error('Bearer token required.');
    req.actor = verify(value.slice(7));
    next();
  } catch (error) {
    res.status(401).json({ detail: error.message });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    actor(req, res, () => {
      if ((ROLE_RANK[req.actor.role] ?? -1) < ROLE_RANK[role]) {
        return res.status(403).json({ detail: `${role} role is required.` });
      }
      next();
    });
  };
}

module.exports = { sign, actor, requireRole };

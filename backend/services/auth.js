const crypto = require('crypto');

const ROLE_RANK = { viewer: 0, field_officer: 1, operator: 2, incident_commander: 3, admin: 4 };
const TOKEN_TTL_SECONDS = 8 * 60 * 60;

/** Authentication is always enforced in production; opt-in elsewhere. */
function authRequired() {
  return process.env.NODE_ENV === 'production' || process.env.AUTH_REQUIRED === 'true';
}

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
  if (!secret) throw new Error('Authentication is not configured.');
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

// ─────────────────────────────────────────────────────────────
// Authority accounts — AUTHORITY_USERS='[{"username","role","passwordHash","name"}]'
// passwordHash = "scrypt$<salt b64>$<key b64>" (see scripts/hash-password.js)
// ─────────────────────────────────────────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function authorityUsers() {
  try {
    const users = JSON.parse(process.env.AUTHORITY_USERS || '[]');
    return Array.isArray(users) ? users.filter((u) => u?.username && u?.passwordHash && u.role in ROLE_RANK) : [];
  } catch {
    console.error('[Auth] AUTHORITY_USERS is not valid JSON; no authority accounts are available.');
    return [];
  }
}

// A fixed dummy hash keeps response timing the same for unknown usernames.
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));

function login(username, password) {
  const user = authorityUsers().find((u) => u.username === String(username || ''));
  const ok = verifyPassword(password, user?.passwordHash || DUMMY_HASH) && Boolean(user);
  if (!ok) return null;
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = sign({ sub: user.username, name: user.name || user.username, role: user.role, exp });
  return { token, expiresAt: new Date(exp * 1000).toISOString(), user: { username: user.username, name: user.name || user.username, role: user.role } };
}

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

function actor(req, res, next) {
  if (!authRequired() && !req.headers.authorization) {
    req.actor = { sub: 'local-demo-operator', name: 'Local development operator', role: 'admin', demo: true };
    return next();
  }
  try {
    const value = req.headers.authorization || '';
    if (!value.startsWith('Bearer ')) throw new Error('Sign-in required.');
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
        return res.status(403).json({ detail: `${role.replace('_', ' ')} role is required.` });
      }
      next();
    });
  };
}

const hasRole = (candidate, role) => (ROLE_RANK[candidate] ?? -1) >= ROLE_RANK[role];

module.exports = { ROLE_RANK, sign, verify, actor, requireRole, hasRole, authRequired, login, hashPassword, verifyPassword, authorityUsers };

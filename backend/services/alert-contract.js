/**
 * The ONE LandGuard alert structure, shared by the backend, the authority web,
 * FCM, the Android app (Room + UI) and the Nearby Connections offline mesh.
 *
 *   alertId    string   UUID, identical on every hop (web → backend → FCM → Android → mesh)
 *   zoneId     string   monitored area id (e.g. "glc_2710_9362") or legacy zone id
 *   zoneName   string
 *   level      string   low | moderate | high | critical   (severity = level.toUpperCase())
 *   message    string   1–500 characters
 *   timestamp  string   ISO-8601 UTC issue time
 *   expiresAt  string   ISO-8601 UTC; clients stop showing/relaying after this
 *   source     string   authority | risk_engine
 *   status     string   awaiting_approval | active | cancelled | expired
 *   origin     string   authority_web | api
 *   hopCount   number   0 from the backend; +1 per mesh relay
 *   lat, lng   number?  zone centre when known
 *
 * Only alerts that have been approved and dispatched are ever public.
 */
const LEVELS = ['low', 'moderate', 'high', 'critical'];
const SOURCES = ['authority', 'risk_engine'];
const ORIGINS = ['authority_web', 'api'];
const PUBLIC_STATUSES = ['active', 'cancelled', 'expired'];
const SCHEMA_VERSION = 1;
const MAX_MESH_HOPS = 6;
const DEFAULT_EXPIRY_MINUTES = 24 * 60;
const MIN_EXPIRY_MINUTES = 15;
const MAX_EXPIRY_MINUTES = 7 * 24 * 60;

/** Computes the effective status (active alerts past expiry are expired). */
function effectiveStatus(alert, now = Date.now()) {
  if (alert.status === 'active' && alert.expiresAt && Date.parse(alert.expiresAt) <= now) return 'expired';
  return alert.status;
}

function toPublicAlert(alert, now = Date.now()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    alertId: alert.alertId,
    id: alert.alertId,
    zoneId: alert.zoneId,
    zoneName: alert.zoneName,
    level: alert.level,
    severity: alert.level.toUpperCase(),
    message: alert.message,
    timestamp: alert.timestamp,
    expiresAt: alert.expiresAt,
    source: alert.source,
    status: effectiveStatus(alert, now),
    origin: alert.origin,
    hopCount: 0,
    lat: alert.lat ?? null,
    lng: alert.lng ?? null,
    updatedAt: alert.updatedAt,
  };
}

function toAuthorityAlert(alert, now = Date.now()) {
  const receipts = Object.values(alert.receipts || {});
  return {
    ...toPublicAlert(alert, now),
    channel: alert.channel,
    createdAt: alert.createdAt,
    createdBy: alert.createdBy || null,
    approvedAt: alert.approvedAt || null,
    approvedBy: alert.approvedBy || null,
    dispatchedAt: alert.dispatchedAt || null,
    cancelledAt: alert.cancelledAt || null,
    cancelledBy: alert.cancelledBy || null,
    riskSnapshot: alert.riskSnapshot || null,
    delivery: alert.delivery,
    receipts: {
      devices: receipts.length,
      received: receipts.filter((r) => r.receivedAt).length,
      opened: receipts.filter((r) => r.openedAt).length,
      acknowledged: receipts.filter((r) => r.acknowledgedAt).length,
      via: receipts.reduce((acc, r) => { if (r.via) acc[r.via] = (acc[r.via] || 0) + 1; return acc; }, {}),
      maxHopCount: receipts.reduce((max, r) => Math.max(max, r.hopCount || 0), 0),
      lastReceiptAt: receipts.map((r) => r.updatedAt).sort().pop() || null,
    },
  };
}

/** FCM data payload — every value must be a string. Data-only so the app always handles it. */
function toFcmData(alert) {
  const p = toPublicAlert(alert);
  return {
    type: 'alert',
    schemaVersion: String(SCHEMA_VERSION),
    alertId: p.alertId,
    zoneId: p.zoneId,
    zoneName: p.zoneName,
    level: p.level,
    severity: p.severity,
    message: p.message,
    timestamp: p.timestamp,
    expiresAt: p.expiresAt,
    source: p.source,
    status: p.status,
    origin: p.origin,
    hopCount: '0',
    lat: p.lat == null ? '' : String(p.lat),
    lng: p.lng == null ? '' : String(p.lng),
    title: notificationTitle(p),
  };
}

/** Same title format on Android notifications, the web preview and the mesh. */
function notificationTitle(alert) {
  return `${alert.level.toUpperCase()} — ${alert.zoneName}`;
}

/** Brings records written by earlier backend versions onto the canonical structure. */
function normalizeStoredAlert(raw) {
  const alertId = raw.alertId || raw.id;
  const timestamp = raw.timestamp || raw.createdAt || new Date().toISOString();
  const legacyStatus = { dispatched: 'active', approved: 'active' }[raw.status] || raw.status || 'active';
  const level = LEVELS.includes(raw.level) ? raw.level : raw.level === 'casual' ? 'low' : 'moderate';
  return {
    ...raw,
    id: alertId,
    alertId,
    level,
    timestamp,
    createdAt: raw.createdAt || timestamp,
    updatedAt: raw.updatedAt || raw.dispatchedAt || timestamp,
    expiresAt: raw.expiresAt || new Date(Date.parse(timestamp) + DEFAULT_EXPIRY_MINUTES * 60_000).toISOString(),
    source: SOURCES.includes(raw.source) ? raw.source : 'authority',
    origin: ORIGINS.includes(raw.origin) ? raw.origin : 'api',
    status: ['awaiting_approval', 'active', 'cancelled', 'expired'].includes(legacyStatus) ? legacyStatus : 'active',
    receipts: raw.receipts || {},
    delivery: raw.delivery || { status: 'pending', attemptedAt: null, fcm: null },
  };
}

module.exports = {
  LEVELS,
  SOURCES,
  ORIGINS,
  PUBLIC_STATUSES,
  SCHEMA_VERSION,
  MAX_MESH_HOPS,
  DEFAULT_EXPIRY_MINUTES,
  MIN_EXPIRY_MINUTES,
  MAX_EXPIRY_MINUTES,
  effectiveStatus,
  toPublicAlert,
  toAuthorityAlert,
  toFcmData,
  notificationTitle,
  normalizeStoredAlert,
};

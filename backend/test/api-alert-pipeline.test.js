/**
 * End-to-end API test of the authority alert pipeline, run against the real
 * server process in production mode (auth enforced, strict CORS).
 * Firebase credentials are deliberately absent, so delivery must be reported
 * honestly as not sent — never as a fake success.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');
const { hashPassword } = require('../services/auth');
const analytics = require('../services/monitoring/analytics');

const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'https://landguard.online';
const PASSWORD = 'correct horse battery staple';

const events = [
  { id: 'e1', title: 'Landslide', dateMillis: 1_690_000_000_000, latitude: 27.33, longitude: 88.61, state: 'Sikkim', nearestPlace: 'Gangtok', trigger: 'downpour', fatalities: 2, injuries: 0 },
  { id: 'e2', title: 'Landslide', dateMillis: 1_695_000_000_000, latitude: 27.34, longitude: 88.62, state: 'Sikkim', nearestPlace: 'Gangtok', trigger: 'downpour', fatalities: 0, injuries: 0 },
];
const [hotspot] = analytics.cluster(events);
const now = Date.now();

let server;
let dataDir;

async function api(pathname, { method = 'GET', body, token, origin } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;
  const res = await fetch(`${BASE}${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

async function signIn(username) {
  const res = await api('/auth/login', { method: 'POST', body: { username, password: PASSWORD } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.token;
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'landguard-test-'));
  fs.writeFileSync(path.join(dataDir, 'monitoring-cache.json'), JSON.stringify({
    catalog: { events, sourceUrl: 'test://catalog', fetchedAtMillis: now },
    terrainCache: { [hotspot.id]: { elevationM: 1600, slopeDeg: 31, source: 'Copernicus GLO-90 DEM via Open-Meteo' } },
    conditions: { [hotspot.id]: { rainfall: { past72hMm: 96, next24hMm: 20, soilMoistureM3M3: 0.41, source: 'Open-Meteo weather models (hourly)', fetchedAtMillis: now }, terrain: { elevationM: 1600, slopeDeg: 31, source: 'Copernicus GLO-90 DEM via Open-Meteo' } } },
    conditionsUpdatedAtMillis: now,
  }));
  const users = [
    { username: 'operator1', role: 'operator', name: 'Duty Operator', passwordHash: hashPassword(PASSWORD) },
    { username: 'commander1', role: 'incident_commander', name: 'Incident Commander', passwordHash: hashPassword(PASSWORD) },
  ];
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      AUTH_SECRET: 'x'.repeat(48),
      AUTHORITY_USERS: JSON.stringify(users),
      CORS_ORIGINS: `${ORIGIN},https://www.landguard.online`,
      LANDGUARD_DATA_DIR: dataDir,
      MONITORING_DISABLED: 'true',
      SERVE_FRONTEND: 'false',
      TRUST_PROXY: 'false',
      FIREBASE_SERVICE_ACCOUNT_PATH: '',
      FIREBASE_SERVICE_ACCOUNT_JSON: '',
      FIREBASE_SERVICE_ACCOUNT_BASE64: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 15_000);
    server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening on port')) { clearTimeout(timer); resolve(); } });
    server.on('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
});

test.after(() => {
  server?.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('health and system status expose no internal details', async () => {
  const health = await api('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(Object.keys(health.body).sort(), ['service', 'status', 'time', 'version']);
  const status = await api('/system/status');
  assert.equal(status.body.push.configured, false);
  assert.equal(status.body.security.authenticationRequired, true);
  assert.equal(status.body.monitoring.zones, 1);
  assert.ok(!JSON.stringify(status.body).includes(dataDir), 'no filesystem paths');
});

test('CORS allows only the production web origins', async () => {
  const good = await api('/health', { origin: ORIGIN });
  assert.equal(good.headers.get('access-control-allow-origin'), ORIGIN);
  const bad = await api('/health', { origin: 'https://evil.example' });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  assert.ok(good.headers.get('strict-transport-security'));
});

test('monitoring zones carry the shared risk model and freshness', async () => {
  const res = await api('/monitoring/zones');
  assert.equal(res.status, 200);
  const [zone] = res.body.zones;
  assert.equal(zone.id, hotspot.id);
  const expected = analytics.hotspotRisk(hotspot, { rainfall: { past72hMm: 96, next24hMm: 20 }, terrain: { slopeDeg: 31 } });
  assert.equal(zone.risk.score, expected.score);
  assert.equal(zone.risk.level, expected.level);
  assert.equal(zone.risk.severity, expected.level.toUpperCase());
  assert.equal(zone.rainfall.observedAt, new Date(now).toISOString());
  assert.equal(res.body.conditions.state, 'live');
});

test('full alert lifecycle: register → create → approve → FCM result → receipts → cancel', async () => {
  // Android devices register without credentials.
  for (const [i, installationId] of ['install-aaaa-1111', 'install-bbbb-2222'].entries()) {
    const reg = await api('/devices', { method: 'POST', body: { token: `fcm-token-${i}-${'x'.repeat(40)}`, platform: 'android', installationId, appVersion: '1.2' } });
    assert.equal(reg.status, 201);
  }

  // Unauthenticated alert creation is refused in production.
  const anon = await api('/alerts', { method: 'POST', body: { zoneId: hotspot.id, level: 'critical', message: 'Evacuate now.' } });
  assert.equal(anon.status, 401);

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`, { origin: ORIGIN });
  const frames = [];
  ws.on('message', (data) => frames.push(JSON.parse(data)));
  await new Promise((resolve) => ws.on('open', resolve));

  // An operator's CRITICAL alert waits for an incident commander.
  const operator = await signIn('operator1');
  const created = await api('/alerts', { method: 'POST', token: operator, body: { zoneId: hotspot.id, level: 'critical', message: 'Evacuate the Gangtok slope settlements now.', origin: 'authority_web', expiresInMinutes: 120, clientRequestId: 'req-1' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.status, 'awaiting_approval');
  const { alertId } = created.body;
  assert.match(alertId, /^[0-9a-f-]{36}$/);
  assert.equal((await api('/alerts')).body.length, 0, 'unapproved alerts are never public');

  // Retried submission is idempotent.
  const retry = await api('/alerts', { method: 'POST', token: operator, body: { zoneId: hotspot.id, level: 'critical', message: 'Evacuate the Gangtok slope settlements now.', clientRequestId: 'req-1' } });
  assert.equal(retry.body.alertId, alertId);

  // Operators cannot approve.
  assert.equal((await api(`/alerts/${alertId}/approve`, { method: 'POST', token: operator })).status, 403);

  const commander = await signIn('commander1');
  const approved = await api(`/alerts/${alertId}/approve`, { method: 'POST', token: commander });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, 'active');
  assert.equal(approved.body.delivery.status, 'not_sent');
  assert.equal(approved.body.delivery.fcm.reason, 'firebase_not_configured');
  assert.equal(approved.body.delivery.fcm.attempted, 2);
  assert.equal(approved.body.delivery.fcm.accepted, 0);

  // Public payload = the shared contract, identical id everywhere.
  const pub = await api(`/alerts/${alertId}`);
  for (const field of ['alertId', 'zoneId', 'zoneName', 'level', 'severity', 'message', 'timestamp', 'expiresAt', 'source', 'status', 'origin', 'hopCount']) {
    assert.ok(field in pub.body, `missing ${field}`);
  }
  assert.equal(pub.body.alertId, alertId);
  assert.equal(pub.body.zoneId, hotspot.id);
  assert.equal(pub.body.severity, 'CRITICAL');
  assert.equal(pub.body.origin, 'authority_web');
  assert.equal(pub.body.hopCount, 0);
  assert.equal(Date.parse(pub.body.expiresAt) - Date.parse(pub.body.timestamp), 120 * 60_000);
  assert.ok(!('delivery' in pub.body) && !('createdBy' in pub.body), 'no authority data in public view');

  // Realtime channel carried the same alert id.
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(frames.some((f) => f.type === 'alert' && f.data.alertId === alertId));

  // Device receipts: one via FCM, one relayed over the offline mesh.
  assert.equal((await api(`/alerts/${alertId}/receipts`, { method: 'POST', body: { installationId: 'install-aaaa-1111', event: 'received', via: 'fcm', hopCount: 0 } })).status, 202);
  assert.equal((await api(`/alerts/${alertId}/receipts`, { method: 'POST', body: { installationId: 'install-bbbb-2222', event: 'received', via: 'mesh', hopCount: 1 } })).status, 202);
  await api(`/alerts/${alertId}/receipts`, { method: 'POST', body: { installationId: 'install-aaaa-1111', event: 'acknowledged', via: 'fcm' } });
  const authority = await api('/alerts?view=authority', { token: operator });
  const record = authority.body.find((a) => a.alertId === alertId);
  assert.equal(record.receipts.received, 2);
  assert.equal(record.receipts.acknowledged, 1);
  assert.deepEqual(record.receipts.via, { fcm: 1, mesh: 1 });
  assert.equal(record.receipts.maxHopCount, 1);
  assert.equal((await api('/alerts?view=authority')).status, 401);

  // Sync endpoint for reconnecting devices.
  const sync = await api(`/alerts?updatedSince=${encodeURIComponent(new Date(now - 60_000).toISOString())}&active=true`);
  assert.deepEqual(sync.body.map((a) => a.alertId), [alertId]);

  // Cancellation propagates.
  const cancelled = await api(`/alerts/${alertId}/cancel`, { method: 'POST', token: operator });
  assert.equal(cancelled.body.status, 'cancelled');
  assert.equal((await api(`/alerts/${alertId}`)).body.status, 'cancelled');
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.ok(frames.some((f) => f.type === 'alert.updated' && f.data.alertId === alertId && f.data.status === 'cancelled'));
  ws.close();
});

test('incident commanders dispatch immediately; bad input is rejected', async () => {
  const commander = await signIn('commander1');
  const res = await api('/alerts', { method: 'POST', token: commander, body: { zoneId: hotspot.id, level: 'high', message: 'Avoid NH-10 road cuts tonight.' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'active');
  assert.equal((await api('/alerts', { method: 'POST', token: commander, body: { zoneId: 'nowhere', level: 'high' } })).status, 404);
  assert.equal((await api('/alerts', { method: 'POST', token: commander, body: { zoneId: hotspot.id, level: 'extreme' } })).status, 400);
  assert.equal((await api('/auth/login', { method: 'POST', body: { username: 'commander1', password: 'wrong' } })).status, 401);
  assert.equal((await api('/devices', { method: 'POST', body: { token: 'short' } })).status, 400);
});

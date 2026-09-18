const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeStoredAlert, DEFAULT_EXPIRY_MINUTES } = require('./alert-contract');

/**
 * Small, durable JSON repository. It deliberately has no dependency on an
 * in-memory process, so alerts, registered FCM tokens and delivery receipts
 * survive restarts. The file can later be replaced by a database adapter
 * without changing routes.
 */
class AlertStore {
  constructor(filePath = path.join(__dirname, '..', 'data', 'alerts.json')) {
    this.filePath = filePath;
    this.state = { alerts: [], devices: [], reports: [], auditEvents: [] };
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.state.alerts = Array.isArray(parsed.alerts) ? parsed.alerts.map(normalizeStoredAlert) : [];
      this.state.devices = Array.isArray(parsed.devices) ? parsed.devices : [];
      this.state.reports = Array.isArray(parsed.reports) ? parsed.reports : [];
      this.state.auditEvents = Array.isArray(parsed.auditEvents) ? parsed.auditEvents : [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Cannot read alert store: ${error.message}`);
      this.persist();
    }
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  listAlerts() { return [...this.state.alerts]; }
  getAlert(id) { return this.state.alerts.find((alert) => alert.alertId === id) || null; }
  listDevices() { return [...this.state.devices]; }
  listReports() { return [...this.state.reports]; }
  listAuditEvents() { return [...this.state.auditEvents]; }

  audit({ action, actor, entityType, entityId, metadata = {} }) {
    const event = { id: crypto.randomUUID(), action, actor: { id: actor?.sub || 'system', name: actor?.name || 'System', role: actor?.role || 'system' }, entityType, entityId, metadata, createdAt: new Date().toISOString() };
    this.state.auditEvents.unshift(event);
    this.state.auditEvents = this.state.auditEvents.slice(0, 10_000);
    this.persist();
    return event;
  }

  findRecentByClientRequestId(clientRequestId, withinMs = 10 * 60 * 1000) {
    if (!clientRequestId) return null;
    const since = Date.now() - withinMs;
    return this.state.alerts.find((a) => a.clientRequestId === clientRequestId && Date.parse(a.createdAt) >= since) || null;
  }

  createAlert({ expiresInMinutes = DEFAULT_EXPIRY_MINUTES, ...payload }) {
    const now = new Date();
    const alertId = crypto.randomUUID();
    const alert = {
      id: alertId,
      alertId,
      ...payload,
      timestamp: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiresInMinutes * 60_000).toISOString(),
      receipts: {},
      delivery: { status: 'pending', attemptedAt: null, fcm: null },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.state.alerts.unshift(alert);
    this.persist();
    return alert;
  }

  updateAlert(id, patch) {
    const index = this.state.alerts.findIndex((alert) => alert.alertId === id);
    if (index === -1) return null;
    this.state.alerts[index] = { ...this.state.alerts[index], ...patch, updatedAt: new Date().toISOString() };
    this.persist();
    return this.state.alerts[index];
  }

  /** Device-side delivery confirmation; one record per app installation. */
  recordReceipt(alertId, { installationId, event, via, hopCount = 0 }) {
    const index = this.state.alerts.findIndex((alert) => alert.alertId === alertId);
    if (index === -1) return null;
    const alert = this.state.alerts[index];
    const now = new Date().toISOString();
    const current = alert.receipts?.[installationId] || { receivedAt: null, openedAt: null, acknowledgedAt: null };
    const next = { ...current, via: current.via || via, hopCount: current.hopCount ?? hopCount, updatedAt: now };
    if (!next.receivedAt) next.receivedAt = now;
    if (event === 'opened' && !next.openedAt) next.openedAt = now;
    if (event === 'acknowledged' && !next.acknowledgedAt) next.acknowledgedAt = now;
    this.state.alerts[index] = { ...alert, receipts: { ...(alert.receipts || {}), [installationId]: next } };
    this.persist();
    return this.state.alerts[index];
  }

  createReport(payload) {
    const report = { id: crypto.randomUUID(), status: 'pending_review', verification: null, ...payload, createdAt: new Date().toISOString() };
    this.state.reports.unshift(report);
    this.persist();
    return report;
  }

  updateReport(id, patch) {
    const index = this.state.reports.findIndex((report) => report.id === id);
    if (index === -1) return null;
    this.state.reports[index] = { ...this.state.reports[index], ...patch };
    this.persist();
    return this.state.reports[index];
  }

  deleteReport(id) {
    const index = this.state.reports.findIndex((report) => report.id === id);
    if (index === -1) return null;
    const [removed] = this.state.reports.splice(index, 1);
    this.persist();
    return removed;
  }

  /**
   * Upsert by installation (so a rotated FCM token replaces the old one), and
   * fall back to the token itself for clients that do not send an installation id.
   */
  registerDevice({ token, platform = 'android', zoneIds = [], appVersion, installationId }) {
    const now = new Date().toISOString();
    const index = this.state.devices.findIndex((device) => (installationId && device.installationId === installationId) || device.token === token);
    const previous = index === -1 ? null : this.state.devices[index];
    const device = {
      id: previous?.id || crypto.randomUUID(),
      token,
      platform,
      installationId: installationId || previous?.installationId || null,
      zoneIds: [...new Set(zoneIds)],
      appVersion: appVersion || previous?.appVersion || null,
      lastSeenAt: now,
      updatedAt: now,
      createdAt: previous?.createdAt || now,
    };
    if (index === -1) this.state.devices.push(device);
    else this.state.devices[index] = device;
    // A token can only belong to one installation.
    this.state.devices = this.state.devices.filter((d) => d.id === device.id || d.token !== token);
    this.persist();
    return device;
  }

  touchDevice(installationId) {
    const device = this.state.devices.find((d) => d.installationId && d.installationId === installationId);
    if (!device) return;
    device.lastSeenAt = new Date().toISOString();
    this.persist();
  }

  removeTokens(tokens) {
    const tokenSet = new Set(tokens);
    const before = this.state.devices.length;
    this.state.devices = this.state.devices.filter((device) => !tokenSet.has(device.token));
    if (before !== this.state.devices.length) this.persist();
    return before - this.state.devices.length;
  }

  matchingDevices(zoneId) {
    return this.state.devices.filter((device) => !device.zoneIds?.length || device.zoneIds.includes(zoneId));
  }
}

module.exports = { AlertStore };

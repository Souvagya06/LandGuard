const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Small, durable JSON repository. It deliberately has no dependency on an
 * in-memory process, so alerts and registered FCM tokens survive restarts.
 * The file can later be replaced by a database adapter without changing routes.
 */
class AlertStore {
  constructor(filePath = path.join(__dirname, '..', 'data', 'alerts.json')) {
    this.filePath = filePath;
    this.state = { alerts: [], devices: [] };
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.state.alerts = Array.isArray(parsed.alerts) ? parsed.alerts : [];
      this.state.devices = Array.isArray(parsed.devices) ? parsed.devices : [];
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
  listDevices() { return [...this.state.devices]; }

  createAlert(payload) {
    const alert = {
      id: crypto.randomUUID(),
      ...payload,
      delivery: { status: 'pending', attemptedAt: null, fcm: null },
      createdAt: new Date().toISOString(),
    };
    this.state.alerts.unshift(alert);
    this.persist();
    return alert;
  }

  updateAlert(id, patch) {
    const index = this.state.alerts.findIndex((alert) => alert.id === id);
    if (index === -1) return null;
    this.state.alerts[index] = { ...this.state.alerts[index], ...patch };
    this.persist();
    return this.state.alerts[index];
  }

  registerDevice({ token, platform = 'android', zoneIds = [], appVersion }) {
    const now = new Date().toISOString();
    const index = this.state.devices.findIndex((device) => device.token === token);
    const device = {
      id: index === -1 ? crypto.randomUUID() : this.state.devices[index].id,
      token,
      platform,
      zoneIds: [...new Set(zoneIds)],
      appVersion: appVersion || null,
      updatedAt: now,
      createdAt: index === -1 ? now : this.state.devices[index].createdAt,
    };
    if (index === -1) this.state.devices.push(device);
    else this.state.devices[index] = device;
    this.persist();
    return device;
  }

  removeTokens(tokens) {
    const tokenSet = new Set(tokens);
    const before = this.state.devices.length;
    this.state.devices = this.state.devices.filter((device) => !tokenSet.has(device.token));
    if (before !== this.state.devices.length) this.persist();
    return before - this.state.devices.length;
  }

  matchingDevices(zoneId) {
    return this.state.devices.filter((device) => !device.zoneIds.length || device.zoneIds.includes(zoneId));
  }
}

module.exports = { AlertStore };

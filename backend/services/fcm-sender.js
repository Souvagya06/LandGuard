const fs = require('fs');
const admin = require('firebase-admin');

function serviceAccount() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (encoded) return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
  return null;
}

function firebaseMessaging() {
  if (!admin.apps.length) {
    const credentials = serviceAccount();
    if (!credentials) return null;
    admin.initializeApp({ credential: admin.credential.cert(credentials) });
  }
  return admin.messaging();
}

async function sendFcmAlert(alert, devices) {
  if (!devices.length) return { status: 'not_sent', reason: 'no_registered_devices', attempted: 0, delivered: 0, failed: 0 };
  const messaging = firebaseMessaging();
  if (!messaging) return { status: 'not_sent', reason: 'firebase_not_configured', attempted: devices.length, delivered: 0, failed: 0 };

  let delivered = 0;
  const invalidTokens = [];
  const failures = [];
  for (let offset = 0; offset < devices.length; offset += 500) {
    const batch = devices.slice(offset, offset + 500);
    const result = await messaging.sendEachForMulticast({
      tokens: batch.map((device) => device.token),
      notification: { title: `${alert.level.toUpperCase()} — ${alert.zoneName}`, body: alert.message },
      data: {
        alertId: alert.id,
        zoneId: alert.zoneId,
        zoneName: alert.zoneName,
        level: alert.level,
        deepLink: `landguard://alerts/${alert.id}`,
      },
      android: { priority: alert.level === 'critical' ? 'high' : 'normal', notification: { channelId: 'landguard_alerts', sound: 'default' } },
    });
    result.responses.forEach((response, index) => {
      if (response.success) delivered += 1;
      else {
        const code = response.error?.code || 'unknown';
        failures.push({ code });
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') invalidTokens.push(batch[index].token);
      }
    });
  }
  return {
    status: delivered ? (delivered === devices.length ? 'sent' : 'partially_sent') : 'not_sent',
    attempted: devices.length,
    delivered,
    failed: devices.length - delivered,
    invalidTokens,
    failures,
  };
}

module.exports = { sendFcmAlert };

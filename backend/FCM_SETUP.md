# Firebase Cloud Messaging setup

The alert API persists every dispatch in `backend/data/alerts.json` before it attempts delivery. The file is created automatically and is intentionally ignored by Git.

1. In the Firebase project used by the Android application, create a service-account key with the Firebase Admin SDK role. Store it outside this repository.
2. Set `FIREBASE_SERVICE_ACCOUNT_PATH` to that absolute JSON file path (or set one of the other variables in `.env.example`) before starting the backend.
3. The Android application must register every refreshed FCM token with `POST /devices`:

```json
{ "token": "<FirebaseMessaging token>", "platform": "android", "zoneIds": ["west_siang_arunachal_pradesh"], "appVersion": "1.0.0" }
```

`zoneIds` is optional; an empty list subscribes the device to all alerts. Register from both `FirebaseMessagingService.onNewToken` and app startup, so token rotation is handled. The FCM data payload contains `alertId`, `zoneId`, `zoneName`, `level`, and `deepLink` (`landguard://alerts/<alertId>`).

4. Send an alert in the authority console. Its returned `delivery` object is the source of truth: `sent`, `partially_sent`, or `not_sent`. A missing service account or registered device is shown as `not_sent`; the UI does not claim success.

Firebase credentials and an enrolled physical device are required to verify an actual phone notification. The backend automatically removes FCM tokens Firebase reports as invalid.

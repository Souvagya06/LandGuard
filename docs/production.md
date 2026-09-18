# LandGuard production system

One product, three clients of one backend:

```
Authority Web (https://landguard.online)         Android app (LandGuard)
          │  HTTPS + WebSocket                          │ HTTPS            ▲ FCM (data messages)
          ▼                                             ▼                  │
                 LandGuard API  (https://api.landguard.online)  ───────────┘
                 ├── Regional monitoring engine (NASA GLC + Open-Meteo + Copernicus DEM
                 │   + Sentinel-2 / Sentinel-1 via Planetary Computer)
                 ├── Alerts (persisted, approval, dispatch, receipts)
                 └── Devices (FCM tokens), field reports, audit log
                                                        │
                        Android ── Nearby Connections mesh ──▶ nearby Android (offline)
```

* **Backend = single source of truth.** `backend/services/monitoring/` is a line-for-line port of the
  app's `RegionalAnalytics`. The web shows it; the app reads it first (`RegionalMonitoringRepository`)
  and only falls back to the public sources directly when the backend is unreachable.
  `app/src/test/.../BackendParityTest.kt` proves the app reproduces every backend area id, name and score.
* **Nothing is simulated.** Missing inputs are reported as unavailable; ALOS-4 PALSAR-3 is shown as
  unavailable (no public service). The What-If studio is simulation-only and cannot send alerts.

## Freshness vocabulary (web)

| State   | Meaning |
|---------|---------|
| LIVE    | Backend reachable, realtime channel open, observations within their refresh window |
| UPDATED | Observations current, received by periodic refresh (realtime reconnecting) |
| CACHED  | Last known real data — older than the refresh window, or backend unreachable |
| OFFLINE | Backend unreachable and nothing loaded; no data shown |

Every reading shows its source and observation time.

## The one alert structure

Defined in `backend/services/alert-contract.js`, mirrored by `frontend/src/types.ts` (`PublicAlert`)
and `app/.../data/alerts/AlertContract.kt` (`AlertDto`). The same JSON is used by REST, FCM (as strings)
and the Nearby mesh.

| Field | Notes |
|-------|-------|
| `alertId` | UUID; never regenerated on any hop |
| `zoneId`, `zoneName`, `lat`, `lng` | monitored area (e.g. `glc_2754_8856`) |
| `level` / `severity` | `low · moderate · high · critical` / upper-case; thresholds 25/50/75 everywhere |
| `message` | 1–500 chars |
| `timestamp`, `expiresAt` | ISO-8601 UTC; devices stop showing/relaying after expiry |
| `source` | `authority` · `risk_engine` |
| `status` | `awaiting_approval` (never public) · `active` · `cancelled` · `expired` |
| `origin` | `authority_web` · `api` |
| `hopCount` | 0 from the backend, +1 per mesh relay, max 6 |

### Alert pipeline

1. Authority creates the alert in the control center (`POST /alerts`). High/critical alerts from an
   operator wait for an incident commander (`POST /alerts/:id/approve`); commanders dispatch directly.
2. The backend persists it, broadcasts it on the WebSocket and sends a **data-only, high-priority**
   FCM multicast to every registered device (TTL = time to expiry). Invalid/expired tokens are removed;
   transient FCM errors are retried once. The result is stored on the alert and shown in the console.
3. Android `LandGuardFcmService` → `AlertIngestor`: de-duplicate by `alertId`, store in Room,
   notify once, relay over Nearby with `hopCount + 1`, send a receipt.
4. Phones without internet receive it over the mesh (also on later connection — store-and-forward),
   handle it the same way and queue their receipt until they are online.
5. On reconnect / app start the app calls `GET /alerts?updatedSince=…` for missed alerts and
   cancellations, flushes queued receipts and re-registers its token.
6. The console shows FCM acceptance and device confirmations (`received / opened / acknowledged`,
   by `fcm / sync / mesh`, max hop count).

## API surface (all on api.landguard.online)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /health` | – | liveness (no internals) |
| `GET /system/status` | – | aggregate health, push configured?, devices, freshness, coverage |
| `GET /auth/config`, `POST /auth/login`, `GET /auth/session` | – / – / bearer | authority sign-in |
| `GET /monitoring/summary · /zones · /zones/:id · /catalog` | – | shared regional monitoring |
| `GET /monitoring/analysis?lat&lng` | – (20/min) | Sentinel-2/1 + rainfall + DEM point analysis |
| `POST /monitoring/refresh` | operator | force refresh |
| `GET /alerts[?updatedSince&active]`, `GET /alerts/:id` | – | public alerts (Android sync) |
| `GET /alerts?view=authority` | operator | delivery + receipts |
| `POST /alerts`, `POST /alerts/:id/cancel` | operator | issue / cancel |
| `POST /alerts/:id/approve` | incident commander | two-person rule |
| `POST /alerts/:id/receipts` | – (120/min) | device delivery confirmation |
| `POST /devices` | – (30/min) | FCM token registration |
| `GET /devices` | operator | device list (never tokens) |
| `GET /zones`, `POST /predict` | – | What-If studio model |
| `GET/POST /reports`, `POST /reports/:id/verify` | – / field officer / operator | field reports |
| WebSocket `wss://api.landguard.online/` | – | `alert`, `alert.updated`, `alert.receipt`, `monitoring.updated` … |

## Deploying landguard.online + api.landguard.online

Requirements: a Linux server with Docker, ports 80/443 open.

1. **DNS** (at the registrar for landguard.online) — point all three names at the server:
   `landguard.online A <server-ip>`, `www.landguard.online A <server-ip>`, `api.landguard.online A <server-ip>`.
   (Today `landguard.online` serves the registrar's parking page and `api.landguard.online` has no record.)
2. `cp deploy/.env.production.example deploy/.env.production` and fill in `ACME_EMAIL`, `AUTH_SECRET`,
   `FIREBASE_SERVICE_ACCOUNT_BASE64` (Firebase Admin key for project `landguard-a4620`).
3. Create authority accounts and paste the printed JSON objects into `AUTHORITY_USERS=[…]`:
   `docker compose -f deploy/docker-compose.prod.yml run --rm -it api node backend/scripts/hash-password.js <user> incident_commander "Name"`
4. `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production up -d --build`
   Caddy obtains Let's Encrypt certificates for both domains and proxies the WebSocket.
5. Build and ship the Android release (it already targets `https://api.landguard.online/`, cleartext off).

### Verify

```bash
curl -s https://api.landguard.online/health
curl -s https://api.landguard.online/system/status | jq '.push, .devices, .monitoring.conditions'
curl -sI -H 'Origin: https://evil.example' https://api.landguard.online/health | grep -i access-control || echo "CORS closed"
```

Then: sign in at https://landguard.online, open **System status** (Firebase must read *Configured*),
install the app on two phones (both appear under *Registered devices*), send a HIGH alert from
**Send alert**, and watch *Accepted by FCM* and *Confirmed on devices* fill in. Turn one phone's internet
off before sending: it receives the alert over the mesh from the other phone (*Offline mesh · 1 hop*) and
its confirmation arrives when internet is restored.

## Local development

```bash
cd backend && npm install && npm test && npm run dev      # API on :8000 (needs AUTH_SECRET, CORS_ORIGINS in .env)
cd frontend && npm install && npm run dev                 # control center on :5173 → http://127.0.0.1:8000
```

Android debug builds can point at a local backend from *More → Server connection*; release builds cannot.

# LandGuard Alert System - Testing & Deployment Guide

## Quick Start

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

The new `ws` (WebSocket) library has been added automatically.

### 2. Start Backend Server

```bash
cd backend
npm start
```

You should see:
```
[LandGuard] Node.js backend with Dual-Agent ML running on http://127.0.0.1:8000
[LandGuard] WebSocket alert system available at ws://127.0.0.1:8000
```

### 3. Start Frontend Development Server (in another terminal)

```bash
cd frontend
npm install
npm run dev
```

Server runs at `http://127.0.0.1:5173`

## Testing Alert System

### Test 1: Manual WebSocket Connection Test

#### Using WebSocket CLI Tool

```bash
# Install wscat
npm install -g wscat

# Connect to backend
wscat -c ws://127.0.0.1:8000

# You should see connection message:
# {"type":"connection","message":"Connected to LandGuard alert system",...}

# Send ping
{"type":"ping"}

# You should receive:
# {"type":"pong",...}
```

#### Using Python

```python
import websocket
import json

def on_message(ws, message):
    print("Received:", message)

def on_open(ws):
    print("Connected to LandGuard!")
    ws.send(json.dumps({"type": "ping"}))

ws = websocket.WebSocketApp("ws://127.0.0.1:8000", on_message=on_message, on_open=on_open)
ws.run_forever()
```

### Test 2: Trigger Alert from Web Dashboard

1. Open browser: `http://127.0.0.1:5173` (frontend dev server)
2. Or open: `http://127.0.0.1:8000` (compiled frontend)
3. Navigate to Alerts page
4. Find a monitoring zone on the Dashboard
5. Click the alert button for any zone
6. Check the WebSocket connection:
   - The alert should appear in the web dashboard immediately
   - Any connected WebSocket clients (including the Android app) should receive the alert

### Test 3: Android App Alert Reception

#### On Android Emulator

1. Update `AlertWebSocketService.kt`:
   ```kotlin
   private val WEBSOCKET_URL = "ws://10.0.2.2:8000"  // Special alias for emulator host
   ```

2. Run Android app in emulator
3. Check logcat for connections:
   ```bash
   adb logcat AlertWebSocket:V *:S
   ```

4. You should see:
   ```
   I/AlertWebSocket: WebSocket connected
   I/AlertWebSocket: Server confirmed connection: client-xxx
   ```

5. Trigger alert from web dashboard
6. Check for notification on emulator
7. Verify logcat shows:
   ```
   I/AlertWebSocket: Processing alert: a-xxx from Zone-Name with level critical
   ```

#### On Physical Device

1. Find your backend server IP:
   ```bash
   # Linux/Mac
   ifconfig | grep "inet "
   
   # Windows
   ipconfig | findstr "IPv4"
   ```

2. Update `AlertWebSocketService.kt`:
   ```kotlin
   private val WEBSOCKET_URL = "ws://192.168.x.x:8000"  // Your server's LAN IP
   ```

3. Ensure device is on same WiFi network as backend
4. Build and run app on device:
   ```bash
   ./gradlew installDebug
   adb shell am start -n com.example.landguard/.MainActivity
   ```

5. Monitor logcat:
   ```bash
   adb logcat AlertWebSocket:V *:S
   ```

6. Trigger alert from web dashboard
7. Verify notification appears on device

## Alert Trigger API Call

You can also trigger alerts programmatically:

```bash
# Trigger alert for zone-001
curl -X POST http://127.0.0.1:8000/alerts \
  -H "Content-Type: application/json" \
  -d '{"zoneId": "zone-001"}'

# Response:
{
  "id": "a-1694702400000",
  "zoneId": "zone-001",
  "zoneName": "Example Zone",
  "level": "high",
  "message": "HIGH ALERT: Hazard index at Example Zone is 62%. Precipitation: 45.3mm/24h. Take immediate precaution.",
  "channel": "dashboard",
  "createdAt": "2024-09-10T12:00:00Z"
}
```

## Deployment Scenarios

### Scenario 1: Local Testing (All on Same Machine)

```
localhost:5173 (Frontend dev server)
    ↓ (HTTP + WebSocket)
localhost:8000 (Backend API)
    ↓ (WebSocket)
Android Emulator (ws://10.0.2.2:8000)
```

### Scenario 2: Local Testing (Physical Device + Local Machine)

```
192.168.x.x:5173 (Frontend dev server)
    ↓ (HTTP + WebSocket)
192.168.x.x:8000 (Backend API)
    ↓ (WebSocket - same WiFi)
Physical Device (ws://192.168.x.x:8000)
```

### Scenario 3: Production Deployment

For production, modify the configuration:

1. **Backend**: Update CORS origins in `server.js`
   ```javascript
   cors({
     origin: [
       'https://your-domain.com',
       'wss://your-domain.com',
     ]
   })
   ```

2. **WebSocket**: Use WSS (Secure WebSocket) with SSL certificate
   ```javascript
   const https = require('https');
   const fs = require('fs');
   
   const server = https.createServer({
     cert: fs.readFileSync('cert.pem'),
     key: fs.readFileSync('key.pem')
   }, app);
   ```

3. **Android**: Update WebSocket URL
   ```kotlin
   private val WEBSOCKET_URL = "wss://your-domain.com"  // Secure WebSocket
   ```

## Performance Metrics

### Connection Overhead

- Initial WebSocket handshake: ~50-100ms
- Message round-trip latency: 10-50ms (local network)
- Per-alert bandwidth: ~500 bytes

### Scalability

- Current implementation handles 50+ concurrent connections
- For 100+ connections, consider:
  - Load balancing with multiple backend instances
  - Message queue system (Redis, RabbitMQ)
  - Database persistence for alert history

## Architecture Improvements

### Phase 1 (Current)
✅ WebSocket alert broadcasting  
✅ Real-time Android notifications  
✅ Cross-platform synchronization  

### Phase 2 (Recommended)
- [ ] Persistent alert storage (database)
- [ ] Alert acknowledgment tracking
- [ ] Multi-user alert routing
- [ ] Alert filtering by risk level

### Phase 3 (Advanced)
- [ ] Offline alert queue
- [ ] End-to-end encryption
- [ ] Audit logging
- [ ] Alert expiration/TTL

## Monitoring & Debugging

### Backend Logs

Monitor WebSocket server logs:

```bash
# Watch server startup
npm start 2>&1 | grep -E "\[WebSocket\]|\[LandGuard\]"

# Monitor active connections
watch "curl -s http://127.0.0.1:8000/health | jq ."
```

### Android Logcat

```bash
# Alert WebSocket events
adb logcat AlertWebSocket:V *:S

# Notification events
adb logcat AlertNotifications:V *:S

# All LandGuard logs
adb logcat | grep -E "AlertWebSocket|AlertNotifications"
```

### Web Console

Open browser DevTools (F12) and check Console tab:
- WebSocket connection events
- Alert API calls
- Notification permissions

## Troubleshooting Checklist

- [ ] Backend is running: `curl http://127.0.0.1:8000/health`
- [ ] WebSocket connects: Check backend logs for `[WebSocket] Client connected`
- [ ] Firewall allows port 8000: `telnet 127.0.0.1 8000`
- [ ] Android device on same WiFi as backend
- [ ] Correct IP in `WEBSOCKET_URL`
- [ ] Notification permissions granted on device
- [ ] Do-Not-Disturb mode off on device
- [ ] Android app is running (foreground service active)

## Next Steps

1. **Test locally** with provided test cases
2. **Deploy** to your network environment
3. **Monitor** WebSocket connections and alert delivery
4. **Integrate** with your Firebase/SMS backend for multi-channel alerts
5. **Scale** to production with load balancing and persistence

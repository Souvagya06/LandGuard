# Alert System Architecture - Visual Diagrams

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           LandGuard Platform                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    LandGuard Backend (Node.js)                          │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │ Risk Model (Python JS Port)                                      │  │ │
│  │  │  - Agent A: Terrain Susceptibility                               │  │ │
│  │  │  - Agent B: Rainfall Trigger Probability                         │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                  ↑                                      │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │ HTTP Server (Express)                                            │  │ │
│  │  │ ┌────────────────────────────────────────────────────────────┐   │  │ │
│  │  │ │ GET /health          - Server status                       │   │  │ │
│  │  │ │ GET /zones           - All monitored locations            │   │  │ │
│  │  │ │ GET /zones/:id       - Single location                    │   │  │ │
│  │  │ │ POST /predict        - Custom risk prediction             │   │  │ │
│  │  │ │ GET /alerts          - Alert history                      │   │  │ │
│  │  │ │ POST /alerts         - Create alert (NEW: broadcasts)     │   │  │ │
│  │  │ │ GET /reports         - Field reports                      │   │  │ │
│  │  │ │ POST /reports        - Submit report                      │   │  │ │
│  │  │ └────────────────────────────────────────────────────────────┘   │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │ WebSocket Server (ws://)            [NEW COMPONENT]             │  │ │
│  │  │ ┌────────────────────────────────────────────────────────────┐   │  │ │
│  │  │ │ wsClients: Set<WebSocket>                                 │   │  │ │
│  │  │ │  ├─ Web Client (Browser)                                  │   │  │ │
│  │  │ │  ├─ Android Client 1 (Emulator/Device)                    │   │  │ │
│  │  │ │  └─ Android Client 2 (Emulator/Device)                    │   │  │ │
│  │  │ │                                                            │   │  │ │
│  │  │ │ Functions:                                                │   │  │ │
│  │  │ │  ├─ initializeWebSocket(server)                           │   │  │ │
│  │  │ │  └─ broadcastAlert(alert)                                 │   │  │ │
│  │  │ └────────────────────────────────────────────────────────────┘   │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                  ▲                                           │
│                    ┌─────────────┴──────────────┐                            │
│                    │                            │                            │
│                    ↓                            ↓                            │
│         ┌──────────────────────┐     ┌──────────────────────┐               │
│         │ Web Client (Browser) │     │ Android App (Mobile) │               │
│         ├──────────────────────┤     ├──────────────────────┤               │
│         │ React Dashboard      │     │ Kotlin + Android SDK │               │
│         │ ├─ Dashboard page    │     │ ├─ MainActivity      │               │
│         │ └─ Alerts page       │     │ └─ Alerts Activity   │               │
│         │                      │     │                      │               │
│         │ HTTP Polling:        │     │ WebSocket:           │               │
│         │ GET /zones (15s)     │     │ ws:// connection     │               │
│         │ GET /alerts (10s)    │     │ (persistent)         │               │
│         │                      │     │                      │               │
│         │ POST /alerts:        │     │ Foreground Service:  │               │
│         │ Trigger alert        │     │ AlertWebSocketService│               │
│         │                      │     │                      │               │
│         │ Display:             │     │ Notifications:       │               │
│         │ ├─ Zone map          │     │ AlertNotification... │               │
│         │ ├─ Risk scores       │     │ ├─ Rich content      │               │
│         │ ├─ Alert list        │     │ ├─ Color coded       │               │
│         │ └─ Analytics         │     │ ├─ Sound/Vibration   │               │
│         │                      │     │ └─ Tap to view       │               │
│         └──────────────────────┘     └──────────────────────┘               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Alert Delivery Flow

```
Time T0: User opens web dashboard
         └─ HTTP: GET /zones
         └─ Starts polling GET /alerts every 10 seconds

Time T5: User clicks "Send Alert" button
         │
         └─ HTTP: POST /alerts {"zoneId": "zone-001"}
            │
            ├─ Backend receives request
            │
            ├─ Find zone in ZONE_SEEDS
            │
            ├─ Evaluate risk model (ML)
            │  ├─ Agent A: Terrain susceptibility
            │  └─ Agent B: Rainfall trigger
            │
            ├─ Generate alert object:
            │  {
            │    "id": "a-1694702400000",
            │    "zoneName": "Assam Slopes",
            │    "level": "critical",
            │    "message": "CRITICAL ALERT: ...",
            │    "createdAt": "2024-09-10T12:00:00Z"
            │  }
            │
            ├─ Store in alerts[] array
            │
            ├─ HTTP Response: 200 OK (alert object)
            │
            └─ broadcastAlert(alert) [NEW]
               │
               ├─ Convert to JSON: {"type": "alert", "data": {...}}
               │
               └─ Send to ALL connected WebSocket clients:
                  │
                  ├─ Web Client (Browser)
                  │  └─ Receives via WebSocket (fast)
                  │     OR polls next GET /alerts (10s delay)
                  │
                  ├─ Android Client 1 (Emulator)
                  │  └─ AlertWebSocketService receives
                  │     └─ Calls AlertNotificationManager
                  │        └─ Shows notification
                  │           ├─ Title: "CRITICAL - Assam Slopes"
                  │           ├─ Red color
                  │           ├─ Alarm sound
                  │           ├─ SOS vibration pattern
                  │           └─ User taps: launches MainActivity
                  │
                  └─ Android Client 2 (Physical Device)
                     └─ Same as Client 1

Time T6: (1 second after alert creation)
         Web Dashboard:
         │ ├─ Next polling cycle (or WebSocket)
         │ └─ Sees new alert, displays in Alerts list
         │
         Android Emulator:
         │ ├─ Notification appears on screen
         │ └─ User sees rich notification
         │
         Android Device:
         │ ├─ Notification appears on screen
         │ └─ User sees rich notification
```

## WebSocket Message Sequence

```
Client                           Server                        Broadcast
  │                                │                               │
  ├──── WebSocket Connect ────────→│                               │
  │                                │                               │
  │                       ┌─────────────────────┐                  │
  │                       │ Server accepts      │                  │
  │                       │ Creates wsClients   │                  │
  │                       │ Assign clientId     │                  │
  │                       └─────────────────────┘                  │
  │                                │                               │
  │←─── {"type": "connection"} ────│ (Client confirmed connected)  │
  │     {"clientId": "xxx"}        │                               │
  │     {"timestamp": "..."}       │                               │
  │                                │                               │
  ├─────── {"type": "ping"} ───────→                               │
  │                                │                               │
  │←────── {"type": "pong"} ────────│                               │
  │                                │                               │
  │                                │  [User triggers alert on web] │
  │                                │←─ POST /alerts                │
  │                                │  (via HTTP)                   │
  │                                │                               │
  │                        ┌────────────────────────────────────┐  │
  │                        │ Server:                            │  │
  │                        │ 1. Create alert object             │  │
  │                        │ 2. Store in alerts[]               │  │
  │                        │ 3. Call broadcastAlert(alert)      │  │
  │                        │ 4. Loop through wsClients          │  │
  │                        │ 5. Send to each client             │  │
  │                        └────────────────────────────────────┘  │
  │                                │                               │
  │←──────── {"type": "alert",     │ (Broadcast to ALL clients)    │
  │           "data": {...},       │                               │
  │           "timestamp": "..."}──┤                               │
  │                                │                               │
  │      [App processes alert]     │                               │
  │      [Shows notification]      │                               │
  │                                │                               │
  ├─── Keep-alive ping/pong ──────→│ (Every 30 seconds or on demand)
  │←─── Keep-alive pong ───────────│                               │
  │                                │                               │
  └─ [Connection stays open] ──────→ [Waiting for next alert]
```

## Connection Lifecycle

```
Disconnected
     │
     ├─ User Opens App
     │
     └─→ Disconnected
         │
         ├─ onCreate() -> startForegroundService()
         │
         └─→ Connecting
             │
             ├─ AlertWebSocketService created
             ├─ createNotificationChannel()
             ├─ startForeground() (show status notification)
             │
             └─→ Connecting (WebSocket)
                 │
                 ├─ connectWebSocket()
                 ├─ new WebSocketClient(URI)
                 ├─ .connect()
                 │
                 └─→ Connected
                     │
                     ├─ onOpen() called
                     ├─ Send/Receive messages
                     ├─ Log "WebSocket connected"
                     │
                     └─→ Listening
                         │
                         ├─ Receive: {"type": "alert", ...}
                         ├─ handleWebSocketMessage()
                         ├─ processAlert()
                         ├─ showAlert() (notification)
                         │
                         └─→ Listening
                             │
                             ├─ Network disrupted
                             │  ├─ onClose() called
                             │  ├─ Log "WebSocket closed"
                             │  ├─ scheduleReconnect()
                             │  └─ Delay 3 seconds
                             │
                             └─→ Reconnecting
                                 │
                                 ├─ connectWebSocket()
                                 ├─ reconnectAttempts++
                                 │
                                 ├─ Max attempts? (10)
                                 │ ├─ No: Loop back to Connecting
                                 │ └─ Yes: Log error, stay disconnected
                                 │
                                 └─ [Retry cycle continues]

User closes app
     │
     ├─ onDestroy() called
     ├─ webSocketClient.close()
     │
     └─→ Disconnected
```

## Android Notification Display

```
Event: Alert received via WebSocket
       │
       └─ {"type": "alert", "data": {...}}
          │
          ├─ zoneId: "zone-001"
          ├─ zoneName: "Assam Slopes - Zone A"
          ├─ level: "critical"
          ├─ message: "CRITICAL ALERT: Hazard index..."
          ├─ riskLevel: "critical"
          │
          └─→ AlertNotificationManager.showAlert()
             │
             ├─ getAlertStyling("critical")
             │  ├─ Color: 0xFFD32F2F (Red)
             │  ├─ Priority: PRIORITY_MAX
             │  └─ Sound: ALARM tone
             │
             ├─ Create notification object:
             │  ├─ Title: "CRITICAL - Assam Slopes - Zone A"
             │  ├─ Text: "CRITICAL ALERT: Hazard index..."
             │  ├─ SmallIcon: ic_dialog_alert
             │  ├─ Color: Red
             │  ├─ Sound: Alarm
             │  ├─ Vibrate: [0, 500, 200, 500, 200, 500] (SOS)
             │  ├─ Priority: MAX
             │  └─ Click Intent: MainActivity with alert data
             │
             ├─ Display notification
             │  ├─ User sees:
             │  │  ┌──────────────────────────────────┐
             │  │  │ 🔔 CRITICAL - Assam Slopes - Zone A
             │  │  │                                  │
             │  │  │ CRITICAL ALERT: Hazard index    │
             │  │  │ at Assam Slopes - Zone A is     │
             │  │  │ 87%. Precipitation:             │
             │  │  │ 65.3mm/24h...                  │
             │  │  │                      [View Details]
             │  │  └──────────────────────────────────┘
             │  │  Red banner, Alarm sound, SOS vibration
             │  │
             │  └─ User taps → MainActivity
             │     └─ Receives intent extras:
             │        ├─ alertId: "a-1694702400000"
             │        ├─ zoneName: "Assam Slopes..."
             │        ├─ riskLevel: "critical"
             │        └─ message: "CRITICAL ALERT..."
             │
             └─→ App can process/store/display alert
                 ├─ Show alert details page
                 ├─ Log to local database
                 ├─ Send acknowledgment
                 └─ Update UI
```

## Network Topology

```
┌─────────────────────────────────────────────────────────────┐
│                   WiFi Network (192.168.1.0/24)             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Backend Server                      │  │
│  │              192.168.1.100:8000                      │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │ Node.js + Express + WebSocket                │   │  │
│  │  │ ├─ HTTP on port 8000                        │   │  │
│  │  │ └─ WebSocket on port 8000                   │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│                  ▲                          ▲               │
│                  │                          │               │
│                  │ HTTP                     │ WebSocket     │
│         ┌────────┴──────────┐      ┌────────┴──────────┐   │
│         │                   │      │                   │   │
│  ┌──────────────┐   ┌──────────────────┐  ┌──────────────────┐
│  │   Laptop     │   │  Android Phone   │  │  Android Tablet  │
│  │ 192.168.1.10 │   │ 192.168.1.50     │  │ 192.168.1.60     │
│  │              │   │                  │  │                  │
│  │ Browser:     │   │ App:             │  │ App:             │
│  │ localhost:   │   │ AlertWebSocket   │  │ AlertWebSocket   │
│  │ 5173         │   │ Service running  │  │ Service running  │
│  │              │   │                  │  │                  │
│  │ Dashboard    │   │ Notifications    │  │ Notifications    │
│  │ → Alerts tab │   │ + Foreground svc │  │ + Foreground svc │
│  │ → Send Alert │   │                  │  │                  │
│  └──────────────┘   └──────────────────┘  └──────────────────┘
│                                                             │
│  Legend:                                                   │
│  ═════════════════════════════════════════════════════    │
│  HTTP: Request/Response (polling)                          │
│  WebSocket: Persistent bidirectional connection            │
│  Local IP: Device on same WiFi network                     │
│  Port 8000: Backend server listening                       │
└─────────────────────────────────────────────────────────────┘
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ React Dashboard Component                               │   │
│  │ ├─ Dashboard.tsx                                        │   │
│  │ │  ├─ useQuery('/zones')                               │   │
│  │ │  ├─ useQuery('/alerts')                              │   │
│  │  │  ├─ ZonePanel component                             │   │
│  │  │  │  └─ [Send Alert] button                          │   │
│  │  │  └─ RiskMap component                               │   │
│  │  │                                                      │   │
│  │  └─ Alerts.tsx                                         │   │
│  │     ├─ useQuery('/alerts')                             │   │
│  │     └─ Display alert list                              │   │
│  │                                                         │   │
│  │ API Client: lib/api.ts                                 │   │
│  │ ├─ fetchZones()                                        │   │
│  │ ├─ fetchAlerts()                                       │   │
│  │ └─ triggerAlert(zoneId)                                │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│            │                                     │               │
│            ├─ HTTP: POST /alerts         HTTP: GET /alerts      │
│            │ GET /zones (15s poll)       (10s poll)             │
│            │                                                     │
└────────────┼─────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Express Server: server.js                               │   │
│  │ ├─ app.get('/zones')                                    │   │
│  │ ├─ app.get('/alerts')                                   │   │
│  │ ├─ app.post('/alerts') ─────→ broadcastAlert()          │   │
│  │ └─ app.post('/predict')                                 │   │
│  │                                                         │   │
│  │ WebSocket Server:                                       │   │
│  │ ├─ new WebSocket.Server()                               │   │
│  │ ├─ wsClients: Set<WebSocket>                            │   │
│  │ ├─ onConnection: add to wsClients                       │   │
│  │ ├─ onClose: remove from wsClients                       │   │
│  │ └─ broadcastAlert(): send to all wsClients              │   │
│  │                                                         │   │
│  │ Risk Model: services/risk-model.js                      │   │
│  │ ├─ evaluateRisk(payload)                                │   │
│  │ ├─ Agent A: terrain susceptibility                      │   │
│  │ └─ Agent B: rainfall trigger                            │   │
│  │                                                         │   │
│  │ In-Memory Storage:                                      │   │
│  │ ├─ alerts[] array                                       │   │
│  │ ├─ weatherCache (10 min TTL)                            │   │
│  │ └─ ZONE_SEEDS (loaded from CSV)                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│            │                                     │               │
│            ├─ WebSocket broadcast    HTTP responses             │
│            │ (alert to all clients)   (alerts/zones/etc)        │
│            │                                                     │
└────────────┼──────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Android Application                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ MainActivity: Activity                                  │   │
│  │ ├─ onCreate(): startForegroundService()                 │   │
│  │ ├─ onResume(): initialize UI                            │   │
│  │ └─ handleAlertIntent()                                  │   │
│  │                                                         │   │
│  │ AlertWebSocketService: Service                          │   │
│  │ ├─ onCreate(): create notification channel              │   │
│  │ ├─ onStartCommand(): connectWebSocket()                 │   │
│  │ ├─ WebSocketClient:                                     │   │
│  │ │  ├─ onOpen(): log connection                          │   │
│  │ │  ├─ onMessage(): handleWebSocketMessage()             │   │
│  │ │  ├─ onClose(): scheduleReconnect()                    │   │
│  │ │  └─ onError(): attempt reconnect                      │   │
│  │ ├─ handleWebSocketMessage(json):                        │   │
│  │ │  ├─ if type="alert": processAlert()                   │   │
│  │ │  └─ if type="pong": log heartbeat                     │   │
│  │ └─ processAlert(alertData):                             │   │
│  │    └─ notificationManager.showAlert()                   │   │
│  │                                                         │   │
│  │ AlertNotificationManager: Helper                        │   │
│  │ ├─ createNotificationChannel()                          │   │
│  │ ├─ showAlert(id, zone, level, message):                 │   │
│  │ │  ├─ getAlertStyling(level) → color/sound/vibrate      │   │
│  │ │  ├─ NotificationCompat.Builder                        │   │
│  │ │  ├─ set content, icons, sounds, vibrations            │   │
│  │ │  └─ notificationManager.notify()                      │   │
│  │ └─ sendConnectionStatus(status)                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

These diagrams show:
1. **System Architecture** - All components and their relationships
2. **Alert Delivery Flow** - Step-by-step process from trigger to display
3. **WebSocket Message Sequence** - Protocol communication
4. **Connection Lifecycle** - App connection states and transitions
5. **Notification Display** - Android notification rendering
6. **Network Topology** - WiFi network layout
7. **Component Interaction** - Frontend, backend, and Android integration

Use these diagrams as reference for understanding and troubleshooting the system!

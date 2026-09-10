# LandGuard Alert System - WebSocket API Documentation

## Overview

The LandGuard alert system uses WebSocket protocol to enable real-time synchronization between the web dashboard and mobile app. This document describes the complete WebSocket API specification.

## Connection

### Endpoint

```
ws://127.0.0.1:8000                    # Development
wss://your-domain.com                  # Production (with SSL)
ws://10.0.2.2:8000                     # Android Emulator
ws://192.168.x.x:8000                  # Physical Device (replace with your IP)
```

### Connection Handshake

1. Client initiates WebSocket connection
2. Server responds with connection confirmation
3. Connection is established and ready for messages

## Message Format

All WebSocket messages are JSON objects with the following structure:

```json
{
  "type": "message_type",
  "data": {},
  "timestamp": "2024-09-10T12:00:00.000Z"
}
```

## Message Types

### 1. Connection Confirmation

**Sent by**: Server  
**When**: Immediately after client connects  
**Direction**: Server → Client

```json
{
  "type": "connection",
  "message": "Connected to LandGuard alert system",
  "clientId": "client-1694702400000-a1b2c3d4e5",
  "timestamp": "2024-09-10T12:00:00.000Z"
}
```

**Fields**:
- `type`: Always `"connection"`
- `message`: Human-readable connection message
- `clientId`: Unique identifier for this client connection
- `timestamp`: Server timestamp

---

### 2. Alert

**Sent by**: Server  
**When**: Alert is triggered from web dashboard  
**Direction**: Server → Client (broadcast to all connected clients)

```json
{
  "type": "alert",
  "data": {
    "id": "a-1694702400000",
    "zoneId": "zone-001",
    "zoneName": "Assam Slopes - Zone A",
    "level": "critical",
    "message": "CRITICAL ALERT: Hazard index at Assam Slopes - Zone A is 87%. Precipitation: 65.3mm/24h. Take immediate precaution.",
    "channel": "dashboard",
    "createdAt": "2024-09-10T12:00:00.000Z"
  },
  "timestamp": "2024-09-10T12:00:00.000Z"
}
```

**Fields in `data`**:
- `id`: Unique alert identifier
- `zoneId`: ID of the monitored zone
- `zoneName`: Human-readable zone name
- `level`: Risk level - one of: `critical`, `high`, `moderate`, `low`
- `message`: Full alert message with details
- `channel`: Alert source - `"dashboard"` for web-triggered alerts
- `createdAt`: Alert creation timestamp

**Risk Levels**:
| Level | Description | Color | Priority |
|-------|-------------|-------|----------|
| `critical` | Immediate danger | Red | Urgent |
| `high` | High risk | Orange | High |
| `moderate` | Elevated risk | Amber | Medium |
| `low` | Low risk | Green | Low |

---

### 3. Ping

**Sent by**: Client  
**When**: Keep-alive check (optional)  
**Direction**: Client → Server

```json
{
  "type": "ping",
  "timestamp": "2024-09-10T12:00:00.000Z"
}
```

**Purpose**: Keep connection alive and check server responsiveness  
**Server Response**: Sends `pong` message

---

### 4. Pong

**Sent by**: Server  
**When**: Response to `ping` message  
**Direction**: Server → Client

```json
{
  "type": "pong",
  "timestamp": "2024-09-10T12:00:00.000Z"
}
```

---

## Behavior Specifications

### Connection Lifecycle

```
Client initiates connection
         ↓
Server accepts connection
         ↓
Server sends "connection" message
         ↓
Connection ready for alert streaming
         ↓
Client/Server can exchange ping/pong
         ↓
[Alerts arrive and are broadcast]
         ↓
Connection closed (client disconnects, network error, etc)
         ↓
Client should attempt reconnection
```

### Reconnection Strategy

- **Reconnect Delay**: 3 seconds
- **Max Reconnection Attempts**: 10
- **Backoff**: Linear (no exponential backoff currently)
- **Total Timeout**: 30 seconds maximum

### Broadcast Behavior

When an alert is created via `POST /alerts` endpoint:

1. Alert is stored in server memory
2. Alert message is serialized to JSON
3. Message is broadcast to ALL connected WebSocket clients
4. Server logs number of successful deliveries
5. Clients receive alert independently

### Message Ordering

- Messages are delivered in order (FIFO)
- No message queuing or reordering occurs
- If client is disconnected when alert is sent, alert is lost (no persistent queue)

## HTTP API Integration

### Create Alert (HTTP)

Triggers alert creation and WebSocket broadcast simultaneously.

```bash
POST /alerts
Content-Type: application/json

{
  "zoneId": "zone-001"
}
```

**Response**:
```json
{
  "id": "a-1694702400000",
  "zoneId": "zone-001",
  "zoneName": "Assam Slopes - Zone A",
  "level": "critical",
  "message": "CRITICAL ALERT: ...",
  "channel": "dashboard",
  "createdAt": "2024-09-10T12:00:00.000Z"
}
```

**Side Effects**:
- Alert object is added to in-memory alert storage
- Alert is broadcast to all connected WebSocket clients immediately

### Get Alerts (HTTP)

Retrieve all alerts created during this session.

```bash
GET /alerts
```

**Response**:
```json
[
  {
    "id": "a-1694702400000",
    "zoneId": "zone-001",
    "zoneName": "Assam Slopes - Zone A",
    "level": "critical",
    "message": "CRITICAL ALERT: ...",
    "channel": "dashboard",
    "createdAt": "2024-09-10T12:00:00.000Z"
  },
  ...
]
```

**Note**: This returns alerts from in-memory storage only. No persistence across server restarts.

## Client Implementation Requirements

### Minimum WebSocket Handler

```javascript
// JavaScript / Browser
const ws = new WebSocket('ws://127.0.0.1:8000');

ws.onopen = () => {
  console.log('Connected');
  // Can start sending messages
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'connection':
      console.log('Connection confirmed:', message.clientId);
      break;
    case 'alert':
      console.log('Alert received:', message.data);
      // Show notification to user
      break;
    case 'pong':
      console.log('Pong received');
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
  // Implement reconnection logic
};
```

### Kotlin Implementation (Android)

See `AlertWebSocketService.kt` for complete implementation.

Key requirements:
- Extends `WebSocketClient` from `org.java-websocket` library
- Implements `onOpen`, `onMessage`, `onClose`, `onError` callbacks
- Parses incoming JSON messages
- Maintains reconnection logic
- Runs in background service

## Error Handling

### Connection Errors

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| Network unreachable | `onError` called | Automatic reconnect |
| Server offline | Connection times out | Automatic reconnect |
| Invalid WebSocket URL | Immediate failure | Check URL in config |
| Connection refused | `onError` called | Automatic reconnect |

### Message Errors

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| Malformed JSON | Message logged as error | Continue receiving |
| Unknown message type | Logged as debug | Continue receiving |
| Missing required fields | Alert processed partially | Log warning |

## Performance Characteristics

### Latency

- WebSocket handshake: 50-100ms (first time)
- Message delivery: 10-50ms (local network)
- End-to-end latency: 100-200ms (typical)

### Message Size

- Connection message: ~200 bytes
- Alert message: 400-800 bytes (varies by message length)
- Ping/Pong: ~50 bytes

### Connection Pool

- Current: Supports 50+ concurrent connections
- Each connection: ~1KB memory overhead
- No message queuing (alerts lost if disconnected)

## Security Considerations

### Current Implementation

- No authentication/authorization
- No message encryption
- All WebSocket connections are accepted

### For Production

1. **Authentication**:
   - Add JWT token validation on connection
   - Implement per-user alert routing

2. **Encryption**:
   - Use WSS (secure WebSocket) with SSL/TLS
   - Implement message-level encryption if needed

3. **Rate Limiting**:
   - Limit alerts per zone per minute
   - Prevent alert spam

4. **Logging**:
   - Log all alert creations
   - Track client connections/disconnections
   - Maintain audit trail

## Examples

### JavaScript Frontend

```javascript
class AlertManager {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.listeners = [];
  }

  connect() {
    this.ws = new WebSocket(this.serverUrl);
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'alert') {
        this.listeners.forEach(listener => {
          listener(message.data);
        });
      }
    };
    
    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 3000);
    };
  }

  onAlert(callback) {
    this.listeners.push(callback);
  }
}

// Usage
const manager = new AlertManager('ws://127.0.0.1:8000');
manager.connect();
manager.onAlert((alert) => {
  console.log('New alert:', alert.zoneName, alert.level);
  showNotification(alert);
});
```

### Python Client

```python
import websocket
import json
import threading
import time

class AlertClient:
    def __init__(self, url):
        self.url = url
        self.ws = None
        
    def connect(self):
        self.ws = websocket.WebSocketApp(
            self.url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_close=self.on_close,
            on_error=self.on_error
        )
        self.ws.run_forever()
    
    def on_open(self, ws):
        print("Connected")
    
    def on_message(self, ws, message):
        data = json.loads(message)
        if data['type'] == 'alert':
            print(f"ALERT: {data['data']['zoneName']} - {data['data']['level']}")
    
    def on_close(self, ws, close_status_code, close_msg):
        print("Disconnected, reconnecting...")
        time.sleep(3)
        self.connect()
    
    def on_error(self, ws, error):
        print(f"Error: {error}")

# Usage
client = AlertClient('ws://127.0.0.1:8000')
client.connect()
```

## Future Enhancements

1. **Message Filtering**
   - Allow clients to specify interest in specific zones
   - Reduce bandwidth for multi-zone scenarios

2. **Alert Acknowledgment**
   - Clients send ACK for received alerts
   - Server tracks delivery confirmation

3. **Historical Retrieval**
   - Fetch missed alerts when reconnecting
   - Maintain alert history window (e.g., last 100)

4. **Bidirectional Commands**
   - Server can request client status
   - Clients can submit field reports via WebSocket

5. **Compression**
   - Enable WebSocket per-message deflate
   - Reduce bandwidth for high-traffic scenarios

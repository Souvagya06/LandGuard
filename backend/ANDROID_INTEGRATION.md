# LandGuard Alert Synchronization - Android Integration Guide

## Overview

This guide explains how to integrate the LandGuard alert synchronization system into the Android app. When an alert is triggered from the web dashboard, it will automatically appear as a notification on the Android device connected to the same WiFi network.

## Architecture

```
Web Dashboard (React)
        ↓
POST /alerts endpoint (Node.js Express)
        ↓
WebSocket Broadcast (ws://backend:8000)
        ↓
Android App (WebSocket Client)
        ↓
Push Notification
```

## Implementation Steps

### 1. Add Dependencies to Android App

Add the following dependencies to `app/build.gradle.kts`:

```kotlin
dependencies {
    // WebSocket client
    implementation("org.java-websocket:Java-WebSocket:1.5.4")
    
    // Coroutines for async operations
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    
    // Gson for JSON parsing
    implementation("com.google.code.gson:gson:2.10.1")
}
```

### 2. Create WebSocket Client Service

Create file: `app/src/main/java/com/example/landguard/service/AlertWebSocketService.kt`

The implementation is provided in the accompanying file `AlertWebSocketService.kt`.

### 3. Create Notification Manager

Create file: `app/src/main/java/com/example/landguard/notifications/AlertNotificationManager.kt`

The implementation is provided in the accompanying file `AlertNotificationManager.kt`.

### 4. Add Permissions to AndroidManifest.xml

```xml
<manifest ...>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <application ...>
        <!-- Add notification channel creation service -->
        <service
            android:name=".service.AlertWebSocketService"
            android:exported="false" />
    </application>
</manifest>
```

### 5. Initialize in MainActivity

In your `MainActivity.kt`:

```kotlin
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.example.landguard.service.AlertWebSocketService

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Start WebSocket service
        val intent = Intent(this, AlertWebSocketService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }
}
```

### 6. Handle Notification Click

In your manifest, define how to handle notification taps:

```kotlin
// In AlertNotificationManager.kt, update the notification intent
val intent = Intent(context, MainActivity::class.java).apply {
    putExtra("alertId", alertId)
    putExtra("zoneName", zoneName)
    putExtra("riskLevel", riskLevel)
    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
}

val pendingIntent = PendingIntent.getActivity(
    context,
    alertId.hashCode(),
    intent,
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
)
```

## Configuration

### Backend IP Address

Update the WebSocket server URL in `AlertWebSocketService.kt`:

```kotlin
// For devices on same WiFi, use your backend server IP
private val WEBSOCKET_URL = "ws://192.168.x.x:8000"  // Replace with your server IP
```

To find your backend server IP on the same WiFi:
- **Linux/Mac**: `ifconfig` or `hostname -I`
- **Windows**: `ipconfig` and look for IPv4 Address
- **Docker**: If using docker-compose, use the service name or host machine IP

### Testing Locally

If testing on the same machine (emulator):
- For Android Emulator: Use `ws://10.0.2.2:8000` (special alias pointing to host)
- For Physical Device on WiFi: Use `ws://192.168.x.x:8000` (your machine's LAN IP)

## Alert Message Format

The WebSocket sends alerts in this JSON format:

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
    "createdAt": "2024-09-10T12:00:00Z"
  },
  "timestamp": "2024-09-10T12:00:00Z"
}
```

## Notification Levels

Notifications are color-coded and prioritized based on risk level:

| Risk Level | Color | Priority | Sound |
|-----------|-------|----------|-------|
| `critical` | Red | High | Alert sound |
| `high` | Orange | High | Alert sound |
| `moderate` | Amber | Normal | Default sound |
| `low` | Green | Low | Silent |

## Troubleshooting

### WebSocket Connection Issues

1. **Cannot connect to backend**
   - Verify backend is running: `cd backend && npm start`
   - Check firewall allows port 8000
   - Verify correct IP address in `WEBSOCKET_URL`
   - Ensure device is on same WiFi network

2. **Connection drops frequently**
   - The service auto-reconnects after 3 seconds
   - Check device battery saver settings
   - Verify WiFi signal strength

3. **Notifications not appearing**
   - Check notification permissions are granted
   - Verify notification channel is created
   - Check device do-not-disturb settings

### Logcat Output

Filter logs by tag `AlertWebSocket`:

```bash
adb logcat AlertWebSocket:V *:S
```

## Integration Checklist

- [ ] Added WebSocket dependencies to build.gradle.kts
- [ ] Created AlertWebSocketService.kt
- [ ] Created AlertNotificationManager.kt
- [ ] Updated AndroidManifest.xml with permissions and service
- [ ] Initialized AlertWebSocketService in MainActivity
- [ ] Updated WEBSOCKET_URL with correct backend IP
- [ ] Tested notification permissions flow
- [ ] Tested WebSocket connection in logcat
- [ ] Triggered test alert from web dashboard
- [ ] Verified notification appears on Android device

## Next Steps

1. Deploy and test with actual backend server
2. Add persistent storage for alerts in app
3. Implement alert history view in Android UI
4. Add alert filtering by risk level
5. Add offline queue for alerts when disconnected

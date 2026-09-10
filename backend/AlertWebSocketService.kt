package com.example.landguard.service

import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.landguard.notifications.AlertNotificationManager
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.net.URI
import java.net.URISyntaxException

/**
 * AlertWebSocketService - Handles real-time alert synchronization from LandGuard backend
 *
 * This service maintains a WebSocket connection to the backend server and receives
 * alerts in real-time. When an alert is received, it displays a notification.
 *
 * The service automatically reconnects on connection loss and runs as a foreground
 * service to ensure it stays alive.
 */
class AlertWebSocketService : Service() {
    companion object {
        private const val TAG = "AlertWebSocket"
        private const val NOTIFICATION_ID = 1337
        private const val RECONNECT_DELAY_MS = 3000L  // 3 seconds
        private const val MAX_RECONNECT_ATTEMPTS = 10
    }

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.Main)
    private var webSocketClient: WebSocketClient? = null
    private var reconnectAttempts = 0
    private lateinit var notificationManager: AlertNotificationManager

    // Update this to match your backend server IP address
    // For emulator: ws://10.0.2.2:8000
    // For physical device on same WiFi: ws://192.168.x.x:8000
    private val WEBSOCKET_URL = "ws://10.0.2.2:8000"

    inner class LocalBinder : Binder() {
        fun getService(): AlertWebSocketService = this@AlertWebSocketService
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")
        notificationManager = AlertNotificationManager(this)
        
        // Create notification channel (required for Android 8+)
        notificationManager.createNotificationChannel()
        
        // Start as foreground service with notification
        val notification = NotificationCompat.Builder(this, AlertNotificationManager.CHANNEL_ID)
            .setContentTitle("LandGuard Monitoring")
            .setContentText("Connected to alert system...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        
        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service starting")
        
        // Start WebSocket connection
        connectWebSocket()
        
        return START_STICKY  // Restart service if killed
    }

    private fun connectWebSocket() {
        try {
            val uri = URI(WEBSOCKET_URL)
            
            webSocketClient = object : WebSocketClient(uri) {
                override fun onOpen(handshake: ServerHandshake?) {
                    Log.i(TAG, "WebSocket connected")
                    reconnectAttempts = 0
                    notificationManager.sendConnectionStatus("Connected to LandGuard")
                }

                override fun onMessage(message: String?) {
                    Log.d(TAG, "Message received: ${message?.take(100)}")
                    message?.let { handleWebSocketMessage(it) }
                }

                override fun onClose(code: Int, reason: String?, remote: Boolean) {
                    Log.w(TAG, "WebSocket closed (code: $code, reason: $reason, remote: $remote)")
                    notificationManager.sendConnectionStatus("Reconnecting...")
                    scheduleReconnect()
                }

                override fun onError(ex: Exception?) {
                    Log.e(TAG, "WebSocket error: ${ex?.message}")
                    ex?.printStackTrace()
                    scheduleReconnect()
                }
            }
            
            webSocketClient?.connect()
        } catch (e: URISyntaxException) {
            Log.e(TAG, "Invalid WebSocket URI: $WEBSOCKET_URL", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect to WebSocket", e)
            scheduleReconnect()
        }
    }

    private fun handleWebSocketMessage(message: String) {
        try {
            val jsonObject = JsonParser.parseString(message).asJsonObject
            val type = jsonObject.get("type")?.asString
            
            when (type) {
                "connection" -> {
                    val clientId = jsonObject.get("clientId")?.asString ?: "unknown"
                    Log.i(TAG, "Server confirmed connection: $clientId")
                }
                
                "alert" -> {
                    val alertData = jsonObject.get("data").asJsonObject
                    processAlert(alertData)
                }
                
                "pong" -> {
                    Log.d(TAG, "Pong received")
                }
                
                else -> {
                    Log.d(TAG, "Unknown message type: $type")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing WebSocket message", e)
        }
    }

    private fun processAlert(alertData: JsonObject) {
        try {
            val id = alertData.get("id")?.asString ?: ""
            val zoneName = alertData.get("zoneName")?.asString ?: "Unknown Zone"
            val level = alertData.get("level")?.asString ?: "low"
            val message = alertData.get("message")?.asString ?: "New alert received"
            val createdAt = alertData.get("createdAt")?.asString ?: ""
            
            Log.i(TAG, "Processing alert: $id from $zoneName with level $level")
            
            // Show notification
            notificationManager.showAlert(
                alertId = id,
                zoneName = zoneName,
                riskLevel = level,
                message = message,
                timestamp = createdAt
            )
            
            // Optional: Log alert to local database or file
            logAlertLocally(id, zoneName, level, message, createdAt)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error processing alert", e)
        }
    }

    private fun logAlertLocally(id: String, zoneName: String, level: String, message: String, timestamp: String) {
        // TODO: Implement local storage of alerts
        // This could be done with Room database, SharedPreferences, or file storage
        Log.d(TAG, "Alert logged: [$level] $zoneName - $message")
    }

    private fun scheduleReconnect() {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++
            Log.d(TAG, "Scheduling reconnect attempt $reconnectAttempts/$MAX_RECONNECT_ATTEMPTS in ${RECONNECT_DELAY_MS}ms")
            
            serviceScope.launch {
                delay(RECONNECT_DELAY_MS)
                connectWebSocket()
            }
        } else {
            Log.e(TAG, "Max reconnection attempts reached")
            // TODO: Show error notification
        }
    }

    fun sendPing() {
        try {
            val pingMessage = """{"type":"ping","timestamp":"${System.currentTimeMillis()}"}"""
            webSocketClient?.send(pingMessage)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending ping", e)
        }
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Service destroyed")
        try {
            webSocketClient?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Error closing WebSocket", e)
        }
    }
}

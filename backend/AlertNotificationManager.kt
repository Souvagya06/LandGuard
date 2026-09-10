package com.example.landguard.notifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.landguard.MainActivity
import kotlin.random.Random

/**
 * AlertNotificationManager - Handles notification display for LandGuard alerts
 *
 * Creates and manages notifications based on alert severity levels.
 * Uses different colors, sounds, and priorities for each risk level.
 */
class AlertNotificationManager(private val context: Context) {
    companion object {
        const val CHANNEL_ID = "landguard_alerts"
        const val CHANNEL_NAME = "LandGuard Alerts"
        private const val TAG = "AlertNotifications"
    }

    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Landslide and hazard alerts"
                enableVibration(true)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(channel)
            Log.d(TAG, "Notification channel created")
        }
    }

    /**
     * Show an alert notification
     */
    fun showAlert(
        alertId: String,
        zoneName: String,
        riskLevel: String,
        message: String,
        timestamp: String
    ) {
        try {
            val (color, priority, soundUri) = getAlertStyling(riskLevel)
            
            // Create intent for when notification is tapped
            val intent = Intent(context, MainActivity::class.java).apply {
                putExtra("alertId", alertId)
                putExtra("zoneName", zoneName)
                putExtra("riskLevel", riskLevel)
                putExtra("message", message)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            
            val pendingIntent = PendingIntent.getActivity(
                context,
                alertId.hashCode(),
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle("$riskLevel.toUpperCase() - $zoneName")
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setColor(color)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(priority)
                .setSound(soundUri)
                .setVibrate(getVibratePattern(riskLevel))
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .addAction(
                    android.R.drawable.ic_dialog_info,
                    "View Details",
                    pendingIntent
                )
                .build()
            
            val notificationId = Random.nextInt(10000)
            notificationManager.notify(notificationId, notification)
            
            Log.i(TAG, "Alert notification shown: $alertId ($riskLevel) - $notificationId")
        } catch (e: Exception) {
            Log.e(TAG, "Error showing notification", e)
        }
    }

    /**
     * Send connection status notification
     */
    fun sendConnectionStatus(status: String) {
        try {
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setContentTitle("LandGuard")
                .setContentText(status)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setAutoCancel(false)
                .build()
            
            notificationManager.notify(999, notification)
            Log.d(TAG, "Status notification: $status")
        } catch (e: Exception) {
            Log.e(TAG, "Error sending status notification", e)
        }
    }

    /**
     * Get styling (color, priority, sound) based on risk level
     */
    private fun getAlertStyling(riskLevel: String): Triple<Int, Int, android.net.Uri?> {
        return when (riskLevel.lowercase()) {
            "critical" -> Triple(
                0xFFD32F2F.toInt(),  // Red
                NotificationCompat.PRIORITY_MAX,
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            )
            
            "high" -> Triple(
                0xFFF57C00.toInt(),  // Orange
                NotificationCompat.PRIORITY_HIGH,
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            )
            
            "moderate" -> Triple(
                0xFFFBC02D.toInt(),  // Amber
                NotificationCompat.PRIORITY_DEFAULT,
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            )
            
            else -> Triple(
                0xFF4CAF50.toInt(),  // Green
                NotificationCompat.PRIORITY_LOW,
                null
            )
        }
    }

    /**
     * Get vibration pattern based on risk level
     */
    private fun getVibratePattern(riskLevel: String): LongArray {
        return when (riskLevel.lowercase()) {
            "critical" -> longArrayOf(0, 500, 200, 500, 200, 500)  // SOS pattern
            "high" -> longArrayOf(0, 400, 200, 400)
            "moderate" -> longArrayOf(0, 200, 100, 200)
            else -> longArrayOf(0)  // No vibration for low
        }
    }

    /**
     * Cancel a notification
     */
    fun cancelNotification(notificationId: Int) {
        notificationManager.cancel(notificationId)
        Log.d(TAG, "Notification cancelled: $notificationId")
    }

    /**
     * Cancel all notifications
     */
    fun cancelAllNotifications() {
        notificationManager.cancelAll()
        Log.d(TAG, "All notifications cancelled")
    }
}

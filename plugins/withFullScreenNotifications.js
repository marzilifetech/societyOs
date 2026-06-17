/**
 * Expo config plugin: full-screen, screen-waking ("call-style") push alerts on
 * Android, WITHOUT changing the existing notification stack.
 *
 * Design goal: keep FCM + expo-notifications exactly as they are. We do NOT add
 * @react-native-firebase or notifee. Instead we subclass Expo's OWN FCM service
 * (`ExpoFirebaseMessagingService`, which is `open`) and register our subclass as
 * the single MESSAGING_EVENT handler:
 *   - data messages with `data.fullScreen == "true"`  → raise a full-screen
 *     intent to a dedicated lock-screen Activity (wakes the screen).
 *   - every other message                              → `super.onMessageReceived`
 *     so expo-notifications keeps handling it untouched.
 *
 * The FCM Android SDK is already bundled by expo-notifications, so this adds no
 * dependency. It relies on Expo internals that are `open` today — re-validate on
 * major expo-notifications upgrades.
 *
 * iOS: no full-screen-from-push API exists without CallKit; iOS relies on the
 * APNs interruption level set server-side. This plugin is Android-only.
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SERVICE_CLASS = 'FullScreenMessagingService';
const ACTIVITY_CLASS = 'FullScreenAlertActivity';
const EXPO_SERVICE = 'expo.modules.notifications.service.ExpoFirebaseMessagingService';
const FULL_SCREEN_PERMISSION = 'android.permission.USE_FULL_SCREEN_INTENT';

function serviceKotlin(pkg) {
  return `package ${pkg}

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

/**
 * Intercepts FCM data messages flagged \`fullScreen=true\` and raises a
 * full-screen intent (call-style, wakes the screen). Everything else is
 * delegated to Expo's default handling via \`super\` so the existing
 * expo-notifications pipeline is unchanged.
 */
class ${SERVICE_CLASS} : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    if (remoteMessage.data["fullScreen"] == "true") {
      showFullScreen(remoteMessage.data)
      return
    }
    super.onMessageReceived(remoteMessage)
  }

  private fun showFullScreen(data: Map<String, String>) {
    val channelId = data["channelId"] ?: "emergency_sos"
    val title = data["title"] ?: "Alert"
    val body = data["body"] ?: ""

    val intent = Intent(this, ${ACTIVITY_CLASS}::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      data.forEach { (k, v) -> putExtra(k, v) }
    }
    val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val pi = PendingIntent.getActivity(this, data.hashCode(), intent, piFlags)

    val notification = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setAutoCancel(true)
      .setOngoing(true)
      .setFullScreenIntent(pi, true)
      .setContentIntent(pi)
      .build()

    val id = (data["entityId"] ?: data["alertId"] ?: data["visitId"] ?: title).hashCode()
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(id, notification)
  }
}
`;
}

function activityKotlin(pkg, scheme) {
  return `package ${pkg}

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity

/**
 * Full-screen, lock-screen-visible alert. Renders title/body + actions built
 * from the FCM data extras. Actions deep-link into the RN app (societyos://)
 * so the existing JS handles the decision (Approve/Reject for visitors,
 * View/Acknowledge for SOS) via the current endpoints.
 */
class ${ACTIVITY_CLASS} : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      (getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      )
    }

    val extras = intent.extras
    val title = extras?.getString("title") ?: "Alert"
    val body = extras?.getString("body") ?: ""
    val type = extras?.getString("type") ?: ""
    val entityId = extras?.getString("entityId")
      ?: extras?.getString("visitId") ?: extras?.getString("alertId") ?: ""

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#0B1020"))
      setPadding(64, 96, 64, 96)
    }
    root.addView(TextView(this).apply {
      text = title
      textSize = 26f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
    })
    root.addView(TextView(this).apply {
      text = body
      textSize = 18f
      setTextColor(Color.parseColor("#C7CBD9"))
      gravity = Gravity.CENTER
      setPadding(0, 24, 0, 56)
    })

    fun openApp(action: String) {
      val uri = Uri.parse("${scheme}://notification?type=$type&id=$entityId&action=$action")
      val launch = Intent(Intent.ACTION_VIEW, uri).apply {
        setPackage(packageName)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      try {
        startActivity(launch)
      } catch (e: Exception) {
        packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it) }
      }
      finish()
    }

    val isApproval = type.contains("APPROVAL") || type.contains("VISITOR") || type.contains("DELIVERY")
    if (isApproval) {
      root.addView(Button(this).apply { text = "Approve"; setOnClickListener { openApp("approve") } })
      root.addView(Button(this).apply { text = "Reject"; setOnClickListener { openApp("reject") } })
    } else {
      root.addView(Button(this).apply { text = "View"; setOnClickListener { openApp("view") } })
      root.addView(Button(this).apply { text = "Dismiss"; setOnClickListener { finish() } })
    }
    setContentView(root)
  }
}
`;
}

const withFullScreenNotifications = (config) => {
  // 1) Emit the Kotlin sources into the app package dir at prebuild.
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android && cfg.android.package;
      if (!pkg) throw new Error('withFullScreenNotifications: android.package is required');
      const scheme = Array.isArray(cfg.scheme) ? cfg.scheme[0] : cfg.scheme;
      if (!scheme) throw new Error('withFullScreenNotifications: a URL scheme is required');
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java',
        ...pkg.split('.'),
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${SERVICE_CLASS}.kt`), serviceKotlin(pkg));
      fs.writeFileSync(path.join(dir, `${ACTIVITY_CLASS}.kt`), activityKotlin(pkg, scheme));
      return cfg;
    },
  ]);

  // 2) Manifest: permission + replace Expo's FCM service with our subclass + the activity.
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    manifest.manifest.$ = manifest.manifest.$ || {};
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    // USE_FULL_SCREEN_INTENT (idempotent)
    manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];
    if (
      !manifest.manifest['uses-permission'].some(
        (p) => p.$ && p.$['android:name'] === FULL_SCREEN_PERMISSION,
      )
    ) {
      manifest.manifest['uses-permission'].push({ $: { 'android:name': FULL_SCREEN_PERMISSION } });
    }

    const app = manifest.manifest.application && manifest.manifest.application[0];
    if (!app) return cfg;
    app.service = app.service || [];
    app.activity = app.activity || [];

    // Remove Expo's default FCM service registration (we register a subclass so
    // exactly one service handles MESSAGING_EVENT; the subclass forwards to it).
    app.service = app.service.filter((s) => !(s.$ && s.$['android:name'] === EXPO_SERVICE));
    app.service.push({ $: { 'android:name': EXPO_SERVICE, 'tools:node': 'remove' } });

    if (!app.service.some((s) => s.$ && s.$['android:name'] === `.${SERVICE_CLASS}`)) {
      app.service.push({
        $: { 'android:name': `.${SERVICE_CLASS}`, 'android:exported': 'false' },
        'intent-filter': [
          { action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }] },
        ],
      });
    }

    if (!app.activity.some((a) => a.$ && a.$['android:name'] === `.${ACTIVITY_CLASS}`)) {
      app.activity.push({
        $: {
          'android:name': `.${ACTIVITY_CLASS}`,
          'android:exported': 'false',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:excludeFromRecents': 'true',
          'android:launchMode': 'singleInstance',
          'android:theme': '@android:style/Theme.Material.NoActionBar',
        },
      });
    }
    return cfg;
  });

  return config;
};

module.exports = withFullScreenNotifications;

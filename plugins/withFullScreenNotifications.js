/**
 * Expo config plugin — full-screen (call-style) notifications on Android.
 *
 * Reproduces, at prebuild, the native pieces that power the full-screen alert so
 * they survive `expo prebuild --clean` and apply to BOTH apps (resident-app has
 * a committed android/, staff-app is managed). Pairs with
 * src/lib/fullScreenNotifications.ts (the RN-Firebase background handler that
 * calls the native module).
 *
 * What it injects:
 *  - Kotlin: FullScreenAlertActivity (lock-screen takeover, showWhenLocked /
 *    turnScreenOn), FullScreenAlertModule (JS-callable: posts a NotificationCompat
 *    with setFullScreenIntent → the activity, data via intent extras),
 *    FullScreenAlertPackage.
 *  - MainApplication: registers FullScreenAlertPackage.
 *  - Manifest: USE_FULL_SCREEN_INTENT (+ exact-alarm perms), the activity, and
 *    `tools:replace` on the FCM default_notification_color/icon meta-data to
 *    resolve the expo-notifications ⇄ RN-Firebase merge conflict.
 *  - build.gradle: Notifee's local maven repo (its AAR isn't on a public repo).
 *
 * iOS: no full-screen-from-push API without CallKit; iOS relies on the APNs
 * interruption level (set server-side). Android-only.
 */
const {
  withAndroidManifest,
  withMainApplication,
  withProjectBuildGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ACTIVITY = 'FullScreenAlertActivity';
const MODULE = 'FullScreenAlertModule';
const PKG = 'FullScreenAlertPackage';
const FULL_SCREEN_PERMISSION = 'android.permission.USE_FULL_SCREEN_INTENT';

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

/** Full-screen, lock-screen alert (call-style). showWhenLocked + turnScreenOn. */
class ${ACTIVITY} : ComponentActivity() {
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

    val type = intent.getStringExtra("type") ?: ""
    val id = intent.getStringExtra("id") ?: intent.getStringExtra("entityId") ?: ""
    val isApproval = type.contains("VISITOR") || type.contains("DELIVERY") || type.contains("APPROVAL")
    val title = intent.getStringExtra("title") ?: if (isApproval) "Visitor at the gate" else "SOS alert"
    val body = intent.getStringExtra("body") ?: ""

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(if (isApproval) Color.parseColor("#26051A") else Color.parseColor("#2B0710"))
      setPadding(72, 96, 72, 96)
    }
    root.addView(TextView(this).apply {
      text = if (isApproval) "VISITOR AT THE GATE" else "EMERGENCY"
      setTextColor(if (isApproval) Color.parseColor("#D578AC") else Color.parseColor("#F4A5A5"))
      textSize = 13f; gravity = Gravity.CENTER; letterSpacing = 0.15f
    })
    root.addView(TextView(this).apply {
      text = title; setTextColor(Color.WHITE); textSize = 28f; gravity = Gravity.CENTER; setPadding(0, 16, 0, 8)
    })
    root.addView(TextView(this).apply {
      text = body; setTextColor(Color.parseColor("#F4D2E4")); textSize = 17f; gravity = Gravity.CENTER; setPadding(0, 0, 0, 56)
    })

    fun deepLink(action: String) {
      try {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${scheme}://notification?type=$type&id=$id&action=$action")).apply {
          setPackage(packageName); flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        })
      } catch (_: Exception) {
        packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it) }
      }
      finish()
    }
    fun bigButton(label: String, bg: Int, fg: Int, onClick: () -> Unit) = Button(this).apply {
      text = label; setBackgroundColor(bg); setTextColor(fg); textSize = 17f
      val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 150); lp.setMargins(0, 12, 0, 0)
      layoutParams = lp; setOnClickListener { onClick() }
    }
    if (isApproval) {
      root.addView(bigButton("Approve", Color.parseColor("#49CDAD"), Color.parseColor("#0F3A30")) { deepLink("approve") })
      root.addView(bigButton("Reject", Color.parseColor("#420A29"), Color.parseColor("#F4D2E4")) { deepLink("reject") })
    } else {
      root.addView(bigButton("Acknowledge", Color.parseColor("#DC2626"), Color.WHITE) { deepLink("acknowledge") })
      root.addView(bigButton("View location", Color.parseColor("#420A29"), Color.parseColor("#F4D2E4")) { deepLink("view") })
    }
    setContentView(root)
  }
}
`;
}

function moduleKotlin(pkg) {
  return `package ${pkg}

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/** JS-callable: raises a full-screen alert via setFullScreenIntent → ${ACTIVITY}. */
class ${MODULE}(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "FullScreenAlert"

  private fun str(d: ReadableMap, k: String, f: String) = if (d.hasKey(k)) d.getString(k) ?: f else f

  @ReactMethod
  fun present(data: ReadableMap) {
    val ctx = reactContext.applicationContext
    val type = str(data, "type", "")
    val isApproval = type.contains("VISITOR") || type.contains("DELIVERY") || type.contains("APPROVAL")
    val channelId = str(data, "channelId", if (isApproval) "visitors_gate" else "emergency_sos")
    val title = str(data, "title", "Alert")
    val body = str(data, "body", "")
    val id = str(data, "id", "")

    val intent = Intent(ctx, ${ACTIVITY}::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("type", type); putExtra("title", title); putExtra("body", body); putExtra("id", id)
    }
    val pi = PendingIntent.getActivity(
      ctx, (id + type).hashCode(), intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val n = NotificationCompat.Builder(ctx, channelId)
      .setSmallIcon(ctx.applicationInfo.icon)
      .setContentTitle(title).setContentText(body)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setAutoCancel(true).setOngoing(true)
      .setFullScreenIntent(pi, true).setContentIntent(pi)
      .build()
    (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify((id + type).hashCode(), n)
  }
}
`;
}

function packageKotlin(pkg) {
  return `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ${PKG} : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(${MODULE}(reactContext))
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
`;
}

const withFullScreenNotifications = (config) => {
  // 1) Kotlin sources
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android && cfg.android.package;
      const scheme = Array.isArray(cfg.scheme) ? cfg.scheme[0] : cfg.scheme;
      if (!pkg || !scheme) throw new Error('withFullScreenNotifications: android.package and scheme are required');
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${ACTIVITY}.kt`), activityKotlin(pkg, scheme));
      fs.writeFileSync(path.join(dir, `${MODULE}.kt`), moduleKotlin(pkg));
      fs.writeFileSync(path.join(dir, `${PKG}.kt`), packageKotlin(pkg));
      return cfg;
    },
  ]);

  // 2) Register the package in MainApplication
  config = withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes(`${PKG}()`)) {
      src = src.replace(
        /(val packages = PackageList\(this\)\.packages)/,
        `$1\n            packages.add(${PKG}())`,
      );
      cfg.modResults.contents = src;
    }
    return cfg;
  });

  // 3) Manifest: permission + activity + tools:replace on FCM meta-data
  config = withAndroidManifest(config, (cfg) => {
    const m = cfg.modResults;
    m.manifest.$ = m.manifest.$ || {};
    m.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    m.manifest['uses-permission'] = m.manifest['uses-permission'] || [];
    for (const p of [FULL_SCREEN_PERMISSION, 'android.permission.SCHEDULE_EXACT_ALARM', 'android.permission.USE_EXACT_ALARM']) {
      if (!m.manifest['uses-permission'].some((x) => x.$ && x.$['android:name'] === p)) {
        m.manifest['uses-permission'].push({ $: { 'android:name': p } });
      }
    }
    const app = m.manifest.application && m.manifest.application[0];
    if (!app) return cfg;
    app.activity = app.activity || [];
    if (!app.activity.some((a) => a.$ && a.$['android:name'] === `.${ACTIVITY}`)) {
      app.activity.push({
        $: {
          'android:name': `.${ACTIVITY}`,
          'android:exported': 'false',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:excludeFromRecents': 'true',
          'android:launchMode': 'singleInstance',
          'android:theme': '@android:style/Theme.Material.NoActionBar',
        },
      });
    }
    // expo-notifications ⇄ RN-Firebase both set these → must tools:replace.
    app['meta-data'] = app['meta-data'] || [];
    for (const md of app['meta-data']) {
      const name = md.$ && md.$['android:name'];
      if (name === 'com.google.firebase.messaging.default_notification_color' ||
          name === 'com.google.firebase.messaging.default_notification_icon') {
        md.$['tools:replace'] = 'android:resource';
      }
    }
    return cfg;
  });

  // 4) Notifee's local maven repo (its AAR isn't on a public repo)
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes('@notifee/react-native/android/libs')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        `allprojects {\n    repositories {\n        maven { url(new File(['node', '--print', "require.resolve('@notifee/react-native/package.json')"].execute(null, rootDir).text.trim(), '../android/libs')) }`,
      );
    }
    return cfg;
  });

  return config;
};

module.exports = withFullScreenNotifications;

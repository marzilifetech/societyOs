# Push Notifications — Operator Guide

End-to-end push wiring for resident-app and staff-app. Covers the dev path,
the production handoff, and how to verify each piece works.

## Architecture (5-minute version)

```
domain event (visitor.checkIn, complaint.update, etc.)
       │
       └─► PushService.send(userId, { title, body, category, imageUrl, actions, data })
                │
                ├─► firebase-admin → FCM ──────► device
                │                                  │
                └─► NotificationLog (Postgres)     ├─► foreground → app's received-listener
                                                   │     └─► <InAppBanner> renders a rich card
                                                   ├─► background/quit → OS notification tray
                                                   │     ├─► tap default → response listener → router.push
                                                   │     └─► tap action (APPROVE/REJECT/...)
                                                   │          → response listener → API call (decision/accept)
                                                   └─► GET /v1/notifications (inbox)
```

The backend speaks raw FCM. Clients register the **native** FCM token (NOT an
Expo push token) via `POST /v1/notifications/devices` so multiple devices per
user are supported and tokens can be cleaned up when FCM rejects them.

## Categories and action groups

| `data.type`                | `category` (opt-out key) | `data.actionGroup` (iOS aps.category) | Action buttons                   |
| -------------------------- | ------------------------ | ------------------------------------- | -------------------------------- |
| `VISITOR_APPROVAL_REQUEST` | `visitors_gate`          | `visitor_approval`                    | Approve / Reject                 |
| `VISITOR_ARRIVAL`          | `visitors_gate`          | —                                     | (info only)                      |
| `HELP_REQUEST`             | `staff_tasks`            | `help_request`                        | Accept / Decline                 |
| `TASK_ASSIGNED`            | `staff_tasks`            | `task_assignment`                     | Accept / Reject                  |
| `COMPLAINT_UPDATED`        | `complaints`             | —                                     | (info only)                      |
| `PACKAGE_ARRIVED`          | `deliveries`             | —                                     | (info only)                      |
| `NOTICE_PUBLISHED`         | `notices`                | —                                     | (info only)                      |
| `SOS_TRIGGERED`            | `emergency_sos`          | —                                     | (critical, bypasses quiet hours) |

`category` controls opt-out (NotificationPreference table). `actionGroup` is
what iOS uses to look up the registered button set — the apps register these
once at startup via `setNotificationCategoryAsync(<actionGroup>, [...])`.

## Local dev — fire a test push

```bash
# 1. Login as a resident, capture $TOKEN.
# 2. Make sure the device has registered: GET /v1/notifications/devices.
# 3. Fire any fixture (see backend/src/modules/dev/dev.controller.ts):

curl -X POST http://localhost:3000/v1/dev/push-test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"VISITOR_APPROVAL_REQUEST","includeActions":true}'

# 4. Verify:
#    - device shows the push
#    - psql societyos -c "SELECT id, status, category, title FROM notification_logs ORDER BY \"createdAt\" DESC LIMIT 5;"
#    - GET /v1/notifications  (the row shows up in the inbox)
```

Available fixture types: `VISITOR_APPROVAL_REQUEST`, `VISITOR_ARRIVAL`,
`PACKAGE_ARRIVED`, `COMPLAINT_UPDATED`, `NOTICE_PUBLISHED`, `SOS_TRIGGERED`,
`TASK_ASSIGNED`, `HELP_REQUEST`.

The dev endpoint returns 403 in `NODE_ENV=production`.

## Production handoff (one-time)

### 1. iOS APNs Auth Key

1. Apple Developer portal → Certificates, Identifiers & Profiles → Keys → create a key with **Apple Push Notifications service (APNs)** enabled.
2. Download the `.p8`. Note its **Key ID** and your **Team ID**.
3. Firebase Console → Project `marzi-society-os` → Project Settings → Cloud Messaging → APNs Authentication Key.
4. Upload the `.p8` for BOTH iOS apps:
   - `com.societyos.resident`
   - `com.societyos.staff`

One key works for sandbox + production. FCM routes based on the APNs token's
environment, which is set by the build's `aps-environment` entitlement.

### 2. iOS entitlement toggle

Both apps have an `app.config.ts` that flips the entitlement:

```bash
# Development / TestFlight against APNs sandbox
pnpm prebuild --clean
pnpm ios

# Production / App Store
APP_VARIANT=production pnpm prebuild --clean
pnpm ios:release  # or your usual release pipeline
```

A `Release` build with `aps-environment=development` will silently fail to
deliver push — Apple ships dev tokens to sandbox APNs only.

### 3. Android release SHA fingerprints (FCM doesn't strictly need them, but Phone Auth/Crashlytics do)

```bash
keytool -list -v \
  -keystore keystores/societyos-release.keystore \
  -alias <release-alias> \
  | grep "SHA"
```

Paste SHA-1 and SHA-256 into the Firebase Console for both Android apps.

### 4. Backend FCM credentials

Production backend reads `FIREBASE_SA_BASE64` from env (preferred over
`FIREBASE_SERVICE_ACCOUNT` to avoid newline escaping issues):

```bash
# On the box, or via your secrets manager:
B64=$(base64 -i marzi-society-os-firebase-adminsdk-*.json | tr -d '\n')
echo "FIREBASE_SA_BASE64=$B64" >> backend.env
```

For ECS/Lightsail, set this in the secrets store, not in plaintext env. The
`infra/instance/set-firebase-secret.sh` helper does this for the existing dev
secret bundle.

## Smoke test (post-deploy)

```bash
./scripts/push-smoke.sh "$STAGING_API" "$TOKEN"
```

Expected output:

```
→ POST /v1/dev/push-test (VISITOR_APPROVAL_REQUEST)
   status: { ok: true }
→ GET /v1/notifications/unread-count
   delivered ✅ count=1 in 1.2s
```

If FCM returns `Unregistered` or `invalid-argument`, the row in `notification_logs`
will show `status=FAILED` with the reason. PushService also deletes the offending
`Device` row so the next registration cleanly replaces it.

## Quiet hours

Non-critical push is deferred 22:00–07:00 IST. Critical (`category: emergency_sos`,
or explicit `critical: true`) bypasses. Deferred jobs land via BullMQ at 07:00 IST.

To send anyway during quiet hours from your service code:

```ts
await this.push.send(userId, {
  title: '…',
  body: '…',
  category: 'visitors_gate',
  critical: true, // ← bypass
});
```

## Troubleshooting

| Symptom                                           | Likely cause                                   | Fix                                                                                          |
| ------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| "Firebase service account not configured" at boot | `FIREBASE_SA_BASE64` empty                     | Re-run `set-firebase-secret.sh` or paste the base64 into `backend/.env`                      |
| Push works on Android, silent on iOS Release      | `aps-environment=development` in release build | Rebuild with `APP_VARIANT=production`                                                        |
| Lockscreen buttons missing on iOS                 | App didn't register categories                 | Ensure `setupNotificationCategories()` ran before any test push. Restart the app once.       |
| Action button taps don't update server state      | App used Expo push token (not native FCM)      | Native FCM only. `getDevicePushTokenAsync()` is correct; `getExpoPushTokenAsync()` is wrong. |
| `Device` row exists but no push arrives           | Battery optimization on Xiaomi/Vivo/Oppo       | User must whitelist the app under "battery saver" settings. Out of code's control.           |
| Inbox shows duplicates                            | Same FCM message sent twice (no `collapseKey`) | All v1 triggers include collapseKey. Add one to any new trigger.                             |

## What's NOT in v1

- Per-society timezone for quiet hours (always IST).
- SMS fallback for critical push.
- iOS Notification Service Extension for rich image attachments (Android has BigPicture; iOS gets text + buttons).
- WhatsApp Business API fan-out.
- Notification retention policy (rows accumulate; add a `DELETE WHERE readAt IS NOT NULL AND createdAt < now() - 90 days` cron later).

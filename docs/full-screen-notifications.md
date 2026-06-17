# Full-screen (call-style) notifications — SOS (staff) & Visitor (resident)

Goal: MyGate/NoBrokerHood-style alerts that **wake the screen and show over the
lock screen** for two events:

- **SOS** → on-duty guards (staff app) — View/Acknowledge.
- **Visitor approval** → resident (resident app) — Approve / Reject.

## What the platforms allow

- **Android**: true full-screen via a notification `fullScreenIntent`. The only
  mainstream way; well-supported.
- **iOS**: **no** full-screen-from-push API exists **except CallKit + PushKit
  (VoIP)** — the native incoming-call screen (separate, heavy: VoIP APNs cert,
  PushKit token, Apple review). For non-call alerts, iOS uses **time-sensitive /
  critical** interruption levels (loud heads-up over the lock screen), which the
  backend already sends. **Decision: Android full-screen now; iOS stays loud
  time-sensitive/critical; CallKit deferred.**

## How others do it (research)

The common RN/Expo stacks for full-screen "incoming-call" notifications:

1. `@notifee/react-native` `fullScreenAction` + `@react-native-firebase/messaging`
   `setBackgroundMessageHandler` (the dominant pattern), or
2. `react-native-full-screen-notification-incoming-call` (Android-only, Expo
   plugin, Android-12 CallStyle), or
3. `react-native-callkeep` for true iOS CallKit (+ Android ConnectionService).

All three add libraries and (for 1/2) a Firebase-messaging background handler
that can **take over FCM and sideline `expo-notifications`' own handlers**
(invertase/react-native-firebase#8840, expo/expo#36419).

Sources: Notifee fullScreenAction (notifee.app/react-native/docs/android/behaviour),
linhvovan29546/react-native-full-screen-notification-incoming-call,
react-native-callkeep, invertase/react-native-firebase#8840.

## Our approach — keep FCM + expo-notifications untouched, no new libs

Constraint: **stay on FCM and keep the existing expo-notifications pipeline.**
So instead of adding RNFirebase/notifee (which would sideline expo-notifications),
we add a thin **Expo config plugin** — `plugins/withFullScreenNotifications.js` —
that **subclasses Expo's own FCM service**:

- `FullScreenMessagingService extends ExpoFirebaseMessagingService` (Expo's class
  is `open`). It is registered as the single `MESSAGING_EVENT` handler (Expo's
  default registration is removed via `tools:node="remove"`).
- `onMessageReceived`: if `data.fullScreen == "true"` → build a `NotificationCompat`
  with `setFullScreenIntent(...)` (`CATEGORY_CALL`, `PRIORITY_MAX`) targeting
  `FullScreenAlertActivity` (`showWhenLocked` / `turnScreenOn`). **Every other
  message is forwarded to `super`**, so the existing expo-notifications flow is
  completely unchanged.
- `FullScreenAlertActivity` renders title/body + buttons; buttons deep-link into
  the RN app (`<scheme>://notification?type=&id=&action=`) so existing JS handles
  the decision. Permission `USE_FULL_SCREEN_INTENT` is added.

No `@react-native-firebase`, no `notifee`, no change to existing JS. Reuses the
`firebase-messaging` SDK that `expo-notifications` already bundles. Relies on
Expo internals that are `open` today — re-validate on major expo-notifications
upgrades.

## Backend contract

Full-screen pushes are sent **data-only** (no FCM `notification` block) so the
service's `onMessageReceived` runs in background/killed and can raise the intent.
`PushService` does this when `fullScreen: true` (see `push.service.ts`):

```
data = { type, fullScreen: 'true', title, body, channelId, entityId/alertId/visitId, actions? }
```

- SOS → guards: `category: emergency_sos`, `critical: true`, `fullScreen: true`.
- Visitor → resident: `category: visitors_gate|deliveries`, `actions`, `fullScreen: true`.

Implemented + unit-tested (`push.service.spec.ts`: data-only + `data.fullScreen`).

## Client wiring

- `plugins/withFullScreenNotifications.js` added to both apps' `app.json` plugins
  (`../../plugins/withFullScreenNotifications`). It runs at **prebuild**.
- **resident-app**: already prebuilt + has `expo-dev-client`. Re-run
  `expo prebuild` (or apply on next native build) so the plugin emits the service
  /activity + manifest entries. Scheme `societyos`.
- **staff-app**: managed → needs `expo prebuild` and `expo-dev-client` for a dev
  build. `USE_FULL_SCREEN_INTENT` already declared. Scheme `societyos-staff`.
- **Deep link**: the full-screen Activity opens `<scheme>://notification?...`.
  The app should route this (Approve/Reject → `POST /visitors/:id/decision`;
  View → SOS screen). Wire into the existing notification-response routing in
  `src/lib/push.ts` / `src/lib/notifications.ts`. (Pending — see TODO.)

## TODO before this is user-ready

- [ ] Build a dev client for each app and verify on a device (see test plan).
- [ ] Handle the `<scheme>://notification` deep link in JS to perform the action.
- [ ] Provide `google-services.json` at build (gitignored → EAS file/secret).
- [ ] Decide on iOS: ship time-sensitive/critical (done server-side) or invest
      in CallKit+PushKit later.

## Test plan (device required — cannot be validated in CI/unit)

- Android, app **killed** + screen **locked**: trigger SOS → guard phone wakes,
  full-screen alert; View opens the SOS screen.
- Android, killed + locked: walk-in/pre-approved visitor → resident phone wakes,
  Approve/Reject hit `/visitors/:id/decision`.
- Android background + foreground: alert still raised.
- iOS: loud time-sensitive (visitor) / critical (SOS) heads-up — NOT full-screen.
- Regression: normal notifications (notices, complaints, etc.) still show via
  expo-notifications and are not affected by the subclassed service.

## Status

- Backend `fullScreen` flag: **done + unit-tested**.
- Config plugin + manifest/Kotlin: **written**; emitted at prebuild. **Not yet
  verified on a device** — requires a dev/EAS build.
- Deep-link JS handler + device validation: **pending**.

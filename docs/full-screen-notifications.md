# Full-screen (call-style) notifications — SOS (staff) & Visitor (resident)

Goal: MyGate/NoBrokerHood-style alerts that **wake the screen and show over the
lock screen**:

- **SOS** → on-duty guards (staff app) — Acknowledge.
- **Visitor approval** → resident (resident app) — Approve / Reject.

## Platform reality

- **Android**: true full-screen via a notification `fullScreenIntent`. Supported.
- **iOS**: no full-screen-from-push API except CallKit + PushKit (VoIP). Deferred.
  iOS uses time-sensitive / critical interruption levels (sent server-side).

## Approach (the standard, clean way — chosen)

`@notifee/react-native` + `@react-native-firebase/messaging`:

- **Still 100% Firebase/FCM.** RN-Firebase is only the client library that
  exposes `setBackgroundMessageHandler` — receiving a **data-only** FCM message
  in background/killed, which `expo-notifications` cannot do.
- **Notifee** renders the full-screen notification (`fullScreenAction` +
  `AndroidCategory.CALL` + `AndroidImportance.HIGH`) with Approve/Reject (visitor)
  or Acknowledge (SOS) buttons, handled **in JS** (no native Activity, no
  deep-link round-trip). Notifee's Expo config plugin adds `USE_FULL_SCREEN_INTENT`
  - the activity flags at prebuild.

### Trade-off accepted

RN-Firebase's messaging service becomes the FCM entry point, which can sideline
`expo-notifications`' own receive handlers (invertase/react-native-firebase#8840,
expo/expo#36419). FCM/the token are unchanged. **This coexistence is the main
thing to validate on a device** — confirm normal notifications (notices,
complaints, etc.) still display, and the device token still registers.

## What was implemented

### Backend (done + unit-tested)

- `PushService.fullScreen` → data-only delivery + `data.fullScreen='true'`
  (`push.service.ts`). Wired into SOS→guards and visitor→resident sends.

### Client (both apps)

- Deps added: `@notifee/react-native`, `@react-native-firebase/app`,
  `@react-native-firebase/messaging`, `expo-build-properties`
  (`ios.useFrameworks: "static"`, required by RN-Firebase on Expo). staff-app
  also gets `expo-dev-client`.
- `app.json` plugins: `@react-native-firebase/app`, `@react-native-firebase/messaging`,
  `expo-build-properties`.
- `index.js` is now the entry (`main`): imports
  `src/lib/fullScreenNotifications` (module-scope `setBackgroundMessageHandler`
  - `notifee.onBackgroundEvent`) **before** `expo-router/entry`.
- `src/lib/fullScreenNotifications.ts`: `displayFullScreen(data)`,
  action→endpoint mapping (`POST /visitors/:id/decision`, `PATCH /sos/:id/acknowledge`),
  background handlers (module scope), and `registerForegroundFullScreen()`.
- `app/_layout.tsx`: calls `registerForegroundFullScreen()` for the foreground path.
- Device-token registration is unchanged (expo-notifications still returns the
  same FCM token); revisit if the coexistence pushes us to register via
  `messaging().getToken()`.

## Required to finish (not doable in this repo/CI)

1. `pnpm install` then `npx expo install --check` in each app to pin
   RN-Firebase/notifee/build-properties to the exact SDK-52-compatible versions.
2. Provide Firebase config files at build (gitignored):
   `apps/<app>/google-services.json` (Android) + `GoogleService-Info.plist` (iOS),
   referenced via `android.googleServicesFile` / `ios.googleServicesFile`.
3. `npx expo prebuild` (staff-app is currently managed; resident-app re-prebuild)
   and build a **dev client** — full-screen is native; Expo Go cannot run it.
4. Device verification (see test plan).

## Test plan (device required)

- Android, app **killed** + screen **locked**: SOS → guard phone wakes, full-screen
  alert, Acknowledge → `PATCH /sos/:id/acknowledge`.
- Android killed + locked: walk-in/pre-approved visitor → resident phone wakes,
  Approve/Reject → `POST /visitors/:id/decision`.
- Foreground: same UI via `registerForegroundFullScreen`.
- **Coexistence regression**: normal notifications still display; token still
  registers; no duplicate notifications.
- iOS: loud time-sensitive (visitor) / critical (SOS) heads-up — NOT full-screen.

## Status

- Backend: done + unit-tested.
- Client wiring: written; **not verified on device** — needs install + prebuild +
  Firebase config files + a dev build. iOS full-screen (CallKit) intentionally deferred.

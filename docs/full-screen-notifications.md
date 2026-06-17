# Full-screen (call-style) notifications — SOS (staff) & Visitor (resident)

Goal: MyGate-style alerts that wake the screen and take it over on the lock
screen — SOS → guards (staff app), visitor approval → resident.

## Platform reality

- **Android**: true full-screen via a notification `fullScreenIntent`. Implemented.
- **iOS**: no full-screen-from-push API except CallKit/PushKit. Deferred; iOS
  uses the loud time-sensitive/critical interruption level (sent server-side).

## Architecture (correct path)

```
FCM data push (data.fullScreen = "true")
   → @react-native-firebase/messaging  (foreground onMessage OR background/killed
                                         setBackgroundMessageHandler — runs headless)
   → src/lib/fullScreenNotifications.ts  displayFullScreen(data)
   → native FullScreenAlert module (present)
   → NotificationCompat.setFullScreenIntent(PendingIntent → FullScreenAlertActivity,
                                            data as intent extras)
   → FullScreenAlertActivity (showWhenLocked / turnScreenOn) renders the alert.
```

Still 100% Firebase/FCM. We do **not** use Notifee's `fullScreenAction` (it does
not reliably launch a custom activity); Notifee is kept only to ensure the
Android channels exist. The native module owns the `fullScreenIntent`, so the OS
takes over the lock screen and the data binding is solved (we set the extras).

Backend: `PushService.fullScreen` sends these data-only with `data.fullScreen='true'`
(SOS→guards, visitor→resident); unit-tested.

## Native pieces (via `plugins/withFullScreenNotifications.js`)

A config plugin injects them at prebuild (survives `prebuild --clean`; also
covers staff-app, which has no committed `android/`):

- `FullScreenAlertActivity.kt` — lock-screen takeover UI (brand theme: maroon
  primary, teal secondary, SOS red), buttons deep-link `‹scheme›://notification?...`.
- `FullScreenAlertModule.kt` / `FullScreenAlertPackage.kt` — JS-callable `present()`.
- MainApplication registration; manifest perms + activity; `tools:replace` on the
  FCM color/icon meta-data (expo-notifications ⇄ RN-Firebase merge fix); Notifee
  maven repo in `build.gradle`.

## Verified on the Android emulator

- The full-screen **UI/activity** renders over the lock screen, themed, for both
  visitor (Approve/Reject) and SOS (Acknowledge) — wakes the screen.
- App builds and runs with `@react-native-firebase` + `@notifee/react-native`.
- A **synthetic FCM** broadcast reached RN-Firebase's receiver and spun up the
  **headless background JS task** — i.e. the production handler path fires.

## NOT yet verified / remaining

- **Real FCM → handler → full-screen end-to-end.** A hand-crafted `am broadcast`
  doesn't populate FCM `RemoteMessage` data, and the dev headless instance needs
  Metro. This needs a **real push**: a real `google-services.json` (currently
  gitignored / absent) + a send from the backend, on a release or dev-client build.
- **Action handling.** The activity deep-links `‹scheme›://notification?type&id&action`,
  but there is no JS route handler yet to call `POST /visitors/:id/decision` /
  `PATCH /sos/:id/acknowledge`. Needs a `Linking` handler.
- **staff-app** native build (managed → needs `expo prebuild` + a dev build).
- **Run `expo prebuild --clean`** once to validate the config plugin output
  (the committed `android/` currently holds equivalent hand-applied edits).
- **iOS** full-screen (CallKit/PushKit) — deferred.

## To finish

1. Drop the real `google-services.json` (+ `GoogleService-Info.plist`) into the apps.
2. `npx expo install --check` (pin RN-Firebase/notifee versions), `expo prebuild --clean`, build a dev/release client.
3. Send a real visitor/SOS push from the backend → confirm the takeover + content on a locked device.
4. Add the `Linking` handler for the deep-linked actions.
5. Replicate the dev/build for staff-app (SOS).

# app-policy — in-app update gate

Server-side reader for the version-policy used by the resident + staff
mobile apps' in-app update flow.

## Why a backend wrapper around Firebase Remote Config?

- Mobile apps don't need to bundle the @react-native-firebase/remote-config
  SDK (~2MB native code + Expo prebuild dance) for one config value.
- 5-minute server-side cache amortises Firebase's HTTP rate limit across
  the entire user base.
- Single failure mode: if Firebase is unreachable or the template is empty,
  the endpoint serves env-fallback values. Apps never break.

## API

`GET /app/version-policy?app=resident|staff&platform=android|ios&versionCode=N`

Public — no auth. Returns:

```json
{
  "level": "none" | "flexible" | "immediate",
  "minVersionCode": 12,
  "recommendedVersionCode": 14,
  "updateUrl": "https://play.google.com/store/apps/details?id=com.societyos.resident",
  "updateMessage": "Critical safety fix included" | null
}
```

`level` is derived per-request from `versionCode` vs `min`/`recommended`:

- `current < minVersionCode` → `immediate` (full-screen blocker)
- `current < recommendedVersionCode` → `flexible` (dismissible banner)
- otherwise → `none`

## Source priority

1. **Firebase Remote Config** (`admin.remoteConfig().getTemplate()`).
   firebase-admin is already initialized for FCM, so no extra creds.
2. **Environment variables** (per-app, per-platform).
3. Hard defaults of `0` (which collapses to `level: none` everywhere).

## Firebase Remote Config parameter names

Add to your Firebase project's Remote Config template:

```
min_version_code_resident_android       (Number, e.g. 12)
recommended_version_code_resident_android (Number, e.g. 14)
update_url_resident_android             (String, optional)
update_message_resident_android         (String, optional)

min_version_code_staff_android          (Number, e.g.  8)
recommended_version_code_staff_android  (Number, e.g.  9)
update_url_staff_android                (String, optional)
update_message_staff_android            (String, optional)
```

iOS uses the same pattern with `_ios` suffix.

## Environment-variable fallback

Useful for staging / local development where Firebase Remote Config isn't
wired yet. Same shape:

```
APP_VERSION_MIN_RESIDENT_ANDROID=12
APP_VERSION_RECOMMENDED_RESIDENT_ANDROID=14
APP_VERSION_URL_RESIDENT_ANDROID=https://...

APP_VERSION_MIN_STAFF_ANDROID=8
APP_VERSION_RECOMMENDED_STAFF_ANDROID=9
APP_VERSION_URL_STAFF_ANDROID=https://...
```

If both Remote Config AND env vars are absent, `min` and `recommended` are
`0`, so any `versionCode >= 1` yields `level: none`. Safe default.

## Why not the native Google Play in-app update API?

Google's `com.google.android.play:app-update` library only operates on apps
installed from Google Play (or Internal App Sharing). At time of writing
SocietyOS resident + staff are distributed as locally-signed APKs (sideload),
so the native API would silently no-op.

The JS-driven blocker + banner we ship here delivers the same UX through
configurable `updateUrl` deep-links — works for sideload, Play Store, or a
mix. When distribution shifts to Play Store, the native API can be added
ADDITIVELY without changing the backend contract.

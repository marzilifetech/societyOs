# Android release: build, upload, crash reporting

Releases of `com.marzi.resident` are built locally and uploaded with fastlane.
Nothing here rolls out to the public: a production upload stays a draft until
someone presses **Start rollout** in Play Console.

## 1. One-off: a Play upload key for fastlane

fastlane needs a Google Play service-account key. Only a Play Console account
owner or admin can create it.

1. Play Console → **Setup → API access** → link (or create) a Google Cloud project.
2. In that Cloud project: **IAM & Admin → Service accounts → Create service account**
   (any name, e.g. `fastlane-upload`). No Cloud roles are needed.
3. On the new account: **Keys → Add key → Create new key → JSON**. A `.json` file downloads.
4. Back in Play Console → **Users and permissions → Invite new users**: invite the
   service account's e-mail, give it access to **One Community** with
   _Release to testing tracks_, _Release to production_ and _View app information_.
5. Save the JSON as `apps/resident-app/play-store-key.json`. It is git-ignored,
   never commit it. (Or point `PLAY_STORE_KEY_PATH` at it.)

Check it works (read-only):

```sh
cd apps/resident-app && fastlane android check
```

## 2. Build the signed AAB

Version and build number live in `app.json` (`version`, `android.versionCode`).
The `android/` project is generated and git-ignored; regenerate it **without**
`--clean`, which would delete the upload-key signing properties in
`android/gradle.properties`.

```sh
cd apps/resident-app
CI=1 npx expo prebuild --platform android --no-install
cd android
SENTRY_DISABLE_AUTO_UPLOAD=true NODE_ENV=production ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Drop `SENTRY_DISABLE_AUTO_UPLOAD=true` once Sentry is set up (section 4).

Confirm it is signed with the upload key, not the debug key:

```sh
keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab | grep SHA256
# upload key: 69:BA:C3:DF:41:86:9B:49:37:9A:0D:15:A3:69:7B:46:05:B4:E7:19:D7:38:37:E1:F9:F5:9C:4D:25:39:4A:EF
```

## 3. Upload

```sh
cd apps/resident-app
fastlane android upload                    # internal testing: live for testers at once
fastlane android upload track:production   # production, as a draft
```

Test on a real Samsung phone from the internal track before production.

### What's new — 1.0.15 (21)

```
• Starts up reliably — no more getting stuck on the start screen on some phones, especially Samsung.
• Your home screen opens once, with your name and flat shown straight away.
• Visitor and other alerts now appear on screen while the app is open.
• A clear message shows when your phone has no internet.
• Works properly in split screen and on foldable phones.
• Dark mode and notification fixes.
```

## 4. Crash reporting (Sentry)

The app reports crashes to Sentry only when a DSN is built in. Until then it
sends nothing.

1. In Sentry, create a **React Native** project (e.g. `resident-app`) and copy its DSN.
2. Add it to `apps/resident-app/.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN_RESIDENT=https://<key>@<org>.ingest.sentry.io/<id>
   ```
3. For readable stack traces, also create an auth token (scope _project:releases_)
   and build with:
   ```sh
   export SENTRY_AUTH_TOKEN=<token> SENTRY_ORG=<org-slug> SENTRY_PROJECT=resident-app
   ```
   and **without** `SENTRY_DISABLE_AUTO_UPLOAD`. The build uploads source maps under
   the native release (`com.marzi.resident@<version>+<versionCode>`), the same
   release the app reports, so traces resolve to real file and line numbers.
4. Rebuild and upload as above. The DSN is compiled in, so it only takes effect
   from the next build.

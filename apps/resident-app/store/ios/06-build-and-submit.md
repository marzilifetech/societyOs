# Getting the build to App Store Connect

## What is NOT done yet, and why
An App Store Connect app record could not be created for you: it requires
signing in to Apple with your account. Handling those credentials is not
something I will do — you need to create the record yourself. Everything else
(all metadata, privacy answers, screenshots) is prepared in this folder to paste
in.

Also missing locally:
- No App Store Connect API key (`~/.appstoreconnect/private_keys/` is empty)
- `APPLE_ID`, `ASC_APP_ID`, `APPLE_TEAM_ID` are unset
- EAS is not logged in (`eas whoami` → Not logged in)

## Order of operations
1. **Apple Developer portal** → Identifiers → register `com.societyos.resident`
   with Push Notifications enabled.
2. **App Store Connect** → My Apps → + → New App, using `01-app-information.md`.
3. Fill Version Information from `02-description-and-keywords.md`.
4. Fill App Privacy from `03-app-privacy.md`.
5. Answer Age Rating from `04-age-rating.md`.
6. Upload screenshots per `05-screenshots.md`.
7. Upload a build (below).
8. Add the demo account under App Review Information — see the warning in
   `02-description-and-keywords.md`. This is the top rejection cause here.

## Producing the build
The Android release was built locally with Gradle because the signing material
was already on this machine. iOS cannot work the same way: it needs a
Distribution certificate and an App Store provisioning profile from your Apple
account.

Once `eas login` is done:

```bash
cd apps/resident-app
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

EAS will offer to create the Distribution certificate and profile for you; let
it, unless your team already manages them.

Set `APP_VARIANT=production` — `app.config.ts` uses it to set
`aps-environment=production`. Building without it ships a development APNs
entitlement and **push silently stops working on App Store builds** (TestFlight
still works, which is what makes this so easy to miss).

## Before you submit — open items
- [ ] Bundle ID differs across platforms (iOS `com.societyos.resident`,
      Android `com.marzi.resident`). Confirm this is intended; iOS cannot be
      changed after first submission.
- [ ] `https://marzitech.in/privacy-policy` 404s. Fix it or use the
      amplifyapp.com URL in the listing.
- [ ] Community feed needs report + block to satisfy Guideline 1.2 (UGC).
- [ ] In-app account deletion must exist, not just the web page
      (Guideline 5.1.1(v)).
- [ ] The app's display name is "One Community" but the privacy policy calls it
      "Resident App - Marzi". Align them; a reviewer comparing the two will ask.
- [ ] Sentry has no org/project configured, so no iOS source maps will upload
      either. Set SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN.

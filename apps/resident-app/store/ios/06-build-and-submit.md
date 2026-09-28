# Getting One Community onto the App Store (Marzi account)

The release is built and uploaded from this Mac with Xcode, signed by the
**Marzi** Apple Developer team. The only App Store distribution certificate
currently in this Mac's keychain belongs to a different team (KLUKLU VENTURES,
5JDUG85ST9), so it must not be used.

## Status

| Step                                                     | State                                       |
| -------------------------------------------------------- | ------------------------------------------- |
| Store text, privacy and age-rating answers (01–04)       | Ready                                       |
| Screenshots, 6.9" and 6.5" (05, `screenshots/`)          | Ready                                       |
| iOS permission strings, push entitlement, encryption key | Fixed in `app.json`                         |
| Community feed hidden on iOS (Guideline 1.2)             | Done (`UGC_ENABLED`)                        |
| Demo account for Apple's reviewer                        | Script ready, **not yet run on production** |
| Marzi team signed in to Xcode                            | **You**                                     |
| Bundle ID registered, App Store Connect record created   | **You**                                     |
| Archive + upload                                         | After the above                             |

## 1. Sign in to the Marzi team in Xcode (you)

Xcode → Settings → Accounts → **+** → Apple ID → the Apple ID that belongs to
the Marzi developer team. Note the **Team ID** it shows (10 characters).

## 2. Register the app (you, in the browser)

1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers
   → **+** → App IDs → App → Bundle ID `com.societyos.resident`, with the
   **Push Notifications** capability ticked.
   - This ID is permanent once submitted. Android uses `com.marzi.resident`;
     if you want iOS to match, change `ios.bundleIdentifier` in `app.json`
     **now**, before the first upload.
2. appstoreconnect.apple.com → Apps → **+** → New App, using
   `01-app-information.md`.
3. Push: create an APNs key (Keys → **+** → Apple Push Notifications service)
   and upload it to the Firebase project (Project settings → Cloud Messaging
   → Apple app configuration). See the push warning under "Open items" —
   the key alone is not enough.

## 3. Create the reviewer's demo society on production

`backend/prisma/seed-app-review.ts` creates _Marzi Demo Residency (App
Review)_ with resident `9999999001` (fixed OTP `0000`, already hardcoded in
`auth.service.ts`) and enough data that no screen is empty. It changes only
rows inside that demo society.

```bash
cd backend
# 1) Dry run: prints the target database host and writes nothing.
DATABASE_URL='<production url>' npx ts-node prisma/seed-app-review.ts
# 2) Apply.
DATABASE_URL='<production url>' APP_REVIEW_CONFIRM=yes npx ts-node prisma/seed-app-review.ts
```

Then sign in on a phone with the steps in `02-description-and-keywords.md` to
prove it works. Re-run the script before every future review; it refreshes
the dates. The society appears in the public society list while it is
visible; after approval, hide it with the super-admin "Show in directory"
toggle.

The canteen fix (`fix(canteen): show today's menu…`) is a backend change.
Deploy the backend before review, or the reviewer sees an empty canteen.

## 4. Archive and upload

Replace `MARZI_TEAM_ID` in `ExportOptions.plist` with the Team ID from step 1,
then:

```bash
cd apps/resident-app

# Regenerate ios/ in production mode: aps-environment=production and the
# permission strings from app.json. Building without APP_VARIANT=production
# ships a development push entitlement, and push silently fails on App Store
# builds while TestFlight still works.
APP_VARIANT=production npx expo prebuild --platform ios --clean

# The release bundle takes EXPO_PUBLIC_API_URL from .env (the production
# API). Make sure it is not overridden in your shell.
unset EXPO_PUBLIC_API_URL

APP_VARIANT=production SENTRY_DISABLE_AUTO_UPLOAD=true \
xcodebuild -workspace ios/OneCommunity.xcworkspace -scheme OneCommunity \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/OneCommunity.xcarchive \
  DEVELOPMENT_TEAM=<MARZI_TEAM_ID> CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates archive

xcodebuild -exportArchive -archivePath build/OneCommunity.xcarchive \
  -exportOptionsPlist store/ios/ExportOptions.plist \
  -exportPath build/export -allowProvisioningUpdates
```

`-allowProvisioningUpdates` lets Xcode create the Marzi distribution
certificate and App Store profile the first time. The export step uploads
straight to App Store Connect (`destination = upload`). To do it by hand
instead: Xcode → Window → Organizer → the archive → Distribute App → App Store
Connect.

Version `1.0.14`, build `1`. Every later upload needs a higher build number:
set `ios.buildNumber` in `app.json`.

## 4b. TestFlight (internal testers)

Once the upload finishes processing (App Store Connect emails you, usually
10–30 minutes):

1. App Store Connect → the app → **TestFlight**. If the build shows
   "Missing Compliance", answer "None of the algorithms mentioned above". It
   should not appear, because the build declares
   `ITSAppUsesNonExemptEncryption = false`.
2. **Internal Testing → +** → create a group (e.g. "Marzi team") and add
   people from Users and Access. Internal testers must be App Store Connect
   users. No Beta App Review is needed.
3. Add the build to the group. Testers get an email and install through the
   TestFlight app.
4. **Test Information → What to Test** (shown to testers):

```
First iOS build of One Community. Please check:
- Sign in with your society and mobile number.
- A visitor logged at the gate shows Approve / Reject on Home — approve one.
- Maintenance dues, Canteen menu, Services, Notices (open one) and Polls.
- Settings → Delete account (use a throwaway account).
- Emergency SOS: test only in a demo society.
Known: push notifications are not delivered on iOS yet.
```

External testers (anyone by email or public link) need a one-time Beta App
Review using the same demo account as the App Store review.

## 5. Submit (App Store Connect)

1. Wait for the build to finish processing (email, about 10–30 minutes). Add
   it to version 1.0.14.
2. Fill in the version page from `02-description-and-keywords.md`. Leave
   What's New empty; it does not exist for a first version.
3. App Privacy: `03-app-privacy.md`. Age Rating: `04-age-rating.md`.
4. Screenshots: `screenshots/6.9/` in numbered order.
5. App Review Information: the demo account and notes from `02-…`.
6. Export compliance should not be asked (`ITSAppUsesNonExemptEncryption =
false`). If it is, answer "None of the algorithms mentioned above".
7. Submit for Review. Choose manual release if you want to pick the launch
   moment.

## Open items that do not block this submission

- ⚠️ **Push notifications do not reach iOS yet.** The app registers the raw
  APNs device token (`getDevicePushTokenAsync` in `src/lib/push.ts`), but the
  backend sends only through Firebase Admin (FCM), which rejects APNs tokens.
  There is also no iOS Firebase app (`GoogleService-Info.plist`). Review
  does not test push, and the in-app gate card covers visitors while the app
  is open, but residents get no alert when it is closed. The fix: register an
  iOS app in Firebase, add `GoogleService-Info.plist`, upload the APNs key,
  and have iOS register an FCM token (via `@react-native-firebase/messaging`)
  instead of the APNs token. Ship it in 1.0.1, or hold the launch for it.
- Report + block for the community feed. Needed before `UGC_ENABLED` can
  be turned on for iOS.
- `https://marzitech.in/privacy-policy` still returns 404. The listing uses
  the amplifyapp.com URL, which works.
- The privacy policy calls the app "Resident App - Marzi"; the store name is
  "One Community". Align them when convenient.
- Sentry has no org/project configured, so builds skip symbol upload
  (`SENTRY_DISABLE_AUTO_UPLOAD=true`).

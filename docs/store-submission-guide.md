# Store Submission Guide — SocietyOS Resident & Staff Apps

Tailored checklist + step-by-step for getting **resident-app** (`com.societyos.resident`) and
**staff-app** (`com.societyos.staff`) approved on the **Apple App Store** and **Google Play**.

Last updated: 2026-06-17.

---

## 0. What was already fixed in code

These code/config changes are done (commit them before building):

| Change                                                     | resident-app                      | staff-app                          |
| ---------------------------------------------------------- | --------------------------------- | ---------------------------------- |
| In-app **Delete Account** button (Apple 5.1.1(v) + Google) | ✅ added to Profile               | ✅ already present                 |
| **Privacy Policy + Terms** links                           | ✅ added (Legal section, Profile) | ✅ updated (Settings → About)      |
| Links point to **live** Marzi URLs                         | ✅                                | ✅                                 |
| Tightened iOS permission usage strings                     | ✅                                | n/a (already specific via plugins) |
| `NSPhotoLibraryUsageDescription` present                   | ✅                                | ✅ added                           |
| Blocked unused `RECORD_AUDIO` Android permission           | ✅                                | ✅                                 |
| Backend account deletion = **soft delete only**            | ✅ verified (no change needed)    | ✅ same endpoint                   |

Backend deletion path: `POST /auth/delete` → `auth.service.deleteAccount` → `compliance.dataDelete`.
It uses only `.update()`/`.updateMany()` (never `.delete()`): sets `status=SUSPENDED` + `deletedAt`,
scrubs PII (name/phone/email/KYC docs), **keeps the row** for the audit trail, revokes the token.
It does **not** call Marzi to delete anything.

---

## 1. ⚠️ Must-do items BEFORE you submit (these block approval)

1. **Privacy policy must match the app's data.** The links now point to
   `https://marzi.life/privacy-policy` and `https://marzi.life/terms-and-conditions` (both live).
   **Problem:** Marzi's policy reads as an _events/ticketing_ policy — it does **not** mention the data
   these apps actually collect: **KYC documents (Aadhaar/PAN/ID/address proof), visitor & complaint
   photos, GPS location for SOS, device push tokens.** Reviewers (and DPDP law) require the policy to
   describe the real data collection. **Action:** ask whoever owns marzi.life to add a SocietyOS /
   gated-community section covering the data list in §3 below. Otherwise expect a privacy rejection.

2. **Google needs a WEB account-deletion URL (not just the in-app button).** Google Play requires a
   publicly reachable page where a user can request account + data deletion _without logging in_.
   **Action:** publish a simple page (e.g. `https://marzi.life/account-deletion` or a form that emails
   support@marzi.in) describing: what gets deleted, what's retained (audit/legal), and how to request it.
   You'll paste this URL into Play Console (§5, Data safety → Data deletion).

3. **Confirm the production API endpoint for resident-app.** `apps/resident-app/eas.json` points the
   **production** build at `https://society-dev.marzitech.in/v1` (a dev host). If you ship that to the
   store, real users hit the dev backend. Update it to the real production API before the production build
   (staff-app already uses `https://api.societyos.app/v1`). _Left unchanged — your infra decision._

4. **App icons / screenshots / store listing copy** — have these ready (see §4).

---

## 2. Build & submit commands (Expo EAS)

Native dirs are gitignored — EAS prebuilds during the cloud build.

```bash
# from apps/resident-app  (and repeat in apps/staff-app)

# iOS production build
APP_VARIANT=production eas build --platform ios --profile production

# Android production build (.aab app bundle)
APP_VARIANT=production eas build --platform android --profile production

# Submit (after the build finishes)
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

Bump `version` + `android.versionCode` in each `app.json` for every new store build
(production profile already auto-increments Android versionCode).

---

## 3. Data inventory — use this to fill BOTH stores' privacy forms

| Data                                                        | Collected? | Linked to user identity? | Used for tracking/ads? | Purpose                   |
| ----------------------------------------------------------- | ---------- | ------------------------ | ---------------------- | ------------------------- |
| Phone number                                                | Yes        | Yes                      | No                     | Account / OTP auth        |
| Name                                                        | Yes        | Yes                      | No                     | Account, identification   |
| Email (optional)                                            | Yes        | Yes                      | No                     | Contact                   |
| Photos (visitor, complaint, task, profile)                  | Yes        | Yes                      | No                     | App functionality         |
| KYC docs — Aadhaar/PAN/ID/address (resident)                | Yes        | Yes                      | No                     | Identity verification     |
| Precise location/GPS (**staff only**: task photos + SOS)    | Yes        | Yes                      | No                     | App functionality, safety |
| Device push token (FCM)                                     | Yes        | Yes                      | No                     | Push notifications        |
| Crash logs + app version + user id (**staff only**, Sentry) | Yes        | Yes                      | No                     | Crash diagnostics         |
| Advertising ID / IDFA                                       | **No**     | —                        | —                      | —                         |

Everything is collected for app functionality; **nothing is used for tracking or advertising**, and there's
**no data "sharing" for ads.** Data is sent to your own backend/S3, the Marzi OTP provider, and (staff)
Sentry for crash reports. All transmitted over HTTPS (encrypted in transit).

---

## 4. Store listing assets you need (both stores)

- App name, short + full description, category (Lifestyle / House & Home).
- App icon (1024×1024 for iOS).
- Screenshots: iOS — 6.7" and 5.5" iPhone sets; Android — phone screenshots (min 2).
- Feature graphic 1024×500 (Play).
- Support URL + support email.
- Content rating questionnaire (Play uses IARC; Apple has its own age-rating Qs).

---

## 5. GOOGLE PLAY — step by step

> Console: https://play.google.com/console — do this once per app (resident, staff).

1. **Create the app** → All apps → _Create app_. Name, default language, App (not Game), Free.
2. **Set up → App access:** reviewers can't sign up (phone OTP). Provide **test login instructions** +
   a working test phone number / OTP, or a demo account, under _App access → All functionality → Add
   instructions_. **Apps get rejected when reviewers can't get past login — don't skip this.**
3. **Privacy policy:** Policy → App content → _Privacy policy_ → paste `https://marzi.life/privacy-policy`.
4. **Data safety form** (App content → _Data safety_):
   - Does your app collect or share user data? **Yes.**
   - Add each data type from §3. For every one: collected = Yes, shared = No (unless you count the OTP
     provider as sharing — it's a processor, usually "collected, not shared"), processed ephemerally = No,
     required (not optional) for the relevant features.
   - Categories to tick: **Personal info** (name, phone, email), **Photos**, **Location → Precise location**
     (staff app only — _do not tick for resident app_, since you blocked its use), **App activity / Device
     IDs** (push token), **App info & performance → Crash logs** (staff app, Sentry).
   - Security practices: **Data is encrypted in transit = Yes.**
   - **Data deletion:** "Users can request that some or all data is deleted." Provide the **web URL** from
     §1.2. Also indicate users can delete their account **in-app**.
5. **Account deletion declaration** (App content → _Delete app account_, where present): confirm in-app
   deletion exists and provide the same web URL.
6. **Permissions:** since you blocked `RECORD_AUDIO` and the resident app has no real location use, you
   shouldn't trigger the sensitive-permissions declaration. If Play flags **location** (staff app), declare
   it's used **only in foreground** for task verification + SOS (no background location).
7. **Content rating** → fill the IARC questionnaire.
8. **Target audience, Ads (declare: No ads), News, COVID, Data safety** — complete all App content cards
   until they're all green.
9. **Production → Create release** → upload the `.aab` → fill release notes → roll out.
   - First time: start with **Internal testing** track → add your testers → verify the Delete Account flow,
     the privacy links open, and login works → then promote to Production.
10. Make sure the build **targets API 35** (Expo SDK 52 default — you're fine).

---

## 6. APPLE APP STORE — step by step

> App Store Connect: https://appstoreconnect.apple.com — once per app.

1. **Apps → +** → New App. Platform iOS, name, primary language, bundle ID
   (`com.societyos.resident` / `com.societyos.staff`), SKU.
2. **App Privacy** (left nav → _App Privacy_):
   - _Privacy Policy URL:_ `https://marzi.life/privacy-policy`.
   - _Get Started_ on Data Collection → add each data type from §3.
   - For each: usually **"Data linked to you"**, purpose **App Functionality** (Location/SOS = also
     "App Functionality"; crash = "App Functionality / Analytics"). **Tracking = No** for everything →
     so you do **not** need App Tracking Transparency.
3. **App Review Information:** provide a **demo phone number + OTP** (or a reviewer test account) +
   notes — same login-access concern as Play. Add a note: _"Account can be deleted in-app via
   Profile → Delete Account."_ Reviewers actively check 5.1.1(v) — point them to it.
4. **Permission strings** are already in `app.json` (camera, photo library, location). They're specific —
   that's what Apple wants.
5. **Privacy manifest:** Expo SDK 52 auto-generates it and Sentry ships its own, so usually nothing to do.
   If Apple emails an `ITMS-91053 / missing privacy manifest` notice after upload, add an
   `ios.privacyManifests` block to `app.json` with the required-reason codes from the email and rebuild.
6. **Age rating, category, screenshots, description** → fill the _App Information_ + version pages.
7. Upload the build via `eas submit`, attach it to the version, then **Add for Review → Submit**.

---

## 7. Final pre-flight checklist

- [ ] marzi.life privacy policy updated to cover KYC docs, photos, location, push tokens (§1.1)
- [ ] Web account-deletion request URL published (§1.2)
- [ ] resident-app production API endpoint confirmed (§1.3)
- [ ] Reviewer test login (phone + OTP / demo account) provided in BOTH consoles
- [ ] Delete Account tested end-to-end on both apps (logs out + erases on backend)
- [ ] Privacy/Terms links open the live Marzi pages from inside both apps
- [ ] Data safety (Play) + App Privacy (Apple) forms match §3 exactly
- [ ] Screenshots / icon / descriptions uploaded
- [ ] Builds target API 35 (Android) — Expo SDK 52 default

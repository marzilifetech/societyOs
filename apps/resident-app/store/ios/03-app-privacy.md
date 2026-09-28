# App Store Connect — App Privacy questionnaire

Answers derived from the published privacy policy
(apps/admin-web/src/app/privacy-policy/page.tsx) and from what the app code
actually sends. Do not soften these — Apple cross-checks the declaration against
observed network behaviour, and an inaccurate one is a removal risk.

## Tracking

**"Do you or your third-party partners use data for tracking?"** → **No**

The policy states there is no advertising identifier (IDFA), no third-party
advertising and no cross-app tracking. So:

- Do NOT include `NSUserTrackingUsageDescription`.
- Do NOT add the AppTrackingTransparency prompt.
- Every data type below is "Not used for tracking".

## Data collected — declare each of these

### Contact Info → Phone Number

- Collected: Yes · Linked to the user: **Yes** · Tracking: No
- Purposes: **App Functionality** (it is the sign-in identifier)

### Identifiers → User ID

- Collected: Yes · Linked: **Yes** · Tracking: No
- Purposes: **App Functionality**
- (Account id, and the device push-notification token.)

### User Content → Photos or Videos

- Collected: Yes · Linked: **Yes** · Tracking: No
- Purposes: **App Functionality**
- (Visitor photos, service-request proof, profile photo.)

### User Content → Other User Content

- Collected: Yes · Linked: **Yes** · Tracking: No
- Purposes: **App Functionality**
- (Community posts and comments, complaint and request text.)

### Sensitive Info

- Collected: Yes · Linked: **Yes** · Tracking: No
- Purposes: **App Functionality**
- KYC identity documents — Aadhaar, PAN, ID proof, address proof — uploaded for
  the society office to verify residency. Apple classes government ID as
  Sensitive Info.

### Location → Precise Location

- Collected: Yes · Linked: **Yes** · Tracking: No
- Purposes: **App Functionality**
- ⚠️ In the RESIDENT app, location is captured **only when the user raises an
  Emergency SOS**, in the foreground. It is not background location and there is
  no continuous tracking. Say exactly this in the review notes — a Precise
  Location declaration invites a question about background use.

### Diagnostics → Crash Data

- Collected: Yes · Linked: **Yes** · Tracking: No
- Purposes: **App Functionality** (Sentry; carries a non-identifying user ref)

### Diagnostics → Performance Data

- Collected: Yes · Linked: **Yes** · Tracking: No
- Purposes: **App Functionality** (Sentry)

### Health & Fitness → Health

- Collected: Yes · Linked: **Yes** · Tracking: No
- Purposes: **App Functionality**
- The native health module is off in this build (`HEALTH_ENABLED = false`), but
  the **PLUS** tile on Home opens the Care portal in an in-app WebView
  (`app/plus.tsx` → `/care` on admin-web), and the portal logs vitals and keeps
  health records. Data collected inside a WebView the app hosts counts as
  collected by the app. Declare it; omitting a real collection is far worse
  than over-declaring.

## Account deletion (required since 2022)

Apple requires an in-app route to delete the account for any app that creates
one. Covered: Settings → **Delete account** exists in the app
(`app/settings/index.tsx`), and the web page
`https://main.demjupsqzi02t.amplifyapp.com/account-deletion` also resolves
(checked 2026-09-28).

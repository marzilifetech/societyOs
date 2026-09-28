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

## Data collected — tick exactly these (verified against build 1.0.14 (1))

For EVERY type below: **Linked to the user: Yes · Used for tracking: No ·
Purpose: App Functionality only.**

| Category     | Data type               | What it is in this app                                             |
| ------------ | ----------------------- | ------------------------------------------------------------------ |
| Contact Info | Name                    | Resident's name (profile)                                          |
| Contact Info | Email Address           | Optional email on the profile                                      |
| Contact Info | Phone Number            | Sign-in number                                                     |
| Contact Info | Physical Address        | Society, block and flat                                            |
| Contact Info | Other User Contact Info | Names/phones of visitors, family, domestic help, emergency contact |
| Location     | Precise Location        | Attached to an Emergency SOS only, foreground                      |
| User Content | Photos or Videos        | Visitor photos, ID-document images, complaint photos               |
| User Content | Customer Support        | Complaints, concierge requests, feedback                           |
| User Content | Other User Content      | Service-request text, vehicle numbers                              |
| Identifiers  | User ID                 | Account id                                                         |
| Identifiers  | Device ID               | Push-notification token                                            |
| Other Data   | Other Data Types        | Government ID numbers (Aadhaar, PAN) for residency verification    |

## Not collected — leave unticked

Health & Fitness · Financial Info · Sensitive Info (Apple's definition covers
race, religion, biometrics etc., not ID numbers) · Contacts · Emails or Text
Messages · Audio · Gameplay · Browsing/Search History · Purchases · Usage Data ·
**Diagnostics** · Surroundings · Body.

Diagnostics is correct only while Sentry is off: `EXPO_PUBLIC_SENTRY_DSN_RESIDENT`
is unset for production, so no crash or performance data leaves the device.
Setting a DSN in a later build means adding Diagnostics → Crash Data and
Performance Data in the same release. There are no payments (office-only) and no
analytics SDKs.

## Account deletion (required since 2022)

Apple requires an in-app route to delete the account for any app that creates
one. Covered: Settings → **Delete account** exists in the app
(`app/settings/index.tsx`), and the web page
`https://society-admin-dev.marzitech.in/account-deletion` also resolves
(checked 2026-09-28).

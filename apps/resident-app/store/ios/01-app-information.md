# App Store Connect — App Information

App: One Community (resident app)

Store name **One Community by Marzi** — "One Community" is taken on the App
Store. The name under the icon stays "One Community" (`expo.name`); Apple
accepts a store name that contains the on-device name (Guideline 2.3.8).

Paste each field into App Store Connect. Character counts are Apple's limits;
every value below is within them.

## Create the app record (My Apps → + → New App)

| Field            | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| Platform         | iOS                                                      |
| Name             | `One Community by Marzi`                                 |
| Primary language | English (India) — or English (U.S.) if IN is unavailable |
| Bundle ID        | `com.societyos.resident`                                 |
| SKU              | `societyos-resident-ios`                                 |
| User Access      | Full Access                                              |

⚠️ The bundle ID must already exist in the Apple Developer portal
(Certificates, Identifiers & Profiles → Identifiers) before it appears in this
dropdown. Create it with these capabilities enabled:
Push Notifications, Associated Domains (only if you add universal links later).

⚠️ BUNDLE ID MISMATCH — the two platforms do not agree:
iOS com.societyos.resident
Android com.marzi.resident
Neither is wrong, but confirm `com.societyos.resident` is the identifier you
want permanently: it cannot be changed after the first submission.

## App Information (localisable)

| Field                | Limit | Value                                |
| -------------------- | ----- | ------------------------------------ |
| Name                 | 30    | `One Community by Marzi`             |
| Subtitle             | 30    | `Your society, in one app`           |
| Category (primary)   | —     | Lifestyle                            |
| Category (secondary) | —     | Utilities                            |
| Content Rights       | —     | Does not contain third-party content |
| Age Rating           | —     | 4+ (see 04-age-rating.md)            |

## General

| Field              | Value                                                   |
| ------------------ | ------------------------------------------------------- |
| Privacy Policy URL | `https://society-admin-dev.marzitech.in/privacy-policy` |
| Support URL        | `https://society-admin-dev.marzitech.in/privacy-policy` |
| Marketing URL      | _(leave blank)_                                         |
| Copyright          | `2026 Marzi Agetech Private Limited`                    |

The listing uses `https://society-admin-dev.marzitech.in/privacy-policy` for both
URLs (200, with a Contact us section). `https://marzitech.in/privacy-policy`
still returns 404, so don't use that one.

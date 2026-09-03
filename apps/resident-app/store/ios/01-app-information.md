# App Store Connect — App Information
App: One Community (resident app)

Paste each field into App Store Connect. Character counts are Apple's limits;
every value below is within them.

## Create the app record (My Apps → + → New App)
| Field | Value |
|---|---|
| Platform | iOS |
| Name | `One Community` |
| Primary language | English (India) — or English (U.S.) if IN is unavailable |
| Bundle ID | `com.societyos.resident` |
| SKU | `societyos-resident-ios` |
| User Access | Full Access |

⚠️ The bundle ID must already exist in the Apple Developer portal
(Certificates, Identifiers & Profiles → Identifiers) before it appears in this
dropdown. Create it with these capabilities enabled:
Push Notifications, Associated Domains (only if you add universal links later).

⚠️ BUNDLE ID MISMATCH — the two platforms do not agree:
    iOS      com.societyos.resident
    Android  com.marzi.resident
Neither is wrong, but confirm `com.societyos.resident` is the identifier you
want permanently: it cannot be changed after the first submission.

## App Information (localisable)
| Field | Limit | Value |
|---|---|---|
| Name | 30 | `One Community` |
| Subtitle | 30 | `Your society, in one app` |
| Category (primary) | — | Lifestyle |
| Category (secondary) | — | Utilities |
| Content Rights | — | Does not contain third-party content |
| Age Rating | — | 4+ (see 04-age-rating.md) |

## General
| Field | Value |
|---|---|
| Privacy Policy URL | `https://main.demjupsqzi02t.amplifyapp.com/privacy-policy` |
| Support URL | `https://main.demjupsqzi02t.amplifyapp.com/privacy-policy` |
| Marketing URL | *(leave blank)* |
| Copyright | `2026 Marzi Lifetech Private Limited` |

⚠️ `https://marzitech.in/privacy-policy` returns **404** — only the
amplifyapp.com URL resolves. Apple checks these links during review, so either
fix the custom-domain route first or submit the amplifyapp.com URL.
A dedicated support page (not the privacy policy) would be better; Apple accepts
a page with a contact route, and the policy lists support@marzi.in.

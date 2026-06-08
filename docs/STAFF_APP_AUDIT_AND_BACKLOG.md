# Staff App — Audit, Work Done & Prioritized Backlog

_Generated 2026-06-08. Senior-engineer pass on `apps/staff-app` (Expo SDK 52, expo-router, RN 0.76.9)._

## TL;DR

The staff app was **crashing on launch** (native modules not linked). That is **fixed — it now runs cleanly on a device**. A full screen-by-screen audit shows the app is **~95% feature-complete** (NOT a proof-of-concept), so the remaining work is **targeted fixes + polish**, not a rebuild. Multilingual support (your request) is **done**: Telugu added, Kannada/Tamil/Marathi completed to full parity.

---

## ✅ Done this session (in working tree, on branch `feat/media-uploads-auth-test-numbers`)

### 1. Fixed launch crash — `Cannot find native module …`

Expo autolinks native modules only from a package's runtime `dependencies`.

- `expo-image-picker` was in **`devDependencies`** → moved to `dependencies`.
- `expo-linking` (needed by `expo-router`) and `expo-image` (used in 8 files) were **undeclared** → added via `expo install`.
- Regenerated native project with `expo prebuild --clean` (the git cleanup had left `android/app/src/main` missing on disk).
- Result: Metro bundles all 2152 modules, **no native errors, app runs**. Verified on device (Redmi, Android 15).

### 2. Multilingual (your explicit request)

| Locale       | Before    | After               |
| ------------ | --------- | ------------------- |
| Hindi (hi)   | 194/194 ✓ | unchanged           |
| Kannada (kn) | 65/194    | **194/194** ✓       |
| Tamil (ta)   | 65/194    | **194/194** ✓       |
| Telugu (te)  | absent    | **194/194** ✓ (new) |
| Marathi (mr) | 65/194    | **194/194** ✓       |

- Wired `te` into `src/lib/i18n.ts` (import, `AppLocale`, `SUPPORTED_LOCALES`, storage validation, resources).
- Validated all locales: exact key parity + **placeholder integrity** (`{{var}}`) — zero mismatches.
- Verified on device: all 6 languages render in the picker (native scripts), Telugu selection **persists across app restart**.
- ⚠️ Translations beyond Hindi are **machine-generated → need a native-speaker review pass** before production.

---

## Facts that reshape the original request

- **Playwright can't test this app.** It drives web browsers; the staff app is native RN. QA is done on-device (adb screenshots/logcat/deep-links). Playwright would only apply to `admin-web`.
- **Postman has no staff endpoints** — the collection is resident/admin only. Backend code is the source of truth for staff. _Optional deliverable: add a Staff folder to the collection._
- **Multitenancy is already handled** for staff: single society via JWT `societyId`, resolved server-side. No `X-Society-Id` work needed (that's super-admin only). Don't add staff multi-society without a design review.
- **Auth/PIN flow is off-limits** (standing rule) and is English-only by design.

---

## Prioritized backlog (needs your go-ahead per item)

### P1 — correctness / completeness

1. **Push notifications wiring** — `src/lib/notifications.ts` has `TODO: wire in push.service.ts`. Backend uses **FCM** and exposes `POST /staff/devices {token, platform}` (richer than the `POST /auth/device-token` the app currently calls, which drops `platform`). Decide canonical endpoint, register the real device token, and verify a test push end-to-end. _Needs device testing._
2. **Security rounds persistence** — `app/rounds/index.tsx` is a local-only timer; completions aren't saved. Needs a backend `POST /staff/rounds/...` endpoint + integration (backend currently exposes only `GET /staff/rounds` placeholder).
3. **Housekeeping list screen** — completion screen exists but there's no list to reach it from home.

### P2 — quality

4. **Native-speaker review** of kn/ta/te/mr translations.
5. **Accessibility** — add `accessibilityLabel`/`accessibilityRole` to key buttons/inputs (currently minimal).
6. **Localize nav-header titles** (currently static English) and the hardcoded FAQ in `settings/help.tsx`.

### P3 — nice-to-have

7. Offline caching for more lists (only task-photos queue today).
8. Add staff endpoints to the Postman collection.

### Explicitly NOT doing autonomously

- Auth/PIN changes (off-limits).
- Large subjective UI rewrites on a working app (high risk while you're away) — propose specific screens and I'll do them with you.

---

## How to run it

```
cd apps/staff-app
npx expo prebuild --clean --platform android   # only if android/app/src/main is missing
ANDROID_SERIAL=<device> npx expo run:android
```

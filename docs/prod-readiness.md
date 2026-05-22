# SocietyOS — Production-Readiness Plan
> Source: `docs/BRD.pdf` §9 Security, §11 Constraints, §10 Go-Live Checklist, §12 Success Metrics
> Last updated: 2026-05-01 (backend `backend/src/` pass)

---

## Already in place (verified)

| Item | Where | Status |
|---|---|---|
| Helmet (CSP, HSTS preload, frame-deny, COOP/CORP) | `backend/src/common/config/helmet.config.ts`, `backend/src/main.ts` | ✅ prod uses `buildHelmetOptions(true)` |
| Compression + CORS allowlist (`CORS_ORIGINS`) | `backend/src/main.ts`, `backend/src/common/config/cors.config.ts` | ✅ |
| ValidationPipe global (whitelist + transform) | `backend/src/main.ts` | ✅ |
| URI versioning (`/v1/...`) | `backend/src/main.ts` | ✅ |
| Swagger / OpenAPI | `backend/src/common/config/swagger.config.ts` | ✅ dev / gated |
| HTTP exception filter (envelope-aware, throttling) | `backend/src/common/filters/http-exception.filter.ts` | ✅ |
| Global response envelope `{ data, meta, error }` | `backend/src/common/interceptors/response-envelope.interceptor.ts` | ✅ skips `/health`, `/readyz`, `/metrics`, `/api/docs` |
| Request-ID middleware | `backend/src/common/middleware/request-id.middleware.ts` | ✅ |
| Structured logging (nestjs-pino) | `backend/src/common/logging/logger.module.ts` | ✅ |
| Sentry bootstrap (optional DSN) | `backend/src/common/logging/sentry.ts`, `backend/src/main.ts` | ✅ no-op without DSN |
| Config validation (Joi) | `backend/src/common/config/env.validation.ts` | ✅ fail-fast |
| `@nestjs/throttler` global guard + SOS/auth trackers | `backend/src/common/config/throttler.config.ts`, `backend/src/app.module.ts` | ✅ env TTL/limits (`THROTTLE_*`) |
| Liveness `/health`, readiness `/readyz` | `backend/src/common/health/health.controller.ts` | ✅ `readyz` = Prisma + Redis (**no S3 HEAD** yet) |
| Graceful shutdown hooks + LB drain flag | `backend/src/main.ts`, `shutdown.middleware.ts`, `health.controller.ts` | ✅ |
| Real AWS S3 SDK (with fallback) | `backend/src/common/storage/s3.service.ts` | ✅ |
| Socket.io gateways + `RealtimeGateway` buffer | `backend/src/common/realtime/events.gateway.ts`, `backend/src/modules/sos/sos.gateway.ts`, `backend/src/common/realtime/realtime.gateway.ts`, `backend/src/common/realtime/realtime.module.ts` | ✅ Redis adapter optional in `events.gateway.ts` |
| FCM sends (`firebase-admin`) + token hygiene | `backend/src/common/notification/push.service.ts`, `notification.service.ts` | ✅ requires credentials env |
| Auth: refresh rotation + Redis denylist pattern | `backend/src/modules/auth/token.service.ts`, `jwt.strategy.ts` | ✅ |
| Auth: OTP 10/min + 5-fail lockout 15min | `backend/src/modules/auth/otp.service.ts` | ✅ Redis-backed |
| Auth: admin TOTP setup/verify/disable | `backend/src/modules/auth/totp.service.ts`, `auth.controller.ts` | ✅ |
| Razorpay: order create + payment HMAC verify + webhook raw-body HMAC | `backend/src/modules/maintenance/maintenance.service.ts`, `maintenance.controller.ts`, `backend/src/main.ts` raw body route | ✅ |
| Admin payment reminder → push | `backend/src/modules/admin/admin.service.ts` (`sendPaymentReminder`) | ✅ `PushService` / opt-out / quiet-hours handling |
| Prisma tenant client extension | `backend/src/prisma/prisma.service.ts`, `backend/src/common/tenancy/tenant.extension.ts` | ✅ |
| Audit interceptor (admin/staff mutating routes) | `backend/src/common/audit/audit.interceptor.ts` | ✅ |
| Property / travel / notices / polls API surface | `backend/src/modules/notice/notice.controller.ts` | ✅ resident + admin routes on same controller |
| Multi-tenant `society_id` + indexes | `backend/prisma/schema.prisma` | ✅ |
| GitHub Actions CI | `.github/workflows/ci.yml` | ✅ typecheck + lint + `audit-ci` + backend tests + builds |
| Backend unit/component specs | `backend/**/*.spec.ts` (**14 files** incl. Razorpay, tenancy, compliance, SOS, notices) | 🟡 no full integration harness yet |
| @types/react workspace pin | root `package.json` `pnpm.overrides` | ✅ |

---

## Remaining gaps — production gates

### 🔴 Must-have before launch (BRD-mandated)

| § | Gap | Owner | BRD ref | Notes |
|---|---|---|---|---|
| Infra readiness | Extend `/readyz` with optional S3 bucket HEAD (when S3 required for gated traffic) | P1 | §10 go-live | DB + Redis covered today (`health.controller.ts`) |
| DPDP / compliance | Operational coverage: consent versioning, retention job in prod schedulers, export/delete UX + runbooks verified end-to-end | P3 | §9.3 | `compliance/` module exists — verify workflows + payloads in staging |
| Encryption | Production use of `EncryptionService` for configured PII fields + key rotation policy | P3 | §9.2 | service present under `common/encryption/` |
| Frontend | Real `react-native-razorpay` on resident pay screen + production keys | P4 | §3.2.8 | backend verify + webhook ready |
| Frontend | Error boundaries / Sentry RN on resident + staff shells | P4 | §3.3 reliability | backend Sentry wired |
| Tests | Breadth of **integration/E2E** tests (OTP→session, SR assign, SOS happy path w/ sockets, Razorpay verify in test env) | P5 | §10 | unit specs expanded; supersuite still thin |

> **Collapsed from this table (verified in codebase, 2026-05-01):** API throttling; Helmet CSP/HSTS/frame-deny; Pino + request-id; envelope + filter; `/health` + `/readyz`; admin TOTP; OTP rate + lockout; JWT refresh rotation + denylist hooks; Socket.io gateways; Razorpay HMAC (payment + webhook); FCM push; tenant Prisma extension; audit interceptor; CI `audit-ci` job.

---

### 🟠 Should-have before launch

| § | Gap | Owner |
|---|---|---|
| Observability | Pino JSON → shipping to CloudWatch/Loki/Datadog (agent sidecar), not code | P1 |
| Auth | Configurable idle session semantics for admin (enforce via policy + UX) | P2 |
| Realtime | Mandatory Redis `@socket.io/redis-adapter` in multi-pod deploys | P2 |
| DPDP | Retention cron + legal review on anonymisation rules | P3 |
| DB | Composite indexes audit on hottest list queries (beyond current schema) | P3 |
| DB | Pagination defaults enforced consistently on large list endpoints | P3 |
| Refactor | Eliminate any remaining legacy `user.sub` as implicit `staffId` call sites outside guarded paths | P3 |
| Refactor | Dedupe overlap between `RealtimeGateway`, `events.gateway.ts`, SOS namespace — document contract | P2 |
| Frontend | Accessibility pass resident/staff shells | P4 |
| Frontend | Bundle/APK budget verification | P4 |
| Frontend | Resident strict-typing cleanup (dense screens) | P4 |
| Tests | Raise coverage targets on orchestration-heavy services | P5 |
| CI | Periodic review of audit-ci policy + CodeQL SARIF triage (`codeql.yml` present) | P5 |

> **Stale rows removed:** Sentry interceptor (wired). Pre-commit: `lint-staged` is configured in root `package.json` (ensure `.husky/pre-commit` enabled in cloned env).

### 🟢 Nice-to-have / Phase-2

- White-label theming (BRD §10 Phase 4)
- Public API + API key management (BRD §10 Phase 4)
- Penetration test + OWASP ZAP scan in CI (manual pre-launch)
- Razorpay business onboarding (out of code scope)

---

## Agent fleet (5 × 50 = 250 tasks, parallel)

> Each agent owns a disjoint set of files. `app.module.ts` is wired by P1; other agents leave a registration note in their final summary so P1 can finalise wiring.

### Agent P1 — Backend Hardening + Observability (50)
**Owns:** `backend/src/main.ts`, `backend/src/common/{filters,interceptors,middleware,logging,health,config}/`, `backend/src/app.module.ts`

1–6: Install `@nestjs/throttler`. Module + global guard. 100/min default, 10/min for `/auth/*`, 5/min for `/sos/trigger`. Configurable via env.
7–10: Install `nestjs-pino` + `pino-http`. Replace default Logger with Pino. JSON output prod, pretty in dev.
11–13: Request-ID middleware. Generates UUIDv7 if absent, propagates `X-Request-Id` header into logs.
14–18: Global `ResponseEnvelopeInterceptor` returning `{ data, meta, error: null }`. Update `HttpExceptionFilter` to mirror with `error: { code, message, details }`. Skip envelope for Swagger/health routes.
19–22: `HealthModule` using `@nestjs/terminus`. `/health` (liveness), `/readyz` (Prisma DB ping + Redis ping + optional S3 head bucket).
23–26: Config validation: install `joi`, validate `process.env` at boot — `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_URL`, `AWS_REGION`. Fail-fast with clear message.
27–29: Tighten Helmet: explicit CSP, HSTS with `preload`, frame-deny, X-Content-Type-Options.
30–32: Graceful shutdown: `app.enableShutdownHooks()`, drain BullMQ queues + close Prisma + Socket.io on SIGTERM.
33–36: Sentry hook: install `@sentry/node`, init at bootstrap, wrap exception filter, scrub PII via `beforeSend`.
37–40: Add `RequestLoggingInterceptor` capturing method, path, status, duration, request-id.
41–43: Body size limit (1 MB default), raw-body capture for Razorpay webhooks.
44–46: Update CORS to read explicit allowlist (`CORS_ORIGINS` comma-separated), reject `*` in prod.
47–48: `/api/docs` gated to non-prod or basic-auth-protected in prod.
49: Register all new modules in `app.module.ts` (collect P2/P3 module names from their summaries).
50: Verify `pnpm tsc --noEmit` clean and `pnpm test` passes.

### Agent P2 — Real Integrations + Auth Hardening (50)
**Owns:** `backend/src/common/realtime/`, `backend/src/common/notification/` (new), `backend/src/modules/auth/`, `backend/src/modules/notification/`, `backend/src/modules/maintenance/maintenance.service.ts` (Razorpay verify only), new `backend/src/modules/translate/`

**Realtime (1–10):**
1. Install `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`.
2. Create `EventsGateway` with `@WebSocketGateway({ cors, namespace: '/events' })`, JWT handshake auth.
3. Auto-join rooms on connect: `society:{id}:resident:{userId}`, `society:{id}:admin`, `society:{id}:gate`, `society:{id}:staff:{userId}`.
4. Wire `RealtimeGateway.setServer(server)` to receive Socket.io server in `afterInit`.
5. Test SOS broadcast: triggering SOS hits `society:{id}:admin` + `society:{id}:gate` + first-responder rooms.
6. Reconnect handler: client resyncs missed events via `since=` cursor on a fetch endpoint.
7. Server-side ping/pong every 25s.
8. Disconnect on token expiry.
9. Optional Redis adapter for horizontal scaling (`@socket.io/redis-adapter`).
10. Health check exposes connected-client count.

**FCM Push (11–18):**
11. Install `firebase-admin`. Init with service-account JSON via env (base64-encoded).
12. Create `PushService.send(userId, notification, data)` resolves device tokens from `User.fcmToken`.
13. Multicast support for `sendToSociety(societyId, role, payload)`.
14. Wire SOS, task-assigned, complaint-status-changed, payment-reminder events to `PushService`.
15. Per-category preference check (read `User.notificationPrefs`) before send.
16. Token cleanup: on FCM `Unregistered` error, null out `fcmToken`.
17. Background worker: BullMQ queue for batched/delayed sends.
18. Unit-tested `PushService.send` with mocked admin SDK.

**Razorpay (19–24):**
19. Install `razorpay`. Inject Razorpay client with `key_id`, `key_secret` from env.
20. Replace `maintenance.service.ts` order creation TODO with `razorpay.orders.create(...)`. Persist `razorpayOrderId` on `Payment`.
21. Implement HMAC-SHA256 signature verification: `crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(orderId+'|'+paymentId).digest('hex') === signature`.
22. Reject mismatched signatures with 400 + audit log.
23. Webhook endpoint `POST /webhooks/razorpay` with raw-body signature verify (using webhook secret).
24. Unit test verifying signature with known fixtures.

**Auth hardening (25–35):**
25. Install `otplib` (TOTP). Add `User.totpSecret` Bytes field migration (encrypted at rest — use P3's encryption helper).
26. `POST /auth/2fa/setup` (admin-only) returns provisioning URI + QR for Google Authenticator.
27. `POST /auth/2fa/verify` confirms 6-digit code, marks `User.totpEnabled`.
28. `POST /auth/login` for admin requires totp code if `totpEnabled`.
29. OTP rate limit: 10/min/phone via Throttler; 5 failed verifies = 15-min Redis lockout.
30. JWT refresh: rotate refresh on every use; persist new tokenId; old token added to Redis denylist with TTL = remaining lifetime.
31. JWT refresh: `POST /auth/refresh` reads denylist before issuing.
32. Session timeout: admin idle > 30 min ⇒ `/auth/me` returns 401 + force re-login (track `lastActiveAt` on user).
33. Logout: `POST /auth/logout` adds JWT to denylist immediately.
34. `POST /auth/delete` (right-to-delete) hooks into P3's compliance cascade.
35. Audit log every auth action via P3's audit middleware.

**Translate stub (36–38):**
36. Create `TranslateModule` with `POST /translate {text, target}` returning `{ translated: text }` pass-through (no real API yet).
37. Cache by hash in Redis 24h.
38. Wire in staff app `tasks/[id].tsx` (already calls this endpoint).

**Twilio/MSG91 abstraction (39–42):**
39. Create `SmsModule` with `SmsProvider` interface. Two impls: `MockSmsProvider` (logs only) + `Msg91Provider`.
40. OTP service uses `SmsProvider` (env: `SMS_PROVIDER=mock|msg91`).
41. Provider failover: Msg91 5xx falls back to log + warn.
42. Unit-tested OTP send.

**Final (43–50):**
43. Update `auth.module.ts` to register Throttler skip-list for OTP, 2FA setup paths.
44. Document new env vars in `.env.example` (including FIREBASE_SA_BASE64, RAZORPAY_KEY_*).
45. Webhook signature failures emit Sentry breadcrumb.
46. Add `/v1/auth/2fa/disable` for admin to remove 2FA after re-auth.
47. Add `RealtimeGateway.broadcast(predicate)` helper.
48. Run `pnpm tsc --noEmit` clean.
49. Leave registration note for P1: `EventsGateway`, `PushModule`, `TranslateModule`, `SmsModule` need import in `app.module.ts`.
50. Backwards-compat: keep old controller routes responding 200 — append, don't break.

### Agent P3 — DPDP, Multi-Tenancy, DB Hardening, Refactor (50)
**Owns:** `backend/prisma/schema.prisma`, `backend/src/common/{tenancy,audit,encryption,consent}/` (new), new `backend/src/modules/compliance/`, `backend/src/modules/staff/staff.service.ts` (legacy `user.sub as staffId` cleanup only)

**Multi-tenancy enforcement (1–8):**
1. Create `backend/src/common/tenancy/tenant.context.ts` — `AsyncLocalStorage<{ societyId, userId, role }>`.
2. Create `TenantMiddleware` extracting JWT and pushing tenant context.
3. Create Prisma client extension `tenant.extension.ts` — for every query on a tenant-scoped model, add `where: { societyId: ALS.societyId }` if missing.
4. Whitelist of cross-tenant models: `Society`, `User` (auth lookups), `AuditLog`.
5. Apply extension in `PrismaService.onModuleInit`.
6. Test: simulate query without `societyId` → ensure injected.
7. Test: simulate query with mismatched `societyId` → throw `ForbiddenException`.
8. Wire SUPER_ADMIN bypass via context flag.

**Audit log middleware (9–15):**
9. `AuditInterceptor` runs on all `@Patch | @Post | @Delete | @Put` routes for admin/staff users.
10. Captures `{ adminId, action: METHOD path, module: controller name, entityId: route param `id`, oldVal: pre-snapshot from service hook, newVal: response, at }`.
11. Writes to `audit_logs` table.
12. Skip-list: `/auth/*`, `/health`, `/readyz`, `/metrics`.
13. Service-level snapshot decorator `@AuditedUpdate` for entity diffs.
14. `GET /admin/audit-logs?entity=&adminId=&from=&to=` with pagination.
15. CSV export.

**Consent + DPDP (16–24):**
16. Onboarding: `POST /residents/onboard` writes `ConsentLog { action: 'ACCEPTED_TOS', details: { version, ts, ip } }`.
17. `POST /compliance/consent` (re-consent on policy change).
18. `POST /compliance/data-export` returns ZIP of all user data (residents + visitors + payments + complaints + appointments). Async via BullMQ; emails signed S3 link.
19. `POST /compliance/data-delete` hard-deletes user PII; cascades visitors → anonymised, complaints → `is_anonymous=true + residentId=null`. Audit trail preserved.
20. `GET /compliance/my-data` synchronous summary.
21. Retention cron (BullMQ scheduler): anonymise inactive accounts > 3 years.
22. PII redaction in logs (Pino redact: `*.phone`, `*.email`, `*.aadhaar`).
23. Privacy policy version stored in `Society.config.privacyPolicyVersion`.
24. Tests: ensure delete doesn't break audit trail.

**Encryption (25–28):**
25. `EncryptionService` using `crypto.createCipheriv('aes-256-gcm', key, iv)`. Key from `PII_ENCRYPTION_KEY` env (32 bytes hex).
26. Helpers `encrypt(plain)` / `decrypt(cipher)`. Cipher format: `{iv}.{tag}.{cipher}` base64.
27. Apply to fields: residents.aadhaar (new optional field), users.totpSecret.
28. Migration: re-encrypt any existing values (likely none in dev).

**DB indexes + perf (29–36):**
29. Schema review: ensure composite indexes on `(societyId, status)` for `service_requests`, `complaints`, `maintenance_bills`.
30. Composite index `(societyId, date)` on `staff_attendance`, `events`, `canteen_menus`.
31. Index `(staffId, date)` on `staff_attendance`.
32. Index `(residentId, status)` on `payments`.
33. Index `(noticeTargetType, societyId)` on `notices`.
34. Soft-delete columns (`deletedAt`) on residents/staff for retention without hard deletes.
35. Pagination defaults — `LIST_DEFAULT_LIMIT=50`, max 200.
36. Migration: `pnpm prisma migrate dev --create-only --name prod_indexes_and_audit`.

**Refactor (37–43):**
37. `staff.service.ts`: every existing method that takes `userId` and uses it as `staffId` now resolves via `staffMember.findUnique({ where: { userId } })`.
38. Fix `getSummary`, `getMyLeaves`, `getTodayAttendance`, `getAttendance`, `requestLeave` — correct staff resolution.
39. Backwards-compat: keep public method signatures unchanged.
40. Remove `emergencyContact Json?` from `Resident` and `TravelPause` (out-of-scope additions). Keep on `StaffMember` (BRD §4.7).
41. Migration removes the two unwanted columns.
42. Replace any remaining `as any` casts in staff.service with proper types.
43. Standardize service error throws to typed exceptions (`NotFoundException`, `ForbiddenException`).

**Compliance module wiring + final (44–50):**
44. Create `backend/src/modules/compliance/compliance.{module,controller,service}.ts`.
45. Routes: `POST /compliance/data-export`, `POST /compliance/data-delete`, `POST /compliance/consent`, `GET /compliance/my-data`.
46. Tests for delete cascade.
47. Tests for tenant extension enforcement.
48. `pnpm prisma format` then `pnpm prisma validate`.
49. `pnpm tsc --noEmit` clean.
50. Leave registration note for P1: `ComplianceModule`, `TenancyModule`, `AuditModule`, `EncryptionModule` need import.

### Agent P4 — Frontend Prod-Grade (50)
**Owns:** all `apps/*` files NOT in P5's scope (P5 only owns test/e2e dirs and CI workflow).

**staff-app — replace try-require fallbacks (1–10):**
1. `src/components/review/TrendChart.tsx` — replace `try-require('react-native-svg')` with real import (now installed).
2. `src/lib/socket.ts` — real `socket.io-client` import.
3. `app/community/training.tsx` — real `react-native-webview` + `expo-video` imports.
4. `app/tasks/photo-capture.tsx` — real `expo-camera`, `expo-location`, `expo-image-manipulator`, `react-native-view-shot`, `expo-file-system` imports.
5. `src/lib/geo.ts` — real `expo-location` import.
6. `src/lib/upload.ts` — real `expo-image-manipulator` + `expo-file-system` imports.
7. `app/(tabs)/attendance.tsx` — real `expo-location`, `expo-local-authentication` imports.
8. `app/(tabs)/tasks.tsx` — real `react-native-maps` import (or keep map fallback documented).
9. `app/_layout.tsx` — real `@react-native-community/netinfo`, persistence imports.
10. Remove now-dead TODO comments referencing missing deps.

**staff-app — error boundaries + Sentry (11–16):**
11. Install `@sentry/react-native` (root package.json edit). Run `pnpm install`.
12. Init Sentry in `app/_layout.tsx` with `SENTRY_DSN_STAFF` env.
13. Top-level `<ErrorBoundary>` wrapping `<Stack>` in `app/_layout.tsx`.
14. Friendly fallback UI: "Something went wrong" + retry + report.
15. Tag every Sentry event with `app: 'staff'`, `userId` if logged in.
16. Verify Sentry source-map upload script in `package.json`.

**staff-app — accessibility + UX polish (17–23):**
17. Add `accessibilityLabel` + `accessibilityRole` to all interactive primitives in tabs/{index,tasks,attendance,profile}.tsx (TouchableOpacity, Pressable).
18. `accessibilityHint` on icon-only buttons.
19. Audit minimum tap target (44×44pt) — add `hitSlop` where icons < 44pt.
20. Run `pnpm expo export --dump-sourcemap` to print bundle size; assert < 30MB total static.
21. Add `LoadingScreen` component standardized across all queries.
22. Standardize `EmptyState` component.
23. Dark mode: complete `tailwind.config.js` `darkMode: 'class'` token swap; honour `useSettingsStore.theme`.

**resident-app — Razorpay real integration (24–30):**
24. Install `react-native-razorpay`.
25. Replace demo alert in `apps/resident-app/app/maintenance/index.tsx` (~line 65) with `RazorpayCheckout.open(options)`.
26. Wire success → `POST /maintenance/verify-payment` (already exists, P2 implements signature verify).
27. Failure handling with retry CTA.
28. Receipt download from `paymentId` post-verify.
29. Auto-pay setup screen (read existing `/maintenance` endpoints).
30. End-to-end manual test against Razorpay test mode.

**resident-app — error boundaries + Sentry (31–34):**
31. Install Sentry RN (already at root).
32. Init in `app/_layout.tsx` with `SENTRY_DSN_RESIDENT`.
33. Top-level error boundary.
34. Tag `app: 'resident'`.

**admin-web — production polish (35–43):**
35. Install `@sentry/nextjs`. Init via `sentry.client.config.ts` and `sentry.server.config.ts`.
36. Add `next.config.ts` security headers (CSP, X-Frame-Options, Referrer-Policy).
37. Image optimisation: ensure `next/image` used (audit for raw `<img>`).
38. Add `_error.tsx` / global `error.tsx` for App Router error boundary.
39. Add 2FA prompt UI on login (calls P2's `/auth/2fa/verify`).
40. Add audit-log viewer page `app/audit/page.tsx` (calls P3's `/admin/audit-logs`).
41. Add data-export trigger in resident detail drawer.
42. Lighthouse: `next build` + run `lhci` script — target 90+ on perf/a11y/seo.
43. Add `<Toaster />` for unified notifications.

**Cross-app: implicit-any cleanup (44–48):**
44. resident-app `app/canteen/index.tsx` — type the `m`, `d`, `dish` params (12 errors).
45. resident-app `app/maintenance/index.tsx` + `pay.tsx` + `bills/[id].tsx` — type `b`, `bill`, `p`, `order`, `sum` (10 errors).
46. resident-app `app/medical/*` — type `doc`, `r`, `apt`, `slot`, `c` (15 errors).
47. resident-app `app/health/*` + `domestic-help/*` — type `med`, `dose`, `d`, `r`, `t`, `f`, `person`, `day` (16 errors).
48. resident-app `app/(tabs)/index.tsx`, `app/settings/notifications.tsx`, `app/travel/index.tsx` — type remaining (3 errors).

**Final (49–50):**
49. `pnpm tsc --noEmit` in all 3 apps — 0 real errors.
50. Document new env vars (`SENTRY_DSN_*`, `RAZORPAY_KEY_ID`) in each app's `.env.example`.

### Agent P5 — Tests + CI Hardening (50)
**Owns:** `backend/test/` (new), `apps/*/__tests__/` and `apps/*/e2e/` (replace scaffolds with runnable), `.github/workflows/`, root `package.json` test scripts, new `.husky/`.

**Backend integration tests (1–14):**
1. Install `@nestjs/testing` if missing; `supertest`; `vitest` or keep `jest` (project uses jest — keep).
2. Create `backend/test/setup.ts` — Postgres test DB, run migrations, truncate between tests.
3. Auth flow: `POST /auth/send-otp` → `POST /auth/verify-otp` → `GET /auth/me` returns user.
4. Rate-limit: 11 OTP requests in 1 min returns 429.
5. Resident onboarding: signup → admin approves → resident sees active state.
6. Visitor: pre-approve → QR scan endpoint → entry recorded.
7. Service request: create → assign → complete → rate flow.
8. Staff check-in: outside geofence rejected → inside accepted; late flag set.
9. Payment: create order → mock Razorpay verify → bill marked paid.
10. SOS: trigger emits to admin/gate rooms (mock Socket); ack records response time.
11. Complaint: create → admin assigns → resolve; rating recorded.
12. Multi-tenant: society A admin cannot read society B residents (returns []).
13. RBAC: STAFF cannot access `/admin/*` (403).
14. Right-to-delete: data anonymised, audit trail preserved.

**Backend unit tests (15–24):**
15. `staff.service` — leave balance calc correct (used vs total).
16. `staff.service` — geofence point-in-polygon edge cases.
17. `service-request.service` — SLA breach detection.
18. `auth.service` — JWT refresh rotation puts old in denylist.
19. `auth.service` — TOTP verify accepts current ±1 window.
20. `maintenance.service` — Razorpay signature verify rejects tampered payload.
21. `maintenance.service` — bill generation idempotent (running twice for same period skips).
22. `compliance.service` — data export includes all entity types.
23. `audit.interceptor` — captures correct old/new values on update.
24. `tenant.extension` — injects societyId into queries.

**admin-web Playwright (25–32):**
25. Install `@playwright/test` in admin-web devDeps. Run `pnpm install`.
26. `playwright.config.ts` with chromium + auth state.
27. Replace scaffolds with real assertions: `dashboard.spec.ts` — login → dashboard renders stat cards.
28. `complaints.spec.ts` — assign + status update → row reflects.
29. `events.spec.ts` — create event → appears in list.
30. `staff.spec.ts` — leave approval flow.
31. `finance.spec.ts` — bills list filters by status.
32. CI step: run Playwright in `playwright/test` Docker image with retries.

**staff-app + resident-app component tests (33–38):**
33. Install `@testing-library/react-native` + `jest-expo`.
34. Snapshot test top 5 staff-app screens (home/tasks/attendance/profile/leave).
35. Component test: `<TaskDetail>` status transitions invoke correct mutations.
36. Component test: `<RazorpayPay>` button calls SDK with correct order.
37. Snapshot: resident-app top 5 screens.
38. Hook tests: `useAuthStore` login/logout behaviour.

**CI enhancements (39–46):**
39. Add `pnpm audit --prod --audit-level high` step (allow-listed deps via `.audit-ci.json`).
40. Add CodeQL workflow `.github/workflows/codeql.yml` — JS/TS analysis.
41. Add `lighthouse-ci` for admin-web on PR with budget file.
42. Add `pnpm prisma migrate deploy --dry-run` validation step.
43. Add `playwright` job needing admin-web build artifact.
44. Add concurrency: `cancel-in-progress` per PR.
45. Add Slack notification on red main (optional — env-gated).
46. Cache `.turbo` between runs.

**Pre-commit + DX (47–50):**
47. Install `husky` + `lint-staged` at root.
48. `.husky/pre-commit` runs `pnpm lint-staged`.
49. `package.json` `lint-staged` config: `*.{ts,tsx}` → eslint --fix; `*.{json,md}` → prettier.
50. README: "Pre-launch checklist" copy of this doc's must-have rows.

---

## File-ownership conflict matrix

| File | Owner | Notes |
|---|---|---|
| `backend/src/main.ts` | P1 | only P1 |
| `backend/src/app.module.ts` | P1 | P1 finalises imports based on P2/P3 notes |
| `backend/prisma/schema.prisma` | P3 | only P3 |
| `backend/src/common/storage/*` | (read-only by all; already real) | — |
| `backend/src/common/realtime/*` | P2 | replaces stub |
| `backend/src/common/{filters,interceptors,middleware,health,logging,config}/` | P1 | — |
| `backend/src/common/{tenancy,audit,encryption,consent}/` | P3 | — |
| `backend/src/common/notification/` | P2 | new |
| `backend/src/modules/auth/*` | P2 | only P2 |
| `backend/src/modules/notification/*` | P2 | only P2 |
| `backend/src/modules/maintenance/*` | P2 | Razorpay only — don't refactor unrelated paths |
| `backend/src/modules/staff/staff.service.ts` | P3 | legacy `user.sub` cleanup only |
| `backend/src/modules/translate/*` | P2 | new |
| `backend/src/modules/compliance/*` | P3 | new |
| `backend/test/*` | P5 | only P5 |
| `apps/staff-app/*` | P4 | except `__tests__/`, `e2e/` |
| `apps/resident-app/*` | P4 | except `__tests__/`, `e2e/` |
| `apps/admin-web/*` | P4 | except `e2e/` |
| `apps/*/__tests__/`, `apps/*/e2e/` | P5 | — |
| `.github/workflows/*` | P5 | — |
| `.husky/*` | P5 | new |
| root `package.json` | shared (P4 + P5 may add deps) | use Edit (not Write); add lines, don't rewrite |

If a non-owner agent needs to touch an owned file, it MUST instead leave a registration note in its final summary; P1 collects and finalises.

---

## Corner Cases & Error Fallback Catalogue

> Every must-have agent must handle these — not as afterthoughts, but as first-class flows. Each row identifies the failure mode, expected behaviour, and the agent that owns the fix.

### Auth & Identity (P2 owns unless noted)
| # | Corner case | Expected fallback |
|---|---|---|
| A1 | OTP expired (>5 min) | 410 Gone with `code: OTP_EXPIRED`; UI offers re-send with cooldown |
| A2 | Wrong OTP entered 5× | Lock phone for 15 min; clear-text countdown in UI; admin override path |
| A3 | OTP send: SMS provider 5xx | Failover to secondary; if all fail, return 502 with `code: SMS_PROVIDER_DOWN`, prompt user to retry |
| A4 | OTP delivered but user closed app | Re-open prompt restores phone + masked code state from secure-store |
| A5 | Concurrent logins from 2 devices | Both succeed (multi-session); logout from device-list page revokes specific JWT |
| A6 | JWT clock skew (device clock wrong) | Server returns `code: TOKEN_SKEW`; client prompts "check device time" |
| A7 | Refresh token reused after rotation | Reject + revoke entire family + log security event |
| A8 | TOTP code with ±1 window for clock skew | Accept; outside window → 401 + audit |
| A9 | TOTP setup abandoned mid-flow | Server discards unverified secret after 10 min |
| A10 | User deleted account but old JWT still valid | All requests fail 401 `code: USER_REVOKED`; client clears state |

### Visitor & Gate (Backend visitor module + resident-app + staff scan QR)
| V1 | QR token expired | 410 with `code: QR_EXPIRED`; gate UI shows "Ask resident to re-share" |
| V2 | QR scanned twice (double entry) | Idempotent: second scan returns existing entry record, no new row |
| V3 | Resident denies after QR generated | Token immediately invalidated; gate sees "DENIED" badge |
| V4 | Visitor name has emoji/unicode | Allowed, normalised NFC, length ≤ 100 |
| V5 | Vehicle number malformed | Allow free-text but flag with `vehicleFormat: 'NON_STANDARD'` |
| V6 | Photo upload at gate fails | Entry recorded without photo; `photoSyncPending: true`; retry queue |
| V7 | Resident not reachable for approval | Gate falls back to security-PIN approval; logged with override reason |

### Service Requests / Tasks (P2 + P4)
| SR1 | Photo upload network drop mid-stream | Multipart resumable; if S3 SDK unavailable, fallback to presigned PUT with retry; persist locally on staff-app |
| SR2 | Status skipped (PENDING → COMPLETED) | Reject with 400 `code: INVALID_TRANSITION`; client refetches state |
| SR3 | Staff rejects after admin assigns | Allowed; status returns to `PENDING`, admin notified |
| SR4 | SLA expires while IN_PROGRESS | Auto-flag breach; admin notified; doesn't auto-close |
| SR5 | Resident rates after staff deactivated | Allowed; review attached to staff record (preserved for history) |
| SR6 | Multiple proof photos (>10) | Hard limit 10; UI rejects 11th with banner |
| SR7 | Translate API fails | Pass-through original text; no error to user; log warn |
| SR8 | Voice note interrupted by phone call | `expo-audio` onInterruption: pause + resume; persist partial recording |

### Payments / Maintenance (P2 + P4)
| P1 | Razorpay checkout timeout | Webhook still authoritative; client polls verify endpoint up to 30s; if no result, show "Payment status pending" |
| P2 | User triggers checkout twice | Idempotency key on order creation: `bill:{billId}:{userId}:{day}` |
| P3 | Verify endpoint signature mismatch | Reject; audit log with severity HIGH; alert ops; refund must be manual |
| P4 | Webhook arrives before client verify | First-write-wins on `Payment.status = SUCCESS`; second is no-op |
| P5 | Bill generation rerun for same period | Skip flats with existing bill; idempotent |
| P6 | Negative amount / currency tampered | Reject at DTO validation (class-validator @Min) |
| P7 | Auto-pay mandate revoked at gateway | Webhook handler updates `User.autopayStatus`; resident notified next session |
| P8 | Refund initiated by admin | New `Payment` row with negative amount; original bill stays paid; receipt PDF reflects both |

### SOS (P2 + P4)
| S1 | Accidental triple-tap | 5-sec countdown allows cancel; cancel records "FALSE_ALARM" — still logged |
| S2 | GPS unavailable (indoor) | Send last-known location with `locationStale: true`; UI badge |
| S3 | All admins offline | Push to all devices regardless; on reconnect, server replays via `since=` cursor |
| S4 | FCM token stale (`Unregistered`) | Server clears token; falls back to SMS via SmsProvider |
| S5 | Battery dies mid-alert | Service worker (where supported) attempts background ping; otherwise rely on initial broadcast |
| S6 | SOS resolved after device crash | Acknowledged-by recorded server-side; user sees state on next open |

### Attendance (P2 + P4)
| AT1 | GPS spoofed (mock-location enabled) | `Location.hasServicesEnabledAsync()` + Android `isMockLocation` check; reject with explanation |
| AT2 | On geofence boundary | Use 30m grace radius; log distance for audit |
| AT3 | DST / clock change mid-shift | Compute hours via UTC; persist tz offset |
| AT4 | Check-out before check-in (data corruption) | Server rejects 409; staff sees "previous session not closed" prompt |
| AT5 | Two devices same staff (double check-in) | Reject second with 409 `code: ALREADY_CHECKED_IN`; show original device |
| AT6 | Biometric hardware fails | Fallback to PIN; setting toggle remembers preference |
| AT7 | Selfie photo upload fails | Check-in still recorded; `selfiePending: true`; queue retry |

### Leave / Holidays (P3 backend + P4 frontend)
| L1 | Apply for past date | Reject 400 `code: PAST_DATE` |
| L2 | Overlapping with existing leave | Reject + show conflicting record |
| L3 | Insufficient balance | Reject + show available; UI suggests Privilege if Casual exhausted |
| L4 | Leave includes society holiday | Don't deduct holiday day from balance (inclusive holiday rule); UI shows "consumes 3 days (1 is holiday)" |
| L5 | Admin approves then staff cancels | Allowed if start_date > now; status WITHDRAWN |
| L6 | Leave balance becomes negative (admin override) | Allow with `forced: true` flag + audit |

### Reviews / Ratings (P2 + P4)
| R1 | Rate same task twice | Idempotent: update existing review |
| R2 | Auto-closed task (resident never rated) | After 7 days, system records "no-feedback" with neutral 0★ — excluded from average |
| R3 | All 1★ pattern (>3 in row from same resident) | Auto-flag for admin review; not auto-blocked |
| R4 | Profanity in comment | Server-side regex filter masks → `***`; original kept for admin audit |

### Community / Messaging (P2 + P4)
| M1 | Send to deleted group | 404; staff-app refreshes group list |
| M2 | Training video too large | S3 multipart; UI shows progress; max 500MB enforced |
| M3 | Recognition awarded to deleted staff | Recognition kept (history); UI shows "(former staff)" |
| M4 | Message offline → queued | offline-queue replays in order; conflict on send if message ID collides → server merges |
| M5 | Group has 0 members but admin sends | Allow (broadcast notice-style); recipients log empty |

### Property / Travel (P3 backend + resident-app)
| PT1 | Listing approved while owner edits | Server detects `If-Match` ETag mismatch → 409 conflict; UI offers reload |
| PT2 | Travel pause overlapping another | Reject 409 with offending ID |
| PT3 | Return date in past | Auto-mark COMPLETED on creation |
| PT4 | Buyer expresses interest after withdrawal | 410 Gone; UI removes listing |
| PT5 | Concurrent admin approves + owner withdraws | Last-write-wins; audit logs both |

### Push Notifications (P2)
| PN1 | Token invalid (TokenInvalidError) | Null out token; SMS fallback if critical (SOS) |
| PN2 | User opted out of category | `PushService` filters by `notificationPrefs[category]` |
| PN3 | Quiet hours (e.g. 22:00–07:00) | Non-critical notifications buffered; SOS bypasses |
| PN4 | Tap deeplink to deleted entity | Open app to fallback list view + toast "Item no longer available" |

### Network / Infrastructure (P1 + P4)
| N1 | DB connection pool exhausted | 503 with retry-after; circuit breaker opens for 30s |
| N2 | Redis unavailable | Cache reads pass-through to DB; cache writes silently skipped (logged) |
| N3 | S3 upload fails | Client retries 3× w/ exponential backoff; final fail → keep file in offline queue |
| N4 | Prisma transaction deadlock | Retry 2× with jitter; final fail → 500 + Sentry |
| N5 | Long transaction timeout (>10s) | Server kills tx; rollback; alert ops |
| N6 | Migration failed mid-deploy | Migration locks via `prisma migrate deploy`; pod doesn't accept traffic until ready |
| N7 | API behind proxy/NAT — wrong client IP | Trust X-Forwarded-For via `app.set('trust proxy')` |

### Frontend Offline (P4)
| O1 | Mutation triggered offline | offline-queue persists; replays on `NetInfo` online event |
| O2 | Server has newer version on resync | Server returns 409; client offers "Discard local / Keep mine" diff UI |
| O3 | Photo cache exceeds device quota | LRU eviction in `expo-file-system`; oldest queued photo dropped with warn |
| O4 | Token expired offline | Cache 401; on reconnect, force re-auth flow before draining queue |
| O5 | App update breaks queued payload schema | Version-stamp queue items; mismatched payloads dropped + reported |

### i18n / Locale (P4)
| I1 | String missing in selected locale | Fallback to English; Sentry breadcrumb (don't error) |
| I2 | Indian numbering (1,00,000) vs Western (100,000) | Use `Intl.NumberFormat` with `en-IN` locale |
| I3 | Date format per locale | `dayjs.format('LL')` with locale plugin; tz `Asia/Kolkata` default |
| I4 | RTL not in scope | Document explicitly in i18n.ts |

### Multi-Tenancy / RBAC (P3 owns)
| MT1 | Admin from society A queries society B | Tenant extension throws ForbiddenException + audit security event |
| MT2 | Staff tries to access /admin/* | 403 `code: INSUFFICIENT_ROLE` |
| MT3 | Resident tries to view another resident's data | 403; only own + public society data |
| MT4 | Super-admin switching tenants mid-session | Explicit `X-Society-Id` header; require re-auth confirmation |

### Audit & Compliance (P3)
| C1 | Right-to-delete with active SOS / open complaint | Allowed; SOS log retains anonymised lat/lng; complaint anonymised |
| C2 | Data export request DOS attempt (10×/day) | Throttle 1/hour/user |
| C3 | Audit log too large to query | Cursor pagination + date partitioning |
| C4 | Consent revoked mid-session | Force logout + show consent renewal screen on next open |

---

## Error envelope shape (all 4xx/5xx, P1 implements)

```jsonc
{
  "data": null,
  "meta": { "requestId": "01J...uuid", "timestamp": "2026-04-30T12:00:00Z" },
  "error": {
    "code": "OTP_EXPIRED",            // machine-readable, SCREAMING_SNAKE
    "message": "Your code has expired. Please request a new one.",  // user-safe
    "details": { /* optional debug */ },
    "field": "otp",                   // optional, for form-validation errors
    "retryAfter": 30                  // optional, for rate-limit / cooldowns
  }
}
```

Error codes are stable contracts — never renamed. New codes added freely.

---

## Done = Production-Ready when

- All 🔴 must-have rows checked off
- `pnpm tsc --noEmit` clean across all packages
- `pnpm test` passes with > 70% statement coverage on critical backend services
- CI green on `main` for 3 consecutive runs
- `pnpm audit` 0 high+critical CVEs
- Penetration test scheduled (manual, out of scope here)
- Razorpay business onboarding KYC submitted (out of code scope)

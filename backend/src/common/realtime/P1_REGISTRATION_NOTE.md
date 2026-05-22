# P2 → P1 Registration Note

The following modules are NEW and need to be imported in `app.module.ts`.
P2 owns these modules; P1 owns `app.module.ts` wiring.

## New imports for app.module.ts

```ts
import { PushModule } from './common/notification/push.module';
import { SmsModule } from './common/sms/sms.module';
import { TranslateModule } from './modules/translate/translate.module';
```

Append to the `imports: []` list:

- `SmsModule`     (global; backs OTP + push SMS-fallback)
- `PushModule`    (global; depends on SmsModule)
- `TranslateModule`

`RealtimeModule` is already imported and now also exports the new
`EventsGateway` (Socket.io with JWT handshake auth on `/events` namespace).
No additional registration needed for it.

## Raw-body capture for Razorpay webhook

The route `POST /maintenance/webhook` requires `req.rawBody` to verify the
HMAC signature. Ensure `main.ts` uses:

```ts
const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
```

(or equivalent body-parser config that preserves the raw buffer for
`/maintenance/webhook` and any other webhook routes).

## Sentry breadcrumb for webhook signature failures

Inside `MaintenanceService.handleRazorpayWebhook` and the controller fallback,
signature mismatches throw `BadRequestException({ code: 'INVALID_SIGNATURE' })`.
P1's exception filter / Sentry init should capture this as a breadcrumb /
HIGH-severity event. No further action required from P2.

## SOS cancel endpoint

`POST /v1/sos/:id/cancel` is registered and delegates to `SosService.flagFalseAlarm`
(same as `PATCH .../false-alarm`). Clients may use either verb.

**Resident cancel:** only while status is `ACTIVE`, within `SOS_CANCEL_WINDOW_MS` (default **5000** ms), and only for alerts they triggered (`residentId` = JWT `sub`).

**Admin / super-admin / staff:** may mark false alarm while status is `ACTIVE` or `ACKNOWLEDGED` (no time window).

**Idempotency:** if already `FALSE_ALARM` or `RESOLVED`, returns the existing row (no error).

## Auth shape changes (clients)

- `/auth/verify-otp` now returns `{ token, accessToken, refreshToken, user }`.
Old `token` field preserved for backwards compat.
- `/auth/refresh` now expects `{ refreshToken }` in body (legacy bearer header
fallback retained).
- New endpoints: `/auth/logout`, `/auth/delete`, `/auth/2fa/{setup,verify,disable}`.

## Error codes introduced (P2)

`OTP_EXPIRED` (410), `OTP_LOCKED` (403), `OTP_RATE_LIMITED` (429),
`SMS_PROVIDER_DOWN` (502), `TOKEN_EXPIRED`, `TOKEN_SKEW`, `TOKEN_REVOKED`,
`USER_REVOKED`, `INVALID_REFRESH`, `REFRESH_REVOKED`, `REFRESH_REUSE_DETECTED`,
`SESSION_TIMEOUT`, `2FA_ADMIN_ONLY`, `2FA_ALREADY_ENABLED`, `2FA_SETUP_EXPIRED`,
`2FA_INVALID_CODE`, `INVALID_SIGNATURE`, `WEBHOOK_NOT_CONFIGURED`.

P1's global exception filter should preserve the `code` field on response.
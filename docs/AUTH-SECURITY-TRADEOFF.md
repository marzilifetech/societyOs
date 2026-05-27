# Auth security tradeoff — Marzi-pass-through tokens

**Date:** 2026-05-27
**Status:** Accepted, with monitoring follow-ups.
**Owner:** Platform team.

## Decision

When `OTP_PROVIDER=marzi`, the SocietyOS backend stops minting its own JWT pair
and instead passes Marzi-issued tokens straight through:

- `POST /auth/verify-otp` → proxies to `https://dev.marzitech.in/v1/auth/verify-otp`,
  returns the Marzi pair (`accessToken`, `refreshToken`) to the client unchanged.
- `POST /auth/refresh` → proxies to `https://dev.marzitech.in/v1/auth/refresh`
  with the client's refresh token as `Authorization: Bearer …`, returns the
  new Marzi pair unchanged.
- Every API call validates the access-token signature using `JWT_SECRET`.

For this to work, **`JWT_SECRET` MUST equal Marzi's signing secret** so
`JwtStrategy` can verify Marzi-signed access tokens. The existing
`tid → societyId` mapping in `JwtStrategy.validate` continues to translate
Marzi's tenant claim into our scoping key.

## Why we did this

1. **30-day refresh window.** Marzi's refresh tokens live for 30 days; our
   local rotation TTL was equivalent but tied to Redis being available.
   Marzi is now the authority on session validity.
2. **Single identity source.** Mobile and web users authenticate through
   Marzi anyway (OTP delivery + verification). Owning the token lifecycle
   here was duplicate state with no win.
3. **Implementation simplicity.** Removes ~150 lines of refresh-rotation,
   denylist, and family-tombstone code from the hot path — replaced by a
   single `POST` to Marzi and a local user-status check.

## What we lose (and live with)

| Capability                                                            | Before                                                                                  | After                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local revocation** of a single user (kick now, regardless of Marzi) | Yes — `revokeFamily(fid)` writes a Redis tombstone, denying the family on next refresh. | Partial — we still flip `User.status` to SUSPENDED, and `JwtStrategy.validate` rejects on every request. But the user's _access token_ is valid for its full TTL (24h with Marzi) until we expire it from the denylist or `User.status` changes propagate. |
| **JWT denylist** for individual jtis                                  | Yes — `denylist:{jti}` in Redis.                                                        | Still applied for incoming bearers; works exactly as before.                                                                                                                                                                                               |
| **Race-window grace + tombstone** on refresh                          | Yes — built into local `rotateRefresh`.                                                 | N/A — Marzi handles rotation; we do not see the race.                                                                                                                                                                                                      |
| **JWT-secret isolation** between us and Marzi                         | Yes — different secrets.                                                                | **No** — secret is shared. A compromise of Marzi's secret compromises our backend's ability to verify tokens.                                                                                                                                              |
| **Survive Marzi outage for an existing session**                      | Yes — local refresh kept sessions alive.                                                | Refresh requires Marzi. If Marzi is down, access tokens still work for their full TTL but cannot be refreshed.                                                                                                                                             |

The user-facing impact of these tradeoffs is small: the typical session
flow (open app, work, refresh in background) works identically. The edge
cases bite during a Marzi incident — bounded by the 24-hour access TTL.

## Mitigations in place

1. `JwtStrategy.validate` still checks `User.status` on every request — a
   `SUSPENDED` user is rejected immediately regardless of what Marzi
   thinks. Same gate for `Society.status` (SUSPENDED/ARCHIVED → reject).
2. Every privileged action emits an audit-log entry (society suspend,
   staff transfer, bill status change, etc.).
3. Tenant middleware still requires fresh-login-window OR reauth token
   for SUPER_ADMIN tenant switches — the access token alone is not
   enough to switch societies.
4. `OTP_PROVIDER=local` remains a working fallback for tests, CI, and
   the rare deploy that needs to operate without Marzi. The local
   `TokenService.rotateRefresh` path with full grace-window + tombstone
   logic is preserved unchanged.

## Required env config

For environments running `OTP_PROVIDER=marzi`:

```bash
# Must equal Marzi's HS256 signing secret. Both backends share it so JWTs
# minted on either side verify cleanly on the other.
JWT_SECRET=<obtain-from-marzi-platform-team>

# Marzi base URL. dev = dev.marzitech.in, prod = prod.marzitech.in.
MARZI_AUTH_BASE_URL=https://dev.marzitech.in

# Marzi tenant slug. Determines which Marzi tenant the OTP flow targets.
MARZI_TENANT_NAME=Marzi

OTP_PROVIDER=marzi
```

## Monitoring follow-ups (TODO)

- [ ] Sentry alert: spike in `MARZI_AUTH_UNREACHABLE` errors → Marzi is down.
- [ ] Sentry alert: any `MARZI_RESPONSE_MALFORMED` → shape drift from Marzi.
- [ ] Rotation cadence for the shared `JWT_SECRET`. Today: ad-hoc. Goal:
      quarterly rotation with overlap window.
- [ ] Plan B: if Marzi outage > 1 hour, document the manual switch to
      `OTP_PROVIDER=local` so existing sessions can keep refreshing locally.

## References

- [`backend/src/modules/auth/marzi-auth.client.ts`](../backend/src/modules/auth/marzi-auth.client.ts) — Marzi client (`verifyOtp`, `refresh`).
- [`backend/src/modules/auth/auth.service.ts`](../backend/src/modules/auth/auth.service.ts) — `refreshTokenViaMarzi`, `refreshTokenLocal`.
- [`backend/src/modules/auth/strategies/jwt.strategy.ts`](../backend/src/modules/auth/strategies/jwt.strategy.ts) — `tid → societyId` mapping at line 32–35.
- [POSTMAN.json](../backend/POSTMAN.json) — Marzi `/v1/auth/refresh` contract.

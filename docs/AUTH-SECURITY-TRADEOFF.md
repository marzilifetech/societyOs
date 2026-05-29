# Auth security tradeoff — Marzi-backed refresh (hybrid)

**Date:** 2026-05-27
**Status:** Accepted, with monitoring follow-ups.
**Owner:** Platform team.

## Decision

When `OTP_PROVIDER=marzi`, the SocietyOS backend runs a **hybrid** auth flow:

1. **Client always sees LOCAL tokens** — `accessToken` and `refreshToken` minted
   by `TokenService` with our `JWT_SECRET`. Apps and admin-web do not know
   Marzi exists at the token layer.
2. **Marzi is the per-refresh authority** — on every `POST /auth/refresh`, the
   backend exchanges the user's Marzi refresh token (stored server-side in
   Redis at `marzi:refresh:{userId}` with a 30-day TTL) for a fresh Marzi pair.
   If Marzi rejects (account revoked / suspended at the identity provider),
   we refuse the refresh and the user is signed out.
3. **Local rotation flow is preserved** — `TokenService.rotateRefresh` still
   runs: grace-window for the reuse race, Redis tombstone on `revokeFamily`,
   denylist for individual jtis, all unchanged.

In short: the client experience is identical to the local-only flow. Marzi
is invoked behind the scenes on each refresh as a "is this session still
allowed?" check.

## Why we did this

1. **30-day Marzi-controlled session.** Mobile/web users authenticate through
   Marzi via OTP; Marzi now owns the right to revoke that session at any
   time. We honour that revocation on the next refresh.
2. **No shared `JWT_SECRET`.** Earlier pass-through designs required us to
   sign tokens with Marzi's secret — coupling we did not want. The hybrid
   keeps `JWT_SECRET` independent.
3. **Apps and admin-web require zero changes.** Tokens look exactly the
   same as before. The shared `@societyos/api-client` refresh flow works
   unchanged. JwtStrategy works unchanged.
4. **Graceful migration.** Sessions minted _before_ `OTP_PROVIDER=marzi`
   was enabled (no Marzi refresh stored) still refresh successfully — they
   take a local-only path with a one-line log entry. No mass force-logout
   at the operator flip.

## What we trade away (and live with)

| Capability                            | Local-only mode             | Hybrid mode                                                                                                                                |
| ------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Survive a Marzi outage**            | Yes — fully self-contained. | Refresh requires Marzi reachability. Access tokens stay valid for their TTL (15 min). After that, refreshes 503 until Marzi recovers.      |
| **Local-only revocation**             | Yes.                        | Yes — `User.status=SUSPENDED` still blocks all API calls at `JwtStrategy.validate`. The refresh path also still hits the User.status gate. |
| **Marzi-side revocation propagates**  | N/A.                        | Yes — next refresh fails, user is signed out.                                                                                              |
| **`JWT_SECRET` rotation independent** | Yes.                        | Yes (still our secret only).                                                                                                               |
| **Per-refresh round trip to Marzi**   | No.                         | Yes (~80 ms typical). Bounded by access-token TTL: only happens on refresh, ~once per 15 min per active user.                              |
| **Race-window grace + tombstone**     | Yes.                        | Yes — unchanged.                                                                                                                           |

The user-facing impact is essentially zero. The only failure mode is during
a Marzi outage: existing sessions continue working until their access token
expires, then refreshes start failing until Marzi recovers.

## Reauth fresh-login window

`REAUTH_FRESH_WINDOW_SECONDS` (default **24h**) controls how recently the
bearer JWT must have been minted for a SUPER_ADMIN tenant switch to skip
the explicit reauth modal. Beyond this window the user must POST
`/auth/reauth` to mint a one-shot `X-ReAuth-Token`.

The 24h default is deliberate for marzi-mode: every refresh re-validates
the session against Marzi server-side, so a valid local bearer is itself
proof of recent strong auth. Forcing a second OTP every 5 minutes for
legitimate SUPER_ADMIN flows was friction without security gain.

For high-risk environments (staging mirror of prod, security review
mode), tighten to `REAUTH_FRESH_WINDOW_SECONDS=300` (5 min) to require
reauth more aggressively.

## Mitigations in place

1. `JwtStrategy.validate` still checks `User.status` and `Society.status`
   on every authed request — local revocation is immediate.
2. Marzi 5xx errors during refresh bubble up as 503 to the client; the
   shared api-client's existing transient-failure retry logic (3 attempts,
   400/1200 ms backoff) handles short Marzi blips invisibly to the user.
3. Marzi 4xx (the user has genuinely been revoked at Marzi) translates to
   `USER_REVOKED` and a hard sign-out. The stale Marzi token is dropped
   from Redis so we don't keep retrying.
4. Missing-Marzi-refresh users get a local-only rotation with a log entry —
   ensures no flip-day surprises.
5. `OTP_PROVIDER=local` remains a clean fallback for tests, CI, and the
   rare deploy that runs without Marzi. The local `TokenService` rotation
   path with grace-window + tombstone logic is unchanged.

## Required env config

```bash
# Independent of Marzi. Set per environment as usual.
JWT_SECRET=<your-secret>

# Marzi base URL. dev = dev.marzitech.in, prod = prod.marzitech.in.
MARZI_AUTH_BASE_URL=https://dev.marzitech.in
MARZI_TENANT_NAME=Marzi

OTP_PROVIDER=marzi
```

Apps need no changes — they continue to read `accessToken`/`refreshToken`
from `/auth/verify-otp` and `/auth/refresh` as before.

## Monitoring follow-ups (TODO)

- [ ] Sentry alert: spike in `MARZI_AUTH_UNREACHABLE` 503s → Marzi is down.
- [ ] Sentry alert: any `MARZI_RESPONSE_MALFORMED` → shape drift from Marzi.
- [ ] Metric: ratio of refresh calls hitting the legacy "no stored Marzi
      refresh" branch — once this approaches 0, drop the legacy fallback.
- [x] ~~Marzi-mode SOS notifications must route to channel `sos`~~ — done
      in push.service.ts: critical / category=sos / data.type=SOS_TRIGGERED
      payloads now ride `android.notification.channelId: "sos"` and
      iOS `interruption-level: critical`.

## References

- [`backend/src/modules/auth/marzi-auth.client.ts`](../backend/src/modules/auth/marzi-auth.client.ts) — Marzi client (`verifyOtp`, `refresh`, `normalisePair`).
- [`backend/src/modules/auth/auth.service.ts`](../backend/src/modules/auth/auth.service.ts) — `verifyOtp` captures Marzi refresh into Redis; `refreshTokenViaMarzi` exchanges via Marzi and rotates locally.
- [`backend/src/modules/auth/strategies/jwt.strategy.ts`](../backend/src/modules/auth/strategies/jwt.strategy.ts) — unchanged; validates LOCAL tokens.
- [POSTMAN.json](../backend/POSTMAN.json) — Marzi `/v1/auth/refresh` contract.

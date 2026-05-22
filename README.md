# SocietyOS

Multi-tenant society management platform — three apps on one backend.

| App                 | Stack                                              | Audience                   |
| ------------------- | -------------------------------------------------- | -------------------------- |
| `backend`           | NestJS 10 · Prisma 6 · PostgreSQL · Redis · BullMQ | API, websockets, jobs      |
| `apps/admin-web`    | Next.js 15 · Tailwind · React Query                | RWA committee / managers   |
| `apps/resident-app` | Expo SDK 52 · React Native · Nativewind            | Residents (iOS/Android)    |
| `apps/staff-app`    | Expo SDK 52 · React Native · Nativewind            | Security/maintenance staff |

Shared TypeScript packages live under `packages/` (api-client, ui, theme, config).

---

## Quick start

```bash
git clone https://github.com/utkarshparcel/marzi-redesign.git
cd marzi-redesign
./dev.sh
```

That single command, on a fresh checkout:

1. Detects your OS (macOS or Linux) and installs missing tools — Homebrew, Node 20 (via nvm), pnpm, qrencode, plus PostgreSQL + Redis (Docker if available, else native packages).
2. Copies every `.env.example` to `.env` / `.env.local`.
3. Generates the Prisma client, runs migrations, seeds the database (idempotent).
4. Resolves free ports for backend (3000), admin-web (3001), staff-app (8081), resident-app (8082) — shifting forward if any are taken — and patches every `.env` file so the apps are mutually consistent.
5. Starts everything with prefixed, colored logs and (on macOS with Xcode) auto-opens both Expo apps in iOS Simulators.

When it's ready you'll see a status board and QR codes. Press **Ctrl-C** to stop everything (databases too, in Docker mode; Homebrew/systemd services are left running).

### Flags

| Flag              | Purpose                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--no-expo`       | Skip the two Expo apps (faster; web-only stack)                                                                                                                  |
| `--skip-migrate`  | Don't run `prisma migrate deploy`                                                                                                                                |
| `--skip-seed`     | Don't run `pnpm db:seed`                                                                                                                                         |
| `--no-install`    | Don't run `pnpm install`                                                                                                                                         |
| `--reset`         | **Destructive** — drop the schema, re-migrate, re-seed                                                                                                           |
| `--bootstrap-ios` | One-time: build + install both Expo dev clients onto iOS Simulators (5–10 min, then exits). Run this once on a fresh machine before the first regular `./dev.sh` |
| `--help`          | Print this list                                                                                                                                                  |

`CLEAR=1 ./dev.sh` forces an Expo Metro cache reset (useful when nativewind/CSS changes don't appear).

---

## Prerequisites

`dev.sh` will install most things itself. If you'd rather set up by hand:

### Required

- **Node.js ≥ 20**
- **pnpm ≥ 10** (`npm i -g pnpm`)
- **PostgreSQL 16** + **Redis 7** — either via Docker or native install

### Recommended

- **Docker Desktop** — simplest path for postgres + redis
- **Xcode + iOS Simulator** (macOS only) — auto-opens the Expo apps
- **Expo Go** on your phone (App Store / Play Store) — scan the QR codes if you don't have a simulator

### OS support

| OS                        | Tested | Notes                                                      |
| ------------------------- | ------ | ---------------------------------------------------------- |
| macOS 14+ (Apple Silicon) | ✅     | full automation incl. simulators                           |
| macOS 14+ (Intel)         | ✅     | full automation incl. simulators                           |
| Ubuntu 22.04 / Debian 12  | ✅     | apt-based install path; Expo via QR + phone                |
| Fedora 40                 | ✅     | dnf-based install path                                     |
| Arch Linux                | ✅     | pacman-based install path                                  |
| Windows                   | ⚠️     | use **WSL2** with Ubuntu — native Windows is not supported |

---

## Login credentials (after seed)

| Role     | Phone             | OTP (dev mode) |
| -------- | ----------------- | -------------- |
| Admin    | `+91 90000 00001` | `123456`       |
| Resident | `+91 91000 00001` | `123456`       |
| Staff    | `+91 92000 00001` | `123456`       |

In `NODE_ENV=development` the OTP is bypassed — any phone number that exists in the seed accepts `123456`. In production a real SMS provider (MSG91) is required; the backend refuses to start in production with `SMS_PROVIDER=mock`.

Society ID is fixed in seed: `a1b2c3d4-e5f6-4789-abcd-ef0123456789`.

---

## URLs (default ports)

| Service       | URL                                    |
| ------------- | -------------------------------------- |
| Backend API   | http://localhost:3000/v1               |
| Swagger docs  | http://localhost:3000/api              |
| Admin web     | http://localhost:3001                  |
| Staff Expo    | `exp://<LAN-IP>:8081` (QR in terminal) |
| Resident Expo | `exp://<LAN-IP>:8082` (QR in terminal) |
| PostgreSQL    | `localhost:5432` (db: `societyos`)     |
| Redis         | `localhost:6379`                       |

`dev.sh` will shift ports forward if any are busy — and patches every `.env` to match.

---

## Manual setup (if you don't want to use dev.sh)

### 1. Start PostgreSQL + Redis

```bash
docker compose up -d postgres
docker run -d --name marzi-redis -p 6379:6379 redis:7-alpine
```

Or with native packages (macOS):

```bash
brew services start postgresql@16 redis
createdb societyos
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up env files

```bash
cp backend/.env.example          backend/.env
cp apps/admin-web/.env.example   apps/admin-web/.env.local
cp apps/resident-app/.env.example apps/resident-app/.env
cp apps/staff-app/.env.example   apps/staff-app/.env
```

Edit `backend/.env` if your `DATABASE_URL` differs.

### 4. Prisma setup

```bash
cd backend
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
```

### 5. Run apps

From the repo root:

```bash
pnpm dev   # turbo runs every package's `dev` script
```

Or one at a time:

```bash
# backend
cd backend && pnpm run dev

# admin-web
cd apps/admin-web && pnpm run dev

# resident-app (Expo)
cd apps/resident-app && pnpm run start

# staff-app (Expo)
cd apps/staff-app && pnpm run start
```

---

## Common workflows

### Reset the database to seed state

```bash
./dev.sh --reset
```

Equivalent to `prisma migrate reset --force && prisma db seed`.

### Add a Prisma migration

```bash
cd backend
pnpm exec prisma migrate dev --name describe-the-change
```

### Run tests

```bash
# Everything
pnpm test

# One package
cd backend          && pnpm test
cd packages/api-client && pnpm test
cd apps/resident-app && pnpm test
```

### Typecheck

```bash
# Per package
cd backend           && pnpm exec tsc --noEmit
cd apps/admin-web    && pnpm typecheck
cd apps/resident-app && pnpm exec tsc --noEmit
```

### Generate a fresh OTP for a phone

In dev mode the OTP is always `123456`. To change a seeded user's phone, edit `backend/prisma/seed.ts` and re-run `./dev.sh --reset`.

---

## Architecture notes

- **Multi-tenant isolation.** Every per-society query is scoped through a Prisma extension (`backend/src/common/tenancy/tenant.extension.ts`) that auto-injects `societyId` for direct-tenant models. `Resident` is scoped indirectly via `user.societyId` / `flat.societyId` and excluded from auto-injection.
- **JWT rotation.** Short-lived access tokens (15 m) + long-lived refresh tokens (30 d) with family revocation on reuse. The mobile clients auto-refresh on `401 TOKEN_EXPIRED` via a single in-flight promise. See `packages/api-client/src/client.ts`.
- **Webhooks.** Razorpay webhook is at `POST /v1/maintenance/webhook` (raw-body mounted in `main.ts` on that path + `/v1/webhooks/razorpay` for dashboard convenience). HMAC-SHA256 verified against `RAZORPAY_WEBHOOK_SECRET`.
- **OTP / SMS.** `OtpService` returns `123456` in dev. In production it sends via `SmsService` → `Msg91Provider`; backend refuses to boot if `SMS_PROVIDER` is unset / `mock`.
- **Realtime.** Socket.io gateway with optional Redis adapter (`SOCKET_IO_REDIS_ADAPTER=true`).
- **Throttling.** `@nestjs/throttler` with composite IP+phone tracker on auth routes. Dev limits are 10× higher than prod (see `backend/.env`).

---

## Troubleshooting

### "PrismaClient validation error" / `Unknown argument 'societyId'`

Run `pnpm exec prisma generate` in `backend/`. The client gets out of sync after schema edits if `node_modules` already exists (postinstall hook only runs on fresh installs).

### Port 3000 / 3001 already in use

`dev.sh` auto-shifts to the next free port and patches `.env` files. If you bypassed `dev.sh`, free the port or set `PORT=` manually in `backend/.env`.

### Expo app shows "Network request failed"

Phone-to-laptop traffic must use the LAN IP, not `localhost`. `dev.sh` writes the right `EXPO_PUBLIC_API_URL` automatically. If you started Expo manually, edit `apps/resident-app/.env` (or `staff-app/.env`):

```
EXPO_PUBLIC_API_URL=http://192.168.X.X:3000/v1
```

…and ensure the laptop firewall allows inbound on that port.

### "Welcome to Expo" screen instead of the app

The dev client isn't installed on this simulator yet. One-time:

```bash
cd apps/resident-app && pnpm ios
# or
cd apps/staff-app && pnpm ios
```

Subsequent boots will use the dev client automatically.

### Pre-commit hook fails on a fresh clone

`prettier-plugin-tailwindcss` may be missing. Run `pnpm install -w` from the repo root.

### Backend silently logs OTPs in dev (no SMS)

Expected. `NODE_ENV=development` uses `MockSmsProvider` and the OTP is hard-coded to `123456`.

### Docker daemon not running on macOS

`dev.sh` will try to launch Docker Desktop. If that fails it falls back to `brew services` postgres + redis automatically.

---

## Repository layout

```
marzi-redesign/
├── backend/                  # NestJS 10 API
│   ├── prisma/               # schema + seed
│   └── src/
│       ├── common/           # tenancy, audit, sentry, throttler, sms
│       └── modules/          # one module per domain
├── apps/
│   ├── admin-web/            # Next.js 15 admin dashboard
│   │   └── src/app/(authed)/ # all authed routes share one Sidebar layout
│   ├── resident-app/         # Expo + expo-router (residents)
│   └── staff-app/            # Expo + expo-router (staff)
├── packages/
│   ├── api-client/           # shared fetch client w/ refresh-token rotation
│   ├── theme/                # design tokens
│   ├── ui/                   # cross-app primitives
│   └── config/               # tsconfig + eslint presets
├── dev.sh                    # one-shot dev launcher (this file)
├── docker-compose.yml        # postgres only — redis runs as a one-off container
└── turbo.json                # workspace task pipeline
```

---

## License

Private — all rights reserved.
# societyOS
# societyOs

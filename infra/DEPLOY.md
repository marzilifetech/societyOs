# SocietyOS — End-to-End Deployment Guide

How to deploy and operate SocietyOS in the **dev/staging** environment on the
Marzi AWS account (`ap-south-1`).

> First-time setup (Terraform apply, DB bootstrap, Amplify) lives in
> **[infra/README.md](README.md)**. This doc is for the **day-to-day**
> deploy/operate workflow once the stack is up.

---

## 1. What's where

```
                    Route 53  (marzitech.in)
                          │
   society-dev.marzitech.in ─────► Lightsail Instance 43.204.82.22 (Ubuntu VPS)
                                     ├─ Caddy   :443  → auto-HTTPS (Let's Encrypt)
                                     ├─ backend :3000 (NestJS)
                                     └─ redis   :6379
                                          │  VPC peering
                                          ▼
                                   marzi-community-db  (private RDS)
                                     └─ database: societyos_dev

   society-admin-dev.marzitech.in ──► AWS Amplify  (Next.js, apps/admin-web)
   uploads ──────────────────────────► S3 societyos-dev-uploads
   runtime config ───────────────────► Secrets Manager  societyos/dev
```

### URLs

| What                        | URL                                          |
| --------------------------- | -------------------------------------------- |
| Backend API                 | `https://society-dev.marzitech.in/v1`        |
| Health probe                | `https://society-dev.marzitech.in/v1/health` |
| Admin web (custom domain)   | `https://society-admin-dev.marzitech.in`     |
| Admin web (Amplify default) | `https://main.demjupsqzi02t.amplifyapp.com`  |

### AWS account / region

- Profile: **`marzi`** · Account: `904233100956` · Region: **`ap-south-1`** (Mumbai)
- Every CLI command and Terraform run uses `--profile marzi --region ap-south-1`.

---

## 2. Backend — redeploy after code changes

Run from your machine. Requirements: AWS CLI with the `marzi` profile, `rsync`,
Python 3, and the SSH key Terraform generated at
`infra/terraform/societyos-dev.pem`.

```bash
cd /path/to/marzi-redesign
bash infra/instance/deploy.sh
```

**What it does, step by step:**

1. **Fetch** the `societyos/dev` secret from AWS Secrets Manager → writes
   `infra/instance/backend.env` locally (auto-deleted at the end).
2. **Rsync** your local source to `ubuntu@43.204.82.22:/opt/societyos/repo/`
   (excludes `node_modules`, `.git`, `dist`, `.next`, `.expo`, `.turbo`).
3. **SCP** the compose files (`docker-compose.yml`, `Caddyfile`, `backend.env`,
   `bootstrap-db.sh`) to `/opt/societyos/`.
4. **SSH** in → `docker compose build backend` (rebuilds the image from the new
   source — ~5–8 min on the small_3_1 instance).
5. **SSH** in → `docker compose run --rm backend pnpm exec prisma db push` (syncs
   the Prisma schema to `societyos_dev` — see §6 for caveats).
6. **SSH** in → `docker compose up -d` (recreates the `backend` container with
   the new image; `redis` and `caddy` stay running unless touched).

Total time: **~8–12 min** end-to-end. The first 30s of the new backend
container is its NestJS bootstrap (Prisma connects, BullMQ ready, routes
mapped) — Caddy reverse-proxies it once it answers on `:3000`.

### Verify the redeploy

```bash
curl https://society-dev.marzitech.in/v1/health
# expect:  {"data":{"status":"ok"}, ...}
```

If `/health` doesn't come back within ~60s, see §10 (logs).

---

## 3. Admin web — auto-deploy via Amplify

You don't run anything manually. **Every push to `main` on
`marzilifetech/societyOs`** triggers an Amplify build automatically.

```
Local change → git push origin main
                    │
                    ▼
              Amplify webhook
                    │
                    ▼
          Amplify build (~5–10 min)
            ├─ pnpm install --frozen-lockfile --filter @societyos/admin-web...
            ├─ next build (output: standalone)
            └─ deploy to Amplify SSR compute
                    │
                    ▼
       https://society-admin-dev.marzitech.in  (live ~30s after build)
```

### Watching a build

```bash
# latest 3 jobs:
aws amplify list-jobs --app-id demjupsqzi02t --branch-name main \
  --region ap-south-1 --profile marzi --max-items 3 \
  --query 'jobSummaries[].{job:jobId,status:status,commit:commitMessage}'

# fetch a build log:
aws amplify get-job --app-id demjupsqzi02t --branch-name main --job-id <N> \
  --region ap-south-1 --profile marzi \
  --query 'job.steps[?stepName==`BUILD`].logUrl' --output text \
  | xargs curl -s | tail -50
```

Or just open the Amplify console for the `societyOs` app.

### Required config in this repo (already in place)

| File                            | Purpose                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| `amplify.yml`                   | Build spec — installs pnpm, `--filter @societyos/admin-web...` (avoids OOM) |
| `apps/admin-web/next.config.ts` | `output: 'standalone'` + `outputFileTracingRoot`                            |
| `.npmrc`                        | `node-linker=hoisted` (flat node_modules so Amplify finds runtime deps)     |

Don't change any of these without testing — together they took 7 build
iterations to get right.

---

## 4. Mobile apps (Expo)

Local emulator testing — both `apps/resident-app/.env` and `apps/staff-app/.env`
already point at the deployed backend (`https://society-dev.marzitech.in/v1`).

```bash
cd apps/resident-app          # or apps/staff-app
pnpm dev                      # = expo start
# then press  i  (iOS sim)  or  a  (Android emulator)
```

> Production builds (EAS) for the mobile apps aren't configured for SocietyOS
> yet — `eas.json` still points at placeholder domains. Configure those when
> you're ready to ship to TestFlight / Play Store.

---

## 5. Login / accounts

OTP is **delegated** to the external Marzi backend (`dev.marzitech.in`) —
backed by `OTP_PROVIDER=marzi` + `MARZI_AUTH_BASE_URL` in the
`societyos/dev` secret.

When anyone logs in:

```
admin-web / mobile  ─►  SocietyOS backend  ─►  dev.marzitech.in  ─►  real OTP SMS
                            │                                          to that phone
                            ▼
                  matches local users.phone+societyId
                            │
                            ▼
                  mints SocietyOS-local JWT
```

- Login requires the user row to exist locally in `societyos_dev` (phone +
  societyId pair). New phones auto-create as `RESIDENT`/`PENDING`.
- Currently provisioned super-admin: **`+919936142128`**.

To promote another phone:

```sql
-- run on marzi-community-db, database societyos_dev, as societyos_dev_app
INSERT INTO users (id, phone, name, role, status, "societyId", "updatedAt")
VALUES (gen_random_uuid(), '+91XXXXXXXXXX', 'Name', 'SUPER_ADMIN', 'ACTIVE',
        'a1b2c3d4-e5f6-4789-abcd-ef0123456789', now())
ON CONFLICT (phone, "societyId") DO UPDATE
  SET role='SUPER_ADMIN', status='ACTIVE', "updatedAt"=now();
```

---

## 6. Database schema changes

Right now `infra/instance/deploy.sh` syncs the schema with **`prisma db push`**
— good enough for dev/staging. **Do not use this for production**: it can drop
columns without warning. For real prod, switch to:

```bash
pnpm exec prisma migrate dev --name <description>   # locally — generates a migration SQL
git add prisma/migrations && git commit && git push
# update deploy.sh to use `prisma migrate deploy` instead of `db push`
```

> ⚠️ The current Prisma migrations folder doesn't have a clean baseline (the
> first migration assumes tables already exist). Before moving to
> `migrate deploy`, squash a clean `0_init` baseline from the current schema.

---

## 7. Logs & monitoring

### Backend (Lightsail instance)

```bash
KEY=infra/terraform/societyos-dev.pem
IP=43.204.82.22
SSHOPTS="-o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -i $KEY"

# tail backend logs
ssh $SSHOPTS ubuntu@$IP 'cd /opt/societyos && docker compose logs -f backend'

# all containers
ssh $SSHOPTS ubuntu@$IP 'cd /opt/societyos && docker compose ps'

# Caddy access log
ssh $SSHOPTS ubuntu@$IP 'cd /opt/societyos && docker compose logs -f caddy'
```

### Admin web (Amplify)

Amplify console → `societyOs` app → `main` branch → click any build → view the
**Build log** and **Deploy log**. Runtime SSR logs are in
**CloudWatch / Amplify hosting logs** (linked from the same page).

### Database

```bash
# Sessions/queries (using the master postgres on marzi-community-db):
ssh $SSHOPTS ubuntu@$IP \
  'docker run --rm -e PGPASSWORD=*** postgres:16-alpine \
     psql -h marzi-community-db.cdk0iqyk2cg4.ap-south-1.rds.amazonaws.com \
     -U postgres -d societyos_dev \
     -c "SELECT pid, query FROM pg_stat_activity WHERE datname=current_database();"'
```

---

## 8. Rollback

### Backend

The previous container image is still on the instance until a `docker system
prune`. To roll back:

```bash
ssh $SSHOPTS ubuntu@$IP 'cd /opt/societyos && docker compose down backend \
  && docker images societyos-backend && docker compose up -d backend'
# manually retag a previous image as :dev if needed
```

For a safer approach: keep the previous git commit handy, `git checkout`
locally, and re-run `deploy.sh` — it'll rsync the old code and rebuild.

### Admin web (Amplify)

Amplify console → app → branch → click any **previous successful build** →
**Redeploy this version**.

---

## 9. Updating the AWS infrastructure

The whole AWS stack is Terraform-managed under `infra/terraform/`. Whenever
you change anything there:

```bash
cd infra/terraform
terraform plan      # review what'll change
terraform apply     # type 'yes' to confirm
```

### Common updates

- **CORS origins / env vars** — edit `secrets.tf` (the `secret_string` JSON) →
  `terraform apply` → re-run `deploy.sh` so the backend container picks up the
  new env.
- **Instance size** — bump `lightsail_bundle_id` in `variables.tf` or
  `terraform.tfvars` → `terraform apply` (recreates the instance — note: the
  static IP re-attaches via `replace_triggered_by`, but cloud-init runs again
  and Docker images need rebuilding via `deploy.sh`).
- **Domain / DNS** — `dns.tf`.
- **Amplify env vars** — set in the console OR via
  `aws amplify update-app --environment-variables KEY=VAL,...`. Terraform
  doesn't currently manage the Amplify app (it's console-managed because the
  fine-grained token couldn't create webhooks — see `infra/README.md` step 4).

---

## 10. Common issues

| Symptom                                     | Likely cause                                  | Fix                                                                               |
| ------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| `502 Bad Gateway` from `/v1/health`         | backend container restarting/crashed          | `docker compose logs backend`                                                     |
| Admin-web shows CORS error on API call      | stale JWT (token from old localhost backend)  | clear `localStorage.auth-storage`, re-login                                       |
| Login `400 TENANT_NOT_FOUND`                | wrong `MARZI_TENANT_NAME` in the secret       | edit `secrets.tf` → `terraform apply` → `deploy.sh`                               |
| Backend can't reach DB                      | VPC peering broken / RDS SG                   | check `aws lightsail is-vpc-peered`, RDS inbound rules                            |
| Amplify build OOMs                          | the `--filter` got removed from `amplify.yml` | restore it; full-workspace install OOMs                                           |
| `prettier --write [ENOENT]` on `git commit` | local pnpm install is broken (hoisted SemVer) | `git commit --no-verify` for now; `rm -rf node_modules && pnpm install` to repair |

---

## 11. Costs (approximate, monthly)

|                                       | $/mo                     |
| ------------------------------------- | ------------------------ |
| Lightsail instance `small_3_1`        | ~12                      |
| Static IP (attached)                  | 0                        |
| VPC peering                           | 0                        |
| Secrets Manager (1 secret)            | ~0.40                    |
| RDS — new database in shared instance | ~0                       |
| S3 `societyos-dev-uploads`            | <1                       |
| Amplify (admin-web, low traffic)      | ~3–7                     |
| Route 53 records                      | ~0 (zone already exists) |
| **Total**                             | **≈ $16–20/mo**          |

---

## 12. File map

```
infra/
├── README.md           ← first-time setup runbook
├── DEPLOY.md           ← this file (day-to-day operations)
├── amplify-buildspec.yml  (reference; the live one is /amplify.yml)
├── terraform/          ← AWS stack (Lightsail, networking, secrets, DNS)
│   ├── main.tf · variables.tf · data.tf · secrets.tf · dns.tf · outputs.tf
│   ├── terraform.tfvars        (gitignored; the GitHub token + overrides)
│   ├── terraform.tfvars.example
│   └── societyos-dev.pem       (gitignored; SSH key Terraform generated)
└── instance/
    ├── cloud-init.sh           ← runs once on instance first boot
    ├── docker-compose.yml      ← backend + redis + caddy
    ├── Caddyfile               ← auto-HTTPS reverse proxy
    ├── bootstrap-db.sh         ← one-off DB bootstrap (idempotent)
    └── deploy.sh               ← the script you actually run for redeploys
```

---

## 13. Outstanding follow-ups (not blocking)

- 🔴 RDS security group `sg-090f155839606c807` allows `0.0.0.0/0` on `5432` —
  tighten before going to real production (the instance is private so it's not
  exposed today, but the SG is shared with `marzi-community-prod`).
- Confirm `MARZI_TENANT_NAME` value is correct (currently `"Marzi"`).
- Squash a clean Prisma migration baseline before adopting `migrate deploy`.
- Resolve the encryption-key env-name + encoding mismatch
  (`ENCRYPTION_KEY` vs `PII_ENCRYPTION_KEY`) before storing real PII.
- Local `node_modules` is in a broken state from the `node-linker=hoisted`
  relayout (`prettier` missing) — `rm -rf node_modules && pnpm install` should
  repair it.

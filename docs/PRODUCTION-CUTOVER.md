# Production Cutover Runbook

Promoting the `society-dev.marzitech.in` environment to production: switch login
to the Marzi prod auth API, wipe the DB, seed one root Super Admin, deploy the
backend + admin panel, and publish the apps.

> ⚠️ Several steps are **irreversible** (DB wipe) and run against **live AWS
> infrastructure**. Take a backup first. These run from an operator machine that
> has the AWS `marzi` profile and the SSH key — not from CI.

### Discovered infra values (fill-ins for the commands below)

```
INSTANCE   ubuntu@43.204.82.22          (Lightsail: societyos-dev-backend)
SECRET     societyos/dev                (AWS Secrets Manager, region ap-south-1)
PEM        marzi-lightsail-key.pem      (in mig/secrets/ssh-pem-keys/ — confirm this is the one)
ROOT ADMIN phone 9936142128  email tech@marzi.life  name "Marzi Admin"
LOGIN      MARZI_AUTH_BASE_URL=https://prod.marzitech.in   NODE_ENV=production
```

> Terraform state is LOCAL and lives on your original deploy machine — do NOT
> `terraform init`/`apply` from a fresh checkout (it would try to create
> duplicate infra). The commands below use the discovered values directly and
> don't need Terraform.

---

## 1. Backend env — update AWS Secrets Manager (source of truth)

`deploy.sh` fetches the backend `.env` from AWS Secrets Manager on every deploy,
so change the **secret**, not any local file. Set/confirm these keys:

```
NODE_ENV=production
OTP_PROVIDER=marzi
MARZI_AUTH_BASE_URL=https://prod.marzitech.in     # NO /v1 suffix — client appends it
MARZI_TENANT_NAME=Marzi                            # must match the tenant on prod.marzitech.in
```

```bash
# View the secret name:
terraform -chdir=infra/terraform output -raw config_secret_name
# Edit it (AWS console → Secrets Manager → that secret → Retrieve/Edit),
# or via CLI (merge — don't overwrite the whole JSON):
aws secretsmanager get-secret-value --secret-id <SECRET> --profile marzi \
  --region ap-south-1 --query SecretString --output text > /tmp/secret.json
# edit /tmp/secret.json to set the 4 keys above, then:
aws secretsmanager put-secret-value --secret-id <SECRET> --profile marzi \
  --region ap-south-1 --secret-string file:///tmp/secret.json
rm /tmp/secret.json
```

## 2. Deploy the backend

From THIS machine (no Terraform state needed — discovers infra via AWS CLI):

```bash
cd infra/instance
./deploy-local.sh    # discover IP + secret → rsync → docker build → prisma db push → restart
```

(If SSH auth fails, the Lightsail key may be a different file — retry with
`DEPLOY_KEY=~/Documents/mig/secrets/ssh-pem-keys/marzi-ec2-key.pem ./deploy-local.sh`.)

Or from your ORIGINAL machine that has terraform.tfstate: `./deploy.sh`.
Wait ~30s for Caddy TLS, then confirm the API is up:

```bash
curl -s https://society-dev.marzitech.in/v1/health   # or your health route
```

### Just changed the secret and only need the backend to pick it up?

You don't need a full rebuild — refresh the env and restart. **Do NOT** do
`aws ... > backend.env` by hand (if the AWS CLI can't auth on the box, `>`
truncates backend.env to the error text and takes the backend down → 502), and
**do NOT** `sed` URLs in place (a pattern like `dev.marzitech.in` also matches
`society-dev`/`society-admin-dev` and will corrupt CORS_ORIGINS). Use the safe,
atomic helper instead — it validates before it ever touches the live file:

```bash
# ON the box:
cd /opt/societyos && bash /opt/societyos/repo/infra/instance/refresh-env.sh
```

It writes to a temp file, checks it has DATABASE_URL + ≥10 keys, backs up the
current file, swaps atomically, and recreates the backend container. If AWS
isn't usable on the box it stops without touching backend.env.

## 3. Wipe the DB + seed ONE root Super Admin (⚠️ irreversible)

This project deploys with `prisma db push` (not migrations), so wipe with
`db push --force-reset` (drops all data, re-creates schema from schema.prisma).

```bash
IP=$(terraform -chdir=infra/terraform output -raw instance_public_ip)
ssh -i infra/terraform/societyos-dev.pem ubuntu@$IP

cd /opt/societyos

# 3a) BACKUP FIRST (from inside the db container / via DATABASE_URL)
docker compose exec -T backend sh -lc 'pg_dump "$DATABASE_URL"' \
  > ~/backup-before-prod-$(date +%F).sql

# 3b) WIPE — drops everything, recreates empty schema
docker compose run --rm backend pnpm exec prisma db push --force-reset --accept-data-loss

# 3c) SEED the single root Super Admin (put YOUR details here)
docker compose run --rm \
  -e ROOT_ADMIN_PHONE=98XXXXXXXX \
  -e ROOT_ADMIN_NAME="Your Name" \
  -e ROOT_ADMIN_EMAIL="you@yourdomain.com" \
  backend pnpm exec ts-node prisma/seed-production.ts
```

Seed script: `backend/prisma/seed-production.ts` — creates only the Platform
society + one SUPER_ADMIN. It refuses to run on a non-empty DB unless `FORCE=1`.

## 4. Deploy the admin panel (AWS Amplify)

Amplify auto-builds on push to the connected branch. Two things:

- **Env var:** in Amplify Console → App settings → Environment variables, set
  `NEXT_PUBLIC_API_URL=https://society-dev.marzitech.in/v1` (and
  `NEXT_PUBLIC_SENTRY_DSN_ADMIN` if used).
- **Trigger a build:** push the connected branch, or Amplify Console →
  "Redeploy this version". (Note: pushing `marzilifetech/societyOs` needs write
  access to that org repo.)

Root admin logs in at the admin panel with the phone from step 3c → SMS OTP.

## 5. Publish the apps (already built, point at society-dev = prod)

No app changes needed — both already talk to `society-dev.marzitech.in`.

| App             | Package              | AAB to upload                                                                      |
| --------------- | -------------------- | ---------------------------------------------------------------------------------- |
| Resident (user) | `com.marzi.resident` | `apps/resident-app/android/app/build/outputs/bundle/release/app-release.aab` (vc7) |
| Staff           | `com.marzi.staff`    | `apps/staff-app/android/app/build/outputs/bundle/release/app-release.aab` (vc4)    |

Staff also has `app/build/outputs/mapping/release/mapping.txt` (upload as the
deobfuscation file). Keystore for both: the Marzi upload key (SHA1 DC:56:E1:CE…).

---

## Verify after cutover

- [ ] Backend `/health` returns OK on society-dev
- [ ] Login from the resident app with a real number → SMS OTP arrives → logs in
- [ ] Admin panel: root Super Admin logs in, can create a society + a society admin
- [ ] DB has exactly 1 user (the root admin) + 1 Platform society
- [ ] No dev/demo residents/staff remain

## Rollback

- Restore the DB from `~/backup-before-prod-*.sql`:
  `docker compose exec -T backend sh -lc 'psql "$DATABASE_URL"' < backup-…​.sql`
- Revert the Secrets Manager keys and re-run `./deploy.sh`.

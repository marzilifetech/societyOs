# SocietyOS — dev/staging deployment

Infrastructure-as-code for the SocietyOS dev/staging environment on the **Marzi
AWS account** (`ap-south-1`).

```
                    Route 53  (marzitech.in)
                          │
   society-dev.marzitech.in ─────► Lightsail Instance (Ubuntu VPS)
                                     ├─ Caddy   :443  → auto-HTTPS
                                     ├─ backend :3000 (NestJS)
                                     └─ redis   :6379
                                          │  VPC peering
                                          ▼
                                   marzi-community-db  (private RDS)
                                     └─ database: societyos_dev

   society-admin-dev.marzitech.in ──► AWS Amplify  (Next.js admin-web)
   uploads ──────────────────────────► S3  societyos-dev-uploads
   runtime config ───────────────────► Secrets Manager  societyos/dev
```

Everything new is tagged `Project=societyos, Environment=dev`. Nothing existing
is modified — the only additive touches are a new database inside the shared
RDS and new records in the existing Route 53 zone.

---

## Layout

```
infra/
├── terraform/        # the AWS stack (Lightsail, networking, secrets, DNS)
└── instance/         # what runs ON the VPS
    ├── cloud-init.sh       # first-boot: installs Docker
    ├── docker-compose.yml  # backend + redis + caddy
    ├── Caddyfile           # auto-HTTPS reverse proxy
    ├── bootstrap-db.sh     # one-off: create societyos_dev DB + role
    └── deploy.sh           # operator deploy script
```

## Prerequisites (operator machine)

- `terraform` ≥ 1.6, `aws` CLI with the **`marzi`** profile, `rsync`, `python3`.
- A clone of this repo.

---

## Step 1 — Provision the AWS stack

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # adjust sizing if you like
terraform init
terraform apply
```

This creates: the Lightsail instance + static IP + firewall, the SSH key
(`societyos-dev.pem`, written locally), Lightsail↔VPC peering, the
`societyos/dev` secret (with generated DB + JWT credentials), and the
`society-dev.marzitech.in` DNS record.

**What's happening behind the scenes:** Terraform generates every credential,
tags every resource, and prints the instance IP. The instance boots and
`cloud-init.sh` installs Docker (~2 min).

## Step 2 — First-time DB bootstrap (once)

Creates the `societyos_dev` database + scoped role inside `marzi-community-db`.
Run it **from the instance** (it can reach the private RDS):

```bash
cd infra
IP=$(terraform -chdir=terraform output -raw instance_public_ip)
KEY=terraform/societyos-dev.pem

# Copy the bootstrap script up
scp -i $KEY instance/bootstrap-db.sh ubuntu@$IP:/tmp/

# Get the generated app-role password from the secret
APP_PW=$(aws secretsmanager get-secret-value --secret-id societyos/dev \
  --profile marzi --region ap-south-1 --query SecretString --output text \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_URL"].split(":")[2].split("@")[0])')

# Run it — paste the RDS master password when prompted (never stored)
ssh -i $KEY ubuntu@$IP "RDS_HOST=marzi-community-db.cdk0iqyk2cg4.ap-south-1.rds.amazonaws.com \
  RDS_MASTER_PASSWORD='<paste master password>' APP_DB_PASSWORD='$APP_PW' \
  ENVIRONMENT=dev bash /tmp/bootstrap-db.sh"
```

## Step 3 — Deploy the backend

```bash
cd infra/instance
./deploy.sh
```

Syncs the source, builds the image on the instance, runs `prisma db push` to
create the 78 tables, and starts the stack. Caddy fetches a TLS certificate
within ~30 s. Then seed once:

```bash
ssh -i ../terraform/societyos-dev.pem ubuntu@$IP \
  'cd /opt/societyos && docker compose run --rm backend pnpm exec prisma db seed'
```

## Step 4 — Admin web on Amplify (AWS Console)

Done in the console — the AWS Amplify GitHub App handles the repo connection and
webhooks itself, so no Personal Access Token is needed:

1. AWS Console → **Amplify** → **Create new app** → **GitHub** → authorize the
   **AWS Amplify GitHub App**.
2. Pick repo **`marzilifetech/societyOs`**, branch **`main`**.
3. Monorepo: set **app root** to `apps/admin-web`. Amplify autodetects Next.js;
   build command `pnpm run build`.
4. Environment variables:
   - `NEXT_PUBLIC_API_URL` = `https://society-dev.marzitech.in/v1`
   - `NEXT_PUBLIC_SOCIETY_ID` = `a1b2c3d4-e5f6-4789-abcd-ef0123456789`
5. **Save and deploy.**
6. **Hosting → Custom domains → Add domain** → `society-admin-dev.marzitech.in`
   — Amplify creates the Route 53 records + TLS automatically (~10–20 min).

Every push to `main` then rebuilds and redeploys the admin app automatically.

---

## Verify

```bash
curl https://society-dev.marzitech.in/v1/health      # → {"status":"ok"}
```

Then open `https://society-admin-dev.marzitech.in`.

## Redeploy (day-to-day)

```bash
cd infra/instance && ./deploy.sh    # backend
# admin-web redeploys itself on every push to main (Amplify)
```

## Teardown

```bash
cd infra/terraform && terraform destroy
```

Removes everything tagged — **except** the S3 bucket and the `societyos_dev`
database (both referenced read-only, so your data survives). Drop the database
manually if you truly want it gone.

## Cost (approximate, ap-south-1)

| Item                             | $/mo            |
| -------------------------------- | --------------- |
| Lightsail instance `small_3_0`   | ~12             |
| Static IP (attached)             | 0               |
| VPC peering                      | 0               |
| Secrets Manager (1 secret)       | ~0.40           |
| RDS (shared — new database only) | ~0              |
| S3 `societyos-dev-uploads`       | <1              |
| Amplify (admin-web, low traffic) | ~3–7            |
| **Total**                        | **≈ $16–20/mo** |

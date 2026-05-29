#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  SocietyOS deploy — run from YOUR machine.
#  Requires: the AWS 'marzi' profile, rsync, and the SSH key Terraform created.
#
#  Syncs source → builds the image → applies the schema → (re)starts the stack.
#  FIRST TIME ONLY: run the DB bootstrap once beforehand — see infra/README.md §5.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

REGION=ap-south-1
PROFILE=marzi
TF=../terraform

IP=$(terraform -chdir="$TF" output -raw instance_public_ip)
SECRET=$(terraform -chdir="$TF" output -raw config_secret_name)
KEY="$TF/societyos-dev.pem"
SSHOPT=(-i "$KEY" -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o ConnectTimeout=20)

echo "→ [1/5] Fetching $SECRET → backend.env"
aws secretsmanager get-secret-value --secret-id "$SECRET" \
    --profile "$PROFILE" --region "$REGION" --query SecretString --output text \
  | python3 -c 'import json,sys; [print(f"{k}={v}") for k,v in json.load(sys.stdin).items()]' \
  > backend.env

echo "→ [2/5] Syncing source to $IP"
rsync -az --delete -e "ssh ${SSHOPT[*]}" \
  --exclude node_modules --exclude .git --exclude dist \
  --exclude .next --exclude .expo --exclude .turbo \
  ../../ "ubuntu@$IP:/opt/societyos/repo/"

echo "→ [3/5] Copying compose files"
scp "${SSHOPT[@]}" docker-compose.yml Caddyfile backend.env bootstrap-db.sh \
  "ubuntu@$IP:/opt/societyos/"

echo "→ [4/5] Building image"
ssh "${SSHOPT[@]}" "ubuntu@$IP" 'cd /opt/societyos && docker compose build backend'

echo "→ [5/5] Applying schema + starting"
# --accept-data-loss is fine for dev/staging (seed data is disposable). Replace
# with `prisma migrate deploy` once a clean migration baseline is in place —
# see infra/DEPLOY.md §6.
ssh "${SSHOPT[@]}" "ubuntu@$IP" \
  'cd /opt/societyos && docker compose run --rm backend pnpm exec prisma db push --accept-data-loss && docker compose up -d'

rm -f backend.env   # don't leave secrets on the operator's disk
echo "✓ Deployed → https://society-dev.marzitech.in   (allow Caddy ~30s for the TLS cert)"

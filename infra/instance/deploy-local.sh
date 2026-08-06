#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  SocietyOS deploy — TERRAFORM-FREE variant.
#
#  Use this when running from a machine that does NOT have the local
#  terraform.tfstate (e.g. a fresh laptop). Instead of `terraform output`, it
#  discovers the instance IP and reuses the known Secrets Manager secret via the
#  AWS CLI. Same result as deploy.sh: sync → build → schema → restart.
#
#  Requires: AWS 'marzi' profile, rsync, and the Lightsail SSH key.
#  Does NOT run terraform (so it can't accidentally create duplicate infra).
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

export AWS_PROFILE="${AWS_PROFILE:-marzi}"
REGION="${AWS_REGION:-ap-south-1}"
INSTANCE_NAME="${INSTANCE_NAME:-societyos-dev-backend}"
SECRET="${CONFIG_SECRET:-societyos/dev}"
KEY="${DEPLOY_KEY:-$HOME/Documents/mig/secrets/ssh-pem-keys/marzi-lightsail-key.pem}"

# --- preflight ---------------------------------------------------------------
command -v rsync >/dev/null || { echo "rsync not found"; exit 1; }
[ -f "$KEY" ] || { echo "SSH key not found: $KEY  (set DEPLOY_KEY=/path/to/key.pem)"; exit 1; }
chmod 600 "$KEY" 2>/dev/null || true
aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null \
  || { echo "AWS profile '$AWS_PROFILE' not usable"; exit 1; }

IP=$(aws lightsail get-instances --region "$REGION" \
  --query "instances[?name=='${INSTANCE_NAME}'].publicIpAddress | [0]" --output text)
[ -n "$IP" ] && [ "$IP" != "None" ] || { echo "Could not resolve IP for $INSTANCE_NAME"; exit 1; }

SSHOPT=(-i "$KEY" -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o ConnectTimeout=20)
echo "→ target: ubuntu@$IP   secret: $SECRET"

echo "→ [1/5] Fetching $SECRET → backend.env"
aws secretsmanager get-secret-value --secret-id "$SECRET" \
    --profile "$AWS_PROFILE" --region "$REGION" --query SecretString --output text \
  | python3 -c 'import json,sys; [print(f"{k}={v}") for k,v in json.load(sys.stdin).items()]' \
  > backend.env

echo "→ [2/5] Syncing source to $IP"
# The backend build only needs repo SOURCE, not the mobile app native/build
# output (apps/*/android|ios and any build/.gradle dirs are multi-GB and
# irrelevant to the backend). Excluding them keeps this transfer to a few MB.
# Keystores/APKs/AABs are excluded too — no signing material belongs on the box.
rsync -az --delete -e "ssh ${SSHOPT[*]}" \
  --exclude node_modules --exclude .git --exclude dist \
  --exclude .next --exclude .expo --exclude .turbo \
  --exclude 'apps/*/android' --exclude 'apps/*/ios' \
  --exclude 'build' --exclude '.gradle' \
  --exclude '*.apk' --exclude '*.aab' --exclude '*.jks' --exclude '*.keystore' \
  --exclude 'screenshot' \
  ../../ "ubuntu@$IP:/opt/societyos/repo/"

echo "→ [3/5] Copying compose files"
scp "${SSHOPT[@]}" docker-compose.yml Caddyfile backend.env bootstrap-db.sh \
  "ubuntu@$IP:/opt/societyos/"

echo "→ [4/5] Building image"
ssh "${SSHOPT[@]}" "ubuntu@$IP" 'cd /opt/societyos && docker compose build backend'

echo "→ [5/5] Applying schema + starting"
ssh "${SSHOPT[@]}" "ubuntu@$IP" \
  'cd /opt/societyos && docker compose run --rm backend pnpm exec prisma db push --accept-data-loss && docker compose up -d'

rm -f backend.env   # don't leave secrets on disk
echo "✓ Deployed → https://society-dev.marzitech.in   (allow Caddy ~30s for TLS)"

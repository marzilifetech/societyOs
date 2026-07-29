#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Safely refresh /opt/societyos/backend.env from AWS Secrets Manager and
#  restart the backend — run this ON the box.
#
#  Why this exists: doing `aws ... > backend.env` directly is dangerous — if the
#  AWS CLI isn't usable on the box, the `>` still truncates backend.env to the
#  error text, wiping DATABASE_URL/JWT_SECRET/etc. and taking the backend down
#  (502). Editing with a broad `sed` is equally risky (a pattern like
#  `dev.marzitech.in` also matches `society-dev`/`society-admin-dev`).
#
#  This script writes to a TEMP file, validates it looks like a real env
#  (has DATABASE_URL and enough keys), backs up the current file, then swaps
#  atomically. If anything is off, it leaves backend.env untouched.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd /opt/societyos

REGION="${AWS_REGION:-ap-south-1}"
SECRET="${CONFIG_SECRET:-societyos/dev}"
TMP="backend.env.new"
MIN_KEYS=10

echo "→ Checking AWS access on this box…"
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "✗ AWS CLI cannot authenticate on this box. Not touching backend.env."
  echo "  (Fix AWS creds/role here, or push backend.env from the operator machine.)"
  exit 1
fi

echo "→ Fetching $SECRET → $TMP (temp, not live yet)"
aws secretsmanager get-secret-value --secret-id "$SECRET" --region "$REGION" \
    --query SecretString --output text \
  | python3 -c 'import json,sys; [print(f"{k}={v}") for k,v in json.load(sys.stdin).items()]' \
  > "$TMP"

# Validate before we ever replace the live file.
if ! grep -q '^DATABASE_URL=' "$TMP"; then
  echo "✗ Fetched env has no DATABASE_URL — refusing to apply. Keeping current file."
  rm -f "$TMP"; exit 1
fi
LINES=$(wc -l < "$TMP" | tr -d ' ')
if [ "$LINES" -lt "$MIN_KEYS" ]; then
  echo "✗ Fetched env has only $LINES keys (< $MIN_KEYS) — looks wrong. Keeping current file."
  rm -f "$TMP"; exit 1
fi

cp backend.env "backend.env.bak.$(date +%s)" 2>/dev/null || true
mv "$TMP" backend.env
echo "✓ backend.env restored ($LINES keys). Routing keys:"
grep -E '^(CORS_ORIGINS|MARZI_AUTH_BASE_URL)=' backend.env || true

echo "→ Recreating backend container"
sudo docker compose up -d --force-recreate backend
echo "✓ Done. Give it ~10s, then curl the health route."

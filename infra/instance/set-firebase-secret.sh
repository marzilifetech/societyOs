#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
#  Merge FIREBASE_SA_BASE64 into the societyos/<env> Secrets Manager secret from
#  a local Firebase service-account JSON, then recreate the backend container so
#  it picks up the new env. push.service reads FIREBASE_SA_BASE64 to enable FCM.
#
#  ⚠️ Terraform owns the secret_string, but does NOT manage this Firebase key
#  (so the private key never lands in git). Re-run this AFTER any
#  `terraform apply` that rewrites the societyos/<env> secret, or after rotating
#  the Firebase key.
#
#  Usage:  bash infra/instance/set-firebase-secret.sh <path-to-service-account.json>
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail
SA_JSON="${1:?usage: set-firebase-secret.sh <path-to-firebase-service-account.json>}"
REGION=ap-south-1
PROFILE=marzi
SID=societyos/dev
cd "$(dirname "$0")"
TF=../terraform
IP=$(terraform -chdir="$TF" output -raw instance_public_ip)
KEY="$TF/societyos-dev.pem"
SSHOPT=(-i "$KEY" -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o ConnectTimeout=20)

echo "→ merging FIREBASE_SA_BASE64 into $SID"
B64=$(base64 -i "$SA_JSON" | tr -d '\n')
aws secretsmanager get-secret-value --secret-id "$SID" --profile "$PROFILE" --region "$REGION" \
  --query SecretString --output text > /tmp/_sec.json
B64="$B64" python3 -c 'import json,os; d=json.load(open("/tmp/_sec.json")); d["FIREBASE_SA_BASE64"]=os.environ["B64"]; json.dump(d, open("/tmp/_sec_new.json","w"))'
aws secretsmanager put-secret-value --secret-id "$SID" --profile "$PROFILE" --region "$REGION" \
  --secret-string file:///tmp/_sec_new.json --query VersionId --output text | sed 's/^/  new version: /'

echo "→ refreshing backend container env"
python3 -c 'import json;[print(f"{k}={v}") for k,v in json.load(open("/tmp/_sec_new.json")).items()]' > /tmp/backend.env
scp "${SSHOPT[@]}" /tmp/backend.env "ubuntu@$IP:/opt/societyos/backend.env"
ssh "${SSHOPT[@]}" "ubuntu@$IP" 'cd /opt/societyos && docker compose up -d --force-recreate backend'
rm -f /tmp/_sec.json /tmp/_sec_new.json /tmp/backend.env
echo "✓ Firebase key applied + backend recreated"

#!/usr/bin/env bash
# push-smoke.sh — verify push end-to-end against a running backend.
#
# Usage:  ./scripts/push-smoke.sh <API_BASE_URL> <USER_BEARER_TOKEN> [fixture]
#
# Example:
#   ./scripts/push-smoke.sh http://localhost:3000/v1 "$TOKEN" VISITOR_APPROVAL_REQUEST
#
# What it does:
#   1. snapshots /v1/notifications/unread-count
#   2. fires /v1/dev/push-test with the fixture (default VISITOR_APPROVAL_REQUEST)
#   3. polls unread-count for up to 10s and exits 0 only if it strictly increased
#
# Production note: /v1/dev/push-test is hard-gated to NODE_ENV != production,
# so running this against a prod backend will (correctly) return 403.

set -euo pipefail

API="${1:-}"
TOKEN="${2:-}"
FIXTURE="${3:-VISITOR_APPROVAL_REQUEST}"

if [[ -z "$API" || -z "$TOKEN" ]]; then
  sed -n '3,15p' "$0"
  exit 64
fi

auth=(-H "Authorization: Bearer $TOKEN")
ct=(-H "Content-Type: application/json")

count_before=$(curl -fsS "${auth[@]}" "$API/notifications/unread-count" | sed -nE 's/.*"count":\s*([0-9]+).*/\1/p')
count_before="${count_before:-0}"

echo "→ POST /dev/push-test ($FIXTURE)"
start=$(date +%s)
res=$(curl -fsS -X POST "${auth[@]}" "${ct[@]}" \
  "$API/dev/push-test" \
  -d "{\"type\":\"$FIXTURE\",\"includeActions\":true}")
echo "   status: $res"

echo "→ Polling unread-count (was $count_before) ..."
for i in $(seq 1 10); do
  after=$(curl -fsS "${auth[@]}" "$API/notifications/unread-count" | sed -nE 's/.*"count":\s*([0-9]+).*/\1/p')
  after="${after:-0}"
  if [[ "$after" -gt "$count_before" ]]; then
    elapsed=$(( $(date +%s) - start ))
    echo "delivered ✅ count=$after in ${elapsed}s"
    exit 0
  fi
  sleep 1
done

echo "FAILED ❌ unread-count did not increase within 10s (still $after)"
echo "   inspect: psql -d societyos -c 'SELECT id,status,category,error FROM notification_logs ORDER BY \"createdAt\" DESC LIMIT 3;'"
exit 1

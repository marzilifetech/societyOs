#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
#  One-off DB bootstrap — create the societyos_<env> database + scoped role
#  inside the shared marzi-community-db instance.
#
#  Run ONCE, from the Lightsail instance — it reaches the PRIVATE RDS via the
#  Lightsail↔VPC peering. Idempotent: safe to re-run.
#
#  Usage (the master password is passed in, never stored on disk):
#    RDS_HOST=marzi-community-db.cdk0iqyk2cg4.ap-south-1.rds.amazonaws.com \
#    RDS_MASTER_PASSWORD='…' \
#    APP_DB_PASSWORD='…'   (the societyos_<env>_app password from societyos/dev) \
#    ENVIRONMENT=dev \
#    ./bootstrap-db.sh
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

: "${RDS_HOST:?set RDS_HOST}"
: "${RDS_MASTER_PASSWORD:?set RDS_MASTER_PASSWORD}"
: "${APP_DB_PASSWORD:?set APP_DB_PASSWORD}"
: "${ENVIRONMENT:=dev}"

DB="societyos_${ENVIRONMENT}"
ROLE="societyos_${ENVIRONMENT}_app"

# psql via a throwaway container — no host package needed. The container NATs
# through the host, inheriting the host's VPC-peering route to the private RDS.
run_psql() {
  docker run --rm -e PGPASSWORD="$RDS_MASTER_PASSWORD" postgres:16-alpine \
    psql -h "$RDS_HOST" -U postgres -v ON_ERROR_STOP=1 "$@"
}

echo "→ role $ROLE …"
if [ "$(run_psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$ROLE'")" != "1" ]; then
  run_psql -d postgres -c "CREATE ROLE $ROLE WITH LOGIN PASSWORD '$APP_DB_PASSWORD'"
  echo "  created."
else
  echo "  already exists — skipped."
fi

echo "→ database $DB …"
if [ "$(run_psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'")" != "1" ]; then
  run_psql -d postgres -c "CREATE DATABASE $DB OWNER $ROLE"
  echo "  created."
else
  echo "  already exists — skipped."
fi

# Postgres 15+: the public schema needs an explicit owner/grant for Prisma.
echo "→ public schema → $ROLE …"
run_psql -d "$DB" -c "ALTER SCHEMA public OWNER TO $ROLE"
run_psql -d "$DB" -c "GRANT ALL ON SCHEMA public TO $ROLE"

echo "✓ Bootstrap complete — database '$DB', role '$ROLE'."

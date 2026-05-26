#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
#  One-off DB bootstrap — create the societyos_<env> database + scoped role
#  inside the shared marzi-community-db instance. Fully idempotent.
#
#  Run from the Lightsail instance (reaches the private RDS via VPC peering):
#    RDS_HOST=marzi-community-db.cdk0iqyk2cg4.ap-south-1.rds.amazonaws.com \
#    RDS_MASTER_PASSWORD='…' APP_DB_PASSWORD='…' ENVIRONMENT=dev \
#    bash bootstrap-db.sh
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

: "${RDS_HOST:?set RDS_HOST}"
: "${RDS_MASTER_PASSWORD:?set RDS_MASTER_PASSWORD}"
: "${APP_DB_PASSWORD:?set APP_DB_PASSWORD}"
: "${ENVIRONMENT:=dev}"

DB="societyos_${ENVIRONMENT}"
ROLE="societyos_${ENVIRONMENT}_app"

# Pre-pull the client image — otherwise docker's first-run pull output can
# pollute the $(…) command substitutions below.
docker pull -q postgres:16-alpine >/dev/null

psql_master() {
  docker run --rm -e PGPASSWORD="$RDS_MASTER_PASSWORD" postgres:16-alpine \
    psql -h "$RDS_HOST" -U postgres -v ON_ERROR_STOP=1 "$@"
}

echo "→ role $ROLE …"
if [ "$(psql_master -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$ROLE'")" = "1" ]; then
  psql_master -d postgres -c "ALTER ROLE $ROLE WITH LOGIN PASSWORD '$APP_DB_PASSWORD'"
  echo "  exists — password synced to the societyos/dev secret."
else
  psql_master -d postgres -c "CREATE ROLE $ROLE WITH LOGIN PASSWORD '$APP_DB_PASSWORD'"
  echo "  created."
fi

# RDS quirk: the master user is rds_superuser (not a true superuser), so it must
# be a MEMBER of the owner role before it can CREATE DATABASE … OWNER that role.
echo "→ granting $ROLE membership to postgres …"
psql_master -d postgres -c "GRANT $ROLE TO postgres"

echo "→ database $DB …"
if [ "$(psql_master -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'")" = "1" ]; then
  echo "  already exists — skipped."
else
  psql_master -d postgres -c "CREATE DATABASE $DB OWNER $ROLE"
  echo "  created."
fi

# Postgres 15+: the public schema needs an explicit owner/grant for Prisma.
echo "→ public schema → $ROLE …"
psql_master -d "$DB" -c "ALTER SCHEMA public OWNER TO $ROLE"
psql_master -d "$DB" -c "GRANT ALL ON SCHEMA public TO $ROLE"

echo "✓ Bootstrap complete — database '$DB', role '$ROLE'."

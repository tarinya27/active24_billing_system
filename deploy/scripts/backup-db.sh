#!/usr/bin/env sh
# Daily PostgreSQL backup — run via cron on the host or in a sidecar container.
set -eu
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-active24}" \
  | gzip > "$BACKUP_DIR/active24_${TIMESTAMP}.sql.gz"
echo "Backup written to $BACKUP_DIR/active24_${TIMESTAMP}.sql.gz"
find "$BACKUP_DIR" -name 'active24_*.sql.gz' -mtime +14 -delete
